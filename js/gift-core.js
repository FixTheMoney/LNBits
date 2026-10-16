/* Shared validation and durable issuance records. No wallet credentials in localStorage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GiftCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function integer(value, max = Number.MAX_SAFE_INTEGER) {
    const n = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('正の整数を指定してください。');
    return n;
  }
  function httpUrl(value) {
    if (typeof value !== 'string' || value.length > 4096 || /[\s<>"'`\\]/.test(value)) throw new Error('URLが不正です。');
    const u = new URL(value);
    if (u.username || u.password || (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)))) throw new Error('HTTPSのURLを指定してください。');
    return u.href;
  }
  function serverUrl(value) {
    const u = new URL(httpUrl(value.trim()));
    if (u.search || u.hash) throw new Error('接続先URLにクエリやフラグメントは指定できません。');
    return u.href.replace(/\/$/, '');
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function polymod(values) {
    let c = 1;
    for (const x of values) {
      const top = c >>> 25;
      c = ((c & 0x1ffffff) << 5) ^ x;
      [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3].forEach((g,i) => { if ((top >>> i) & 1) c ^= g; });
    }
    return c >>> 0;
  }
  function expand(hrp) { return [...hrp].map(c => c.charCodeAt(0) >>> 5).concat(0, [...hrp].map(c => c.charCodeAt(0) & 31)); }
  function bits(data, from, to, pad) {
    let acc=0, count=0; const out=[];
    for (const v of data) {
      acc=((acc << from)|v) & ((1 << (from+to-1))-1); count+=from;
      while(count>=to) { count-=to; out.push((acc >>> count)&((1<<to)-1)); }
    }
    if (pad && count) out.push((acc << (to-count))&((1<<to)-1));
    else if (!pad && (count>=from || ((acc << (to-count))&((1<<to)-1)))) throw new Error('LNURLのパディングが不正です。');
    return out;
  }
  function bech32Decode(value) {
    if (typeof value !== 'string' || value.length > 10000 || (value !== value.toLowerCase() && value !== value.toUpperCase())) throw new Error('Bech32の形式が不正です。');
    const s=value.toLowerCase(), at=s.lastIndexOf('1');
    if (at<1 || s.length-at<7) throw new Error('Bech32の形式が不正です。');
    const hrp=s.slice(0,at), data=[...s.slice(at+1)].map(c=>alphabet.indexOf(c));
    if (data.some(n=>n<0) || polymod(expand(hrp).concat(data))!==1) throw new Error('Bech32のチェックサムが不正です。');
    return {hrp, data:data.slice(0,-6)};
  }
  function lnurlEncode(url) {
    const data=bits(new TextEncoder().encode(httpUrl(url)),8,5,true);
    const p=polymod(expand('lnurl').concat(data,[0,0,0,0,0,0]))^1;
    return 'lnurl1'+data.concat(Array.from({length:6},(_,i)=>(p >>> (5*(5-i)))&31)).map(n=>alphabet[n]).join('');
  }
  function lnurl(value) {
    if (typeof value !== 'string') throw new Error('LNURLが不正です。');
    const s=value.replace(/^lightning:/i,'').trim();
    if (/^https?:\/\//i.test(s)) return lnurlEncode(s);
    const decoded=bech32Decode(s);
    if (decoded.hrp!=='lnurl') throw new Error('LNURLが不正です。');
    httpUrl(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bits(decoded.data,5,8,false))));
    return s.toLowerCase();
  }
  function sharedRows(items) {
    if (!Array.isArray(items) || !items.length || items.length>3000) throw new Error('共有データの件数が不正です。');
    return items.map(item => {
      if (!item || typeof item!=='object' || typeof item.t!=='string' || item.t.length>200 || typeof item.s!=='number') throw new Error('共有データの形式が不正です。');
      return {id:null,title:item.t,lnurl:lnurl(item.l),sats:integer(item.s),used:false,deleted:false,shared:true};
    });
  }
  function invoiceAmount(value) {
    const decoded=bech32Decode(value), match=/^ln(bcrt|bc|tb)(\d+)([munp]?)$/.exec(decoded.hrp);
    if (!match) throw new Error('金額付きBOLT11請求書が必要です。');
    const n=BigInt(match[2]), unit=match[3];
    if (unit==='p') { if(n%10n) throw new Error('請求額の単位が不正です。'); return n/10n; }
    return n*({'':100000000000n,m:100000000n,u:100000n,n:100n}[unit]);
  }
  function assertInvoice(value, msats) {
    if (!Number.isSafeInteger(msats) || msats < 1) throw new Error('支払い金額が不正です。');
    if (invoiceAmount(value)!==BigInt(msats)) throw new Error('請求書の金額が指定額と一致しません。支払いを停止しました。');
    return value;
  }
  // BOLT11: seven timestamp words, tagged fields, then 104 signature words.
  // Signature validation remains the LNbits server's responsibility.
  function invoicePaymentHash(value) {
    invoiceAmount(value);
    const {data}=bech32Decode(value), end=data.length-104;
    let hash;
    if(end<7) throw new Error('請求書のデータが不足しています。');
    for(let at=7;at<end;) {
      if(at+3>end) throw new Error('請求書のタグが不正です。');
      const type=data[at++], length=(data[at++]<<5)|data[at++];
      if(at+length>end) throw new Error('請求書のタグが不正です。');
      if(type===1) {
        if(hash || length!==52) throw new Error('請求書の支払い照合IDが不正です。');
        const bytes=bits(data.slice(at,at+length),5,8,false);
        hash=bytes.map(b=>b.toString(16).padStart(2,'0')).join('');
      }
      at+=length;
    }
    if(!hash) throw new Error('請求書の支払い照合IDがありません。');
    return hash;
  }
  function csv(rows) {
    return '\ufeff'+rows.map(row=>row.map(value=>{
      let s=String(value??'');
      if (/^[\s]*[=+@-]/.test(s)) s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    }).join(',')).join('\r\n')+'\r\n';
  }
  function unique(rows, keys) {
    for (const key of keys) {
      const seen=new Set();
      for (const row of rows) { if (!row[key] || seen.has(row[key])) throw new Error(key+'に欠落または重複があります。'); seen.add(row[key]); }
    }
  }
  function cardCsv(rows) {
    if (!rows.length) throw new Error('出力対象がありません。');
    unique(rows,['id','walletId','accessUrl']);
    for(const r of rows) {
      if(r.state!=='verified' || !r.active || r.pendingTopup || r.balanceSats!==r.fundedSats || !r.verifiedAt) throw new Error('入金・状態の確認が完了していないカードがあります。確認後に再出力してください。');
      integer(r.fundedSats); httpUrl(r.accessUrl);
    }
    return csv([['batch_id','card_id','name','wallet_id','access_url','amount_sats','status','verified_at'],...rows.map(r=>[r.batchId,r.id,r.name,r.walletId,r.accessUrl,r.fundedSats,'verified',r.verifiedAt])]);
  }
  function linkCsv(rows) {
    if(!rows.length) throw new Error('出力対象がありません。');
    unique(rows,['distributionId','id','lnurl']);
    for(const r of rows) {
      if(r.state!=='verified' || r.used || r.deleted) throw new Error('未確認・使用済み・無効なリンクがあります。確認後に再出力してください。');
      lnurl(r.lnurl); integer(r.sats); httpUrl(r.shareableLink);
    }
    return csv([['batch_id','distribution_id','link_id','title','claim_url','lnurl','sats','status'],...rows.map(r=>[r.batchId,r.distributionId,r.id,r.title,r.shareableLink,r.lnurl,r.sats,'unused'])]);
  }
  function clearLegacyKey(storage) {
    storage.removeItem('lnbits_api_key');
    const raw=storage.getItem('lnqr_config');
    if(raw) { try { const c=JSON.parse(raw); delete c.apiKey; storage.setItem('lnqr_config',JSON.stringify(c)); } catch (_) { /* keep unrelated damaged data */ } }
  }
  async function request(url, options={}) {
    url=httpUrl(url);
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(url,{...options,signal:controller.signal,redirect:'error'});
      if(!response.ok) throw new Error('HTTP '+response.status);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  class Ledger {
    constructor(name='lightning-gift-issuance-v1') { this.name=name; this.db=null; }
    async open() {
      if(this.db) return this;
      if(typeof indexedDB==='undefined') throw new Error('このブラウザーでは記録を保存できません。作成を停止しました。');
      this.db=await new Promise((resolve,reject)=>{
        const r=indexedDB.open(this.name,1);
        r.onupgradeneeded=()=>{const s=r.result.createObjectStore('records',{keyPath:'id'});s.createIndex('kind','kind');};
        r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('保存領域を開けません。他のタブを閉じてください。'));
      });
      return this;
    }
    async transaction(mode, run) {
      await this.open();
      return new Promise((resolve,reject)=>{
        const tx=this.db.transaction('records',mode), s=tx.objectStore('records');let result;
        tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('記録の保存・読み込みに失敗しました。操作を停止しました。'));
        tx.onabort=tx.onerror;
        try { const r=run(s); if(r) r.onsuccess=()=>{result=r.result;}; } catch(e) { tx.abort();reject(e); }
      });
    }
    get(id) { return this.transaction('readonly',s=>s.get(id)); }
    put(row) { return this.transaction('readwrite',s=>s.put(row)); }
    putMany(rows) { return this.transaction('readwrite',s=>{for(const row of rows)s.add(row);}); }
    list(kind) { return this.transaction('readonly',s=>s.index('kind').getAll(kind)); }
  }
  function id() { return crypto.randomUUID(); }
  function batches(rows, select, current) {
    const groups=new Map();
    for(const row of rows) {
      const key=row.batchId||'legacy',group=groups.get(key)||{id:key,count:0,date:row.createdAt||'',name:row.name||row.title||''};
      group.count++;groups.set(key,group);
    }
    const sorted=[...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
    const selected=groups.has(current)?current:sorted[0]?.id||'';
    select.replaceChildren();
    for(const group of sorted) {
      const option=document.createElement('option');option.value=group.id;
      option.textContent=(group.date.slice(0,16).replace('T',' ')||'以前のデータ')+' · '+group.count.toLocaleString()+'件 · '+group.name.slice(0,30);
      select.appendChild(option);
    }
    select.value=selected;return selected;
  }
  async function exclusive(run) {
    if (!globalThis.navigator?.locks) throw new Error('複数タブの二重実行を防げるブラウザーで開いてください。');
    return navigator.locks.request('lightning-gift-wallet-operations',{ifAvailable:true},lock=>{
      if(!lock) throw new Error('別のタブで処理中です。その処理が終わるまでお待ちください。');
      return run();
    });
  }
  return {integer,httpUrl,serverUrl,escapeHtml,bech32Decode,lnurlEncode,lnurl,sharedRows,assertInvoice,invoiceAmount,invoicePaymentHash,csv,cardCsv,linkCsv,unique,clearLegacyKey,request,Ledger,id,batches,exclusive};
});
