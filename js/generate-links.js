const C=GiftCore;
const ledger=new C.Ledger();
let selectedLinkBatch='';
function batchLinks(){return isSharedView?generatedLinks:generatedLinks.filter(l=>!selectedLinkBatch||l.batchId===selectedLinkBatch);}
let linkPage=0;
let pauseGeneration=false;

/* ==========================================================
   Generate LNURL-Withdraw Links — app
   ==========================================================
   Storage keys (shared with QR Drop):
     lnbits_url      → LNbits base URL
     管理キーはメモリ内のみ。作成記録は IndexedDB に保存。
   ========================================================== */

// ── Storage ────────────────────────────────────────────────────
const LS_URL = 'lnbits_url';
const LS_KEY = 'lnbits_api_key';

// ── State ──────────────────────────────────────────────────────
let generatedLinks = [];   // { id, title, lnurl, sats, used, deleted, shared? }
let isSharedView   = false; // true when loaded from a #share= hash
let generating     = false;

// ── DOM helper ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = 'info', dur = 4500) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// ── Settings ───────────────────────────────────────────────────
function loadSettings() {
  $('api-key').value='';
  try {C.clearLegacyKey(localStorage);$('lnbits-url').value=localStorage.getItem(LS_URL)||'';}
  catch {toast('ブラウザの設定保存を利用できません。接続先を入力してください。','error');}
}
function saveSettings() {try{localStorage.setItem(LS_URL,$('lnbits-url').value.trim());}catch{}}
function getConn() {return {url:$('lnbits-url').value.trim().replace(/\/$/,''),key:$('api-key').value.trim()};}
function currentConnection() {
  const conn=getConn();conn.url=C.serverUrl(conn.url);
  if(!conn.key)throw new Error('管理用キーを入力してください。');
  return conn;
}
async function managedConnection(links) {
  if(generating||isSharedView)throw new Error('作成処理が完了してから管理操作を行ってください。');
  const conn=currentConnection();
  if(links.some(l=>l.lnbitsUrl!==conn.url))throw new Error('記録と同じLNbits接続先を指定してください。');
  const wallet=await C.request(conn.url+'/api/v1/wallet',{headers:{'X-Api-Key':conn.key}});
  if(!wallet.id||links.some(l=>l.ownerWalletId!==wallet.id))throw new Error('作成時と同じウォレットを指定してください。');
  return conn;
}
function checkExistingConnection(base,key) {
  if(generating||isSharedView)throw new Error('作成処理が完了してから管理操作を行ってください。');
  const conn=currentConnection();
  if(!BASES(conn.url).includes(base)||conn.key!==key)throw new Error('接続設定が変わりました。既存リンク一覧を再取得してください。');
  return conn;
}

// ── API key visibility toggle ──────────────────────────────────
function toggleKey() {
  const inp = $('api-key'), icon = $('eye-icon');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  icon.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

// ── Balance check ──────────────────────────────────────────────
async function checkBalance() {
  const { url, key } = getConn();
  if (!url || !key) { toast('Enter LNbits URL and API key first.', 'error'); return; }
  const btn = $('check-balance-btn');
  btn.disabled = true;
  $('balance-display').textContent = '⏳ checking…';
  try {
    const d=await C.request(C.serverUrl(url)+'/api/v1/wallet',{headers:{'X-Api-Key':key}});
    const sats = Math.floor(d.balance / 1000);
    $('balance-display').textContent = `✅ ${sats.toLocaleString()} sats`;
  } catch (e) {
    $('balance-display').textContent = `❌ ${e.message}`;
    toast('Balance check failed: ' + e.message, 'error');
  } finally { btn.disabled = false; }
}

// ── Cost display ───────────────────────────────────────────────
function updateCost() {
  const sats  = parseInt($('sats-per-link').value)  || 0;
  const count = parseInt($('link-count').value) || 0;
  $('total-cost-display').textContent = (sats * count).toLocaleString() + ' sats';
  $('total-cost-note').textContent = `across ${count} link${count !== 1 ? 's' : ''}`;
}

// ── Withdraw API discovery ─────────────────────────────────────
const BASES = url => [
  `${url}/withdraw/api/v1`,
  `${url}/lnurlw/api/v1`,
  `${url}/api/v1/extensions/withdraw/api/v1`,
  `${url}/api/v1/extensions/lnurlw/api/v1`,
];

async function discoverWithdrawBase(url, key) {
  url=C.serverUrl(url);
  for (const base of BASES(url)) {
    try {
      const res = await fetch(`${base}/links`, { headers: { 'X-Api-Key': key },signal:AbortSignal.timeout(20000),redirect:'error' });
      if (res.ok || res.status === 200) return base;
      if (res.status === 401 || res.status === 403) throw new Error(`Auth error (HTTP ${res.status}): use Admin key`);
    } catch (e) {
      if (e.message.startsWith('Auth error')) throw e;
    }
  }
  throw new Error('Withdraw extension not found. Go to LNbits → Extensions → enable "Withdraw".');
}

// ── Create a single withdraw link ──────────────────────────────
const PAYLOADS=(sats,title)=>[{title,min_withdrawable:C.integer(sats),max_withdrawable:C.integer(sats),uses:1,wait_time:1,is_unique:true}];

// Bech32 LNURL encoder (same as app3.js)
function lnurlEncode(rawUrl) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GEN = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
  function polymod(v){let c=1;for(const x of v){const t=c>>25;c=((c&0x1ffffff)<<5)^x;for(let i=0;i<5;i++)if((t>>i)&1)c^=GEN[i];}return c;}
  function hrpExpand(h){const r=[];for(let i=0;i<h.length;i++)r.push(h.charCodeAt(i)>>5);r.push(0);for(let i=0;i<h.length;i++)r.push(h.charCodeAt(i)&31);return r;}
  function convertbits(d,f,t,pad){let a=0,b=0;const r=[],m=(1<<t)-1;for(const v of d){a=((a<<f)|v);b+=f;while(b>=t){b-=t;r.push((a>>b)&m);}}if(pad&&b>0)r.push((a<<(t-b))&m);return r;}
  function createChecksum(h,d){const v=[...hrpExpand(h),...d,0,0,0,0,0,0];const p=polymod(v)^1;const c=[];for(let i=0;i<6;i++)c.push((p>>(5*(5-i)))&31);return c;}
  const hrp='lnurl';
  const enc=new TextEncoder().encode(rawUrl);
  const converted=convertbits(Array.from(enc),8,5,true);
  const checksum=createChecksum(hrp,converted);
  const combined=[...converted,...checksum];
  return hrp+('1')+combined.map(b=>CHARSET[b]).join('');
}

function normaliseLnurl(raw) {try{return C.lnurl(raw);}catch{return null;}}
async function createOneLink(base,key,sats,title) {
  return C.request(base+'/links',{method:'POST',headers:{'X-Api-Key':key,'Content-Type':'application/json'},body:JSON.stringify(PAYLOADS(sats,title)[0])});
}

// ── Delete a link via API ──────────────────────────────────────
async function deleteLink(base, key, linkId) {
  const res = await fetch(`${base}/links/${encodeURIComponent(linkId)}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': key },signal:AbortSignal.timeout(20000),redirect:'error'
  });
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed: HTTP ${res.status}`);
}

// ── Check link status (used?) ──────────────────────────────────
async function checkLinkStatus(base, key, linkId) {
  const res = await fetch(`${base}/links/${encodeURIComponent(linkId)}`, { headers: { 'X-Api-Key': key },signal:AbortSignal.timeout(20000),redirect:'error' });
  if (!res.ok) return null;
  const d = await res.json();
  return { used: !!(d.used || (d.times_used && d.times_used >= 1)) };
}

// ── Pad number ────────────────────────────────────────────────
function pad(n, total) {
  return String(n).padStart(String(total).length, '0');
}

// ── Generate all links ─────────────────────────────────────────
function fromRecord(r) {return {...r,recordId:r.id,distributionId:r.id,id:r.linkId||null};}
async function executeLinks(resume=false) {
  if(generating || isSharedView)return;
  generating=true;pauseGeneration=false;
  $('generate-btn').disabled=true;$('resume-generate-btn').disabled=true;$('pause-generate-btn').disabled=false;
  try {await C.exclusive(async()=>{
    const conn=getConn();conn.url=C.serverUrl(conn.url);if(!conn.key)throw new Error('管理用キーを入力してください。');
    await ledger.open();
    const wallet=await C.request(conn.url+'/api/v1/wallet',{headers:{'X-Api-Key':conn.key}});
    if(!wallet.id)throw new Error('ウォレットを確認できません。');
    const all=await ledger.list('link');let rows;
    if(resume) {
      rows=all.filter(r=>r.lnbitsUrl===conn.url&&r.ownerWalletId===wallet.id&&(!selectedLinkBatch||r.batchId===selectedLinkBatch)&&r.state!=='verified'&&!r.deleted);
      if(!rows.length)throw new Error('再開できる記録がありません。');
    } else {
      const sats=C.integer($('sats-per-link').value),count=C.integer($('link-count').value,3000),prefix=$('link-title-prefix').value.trim()||'LNURL Withdraw',batchId=C.id();
      if(!Number.isSafeInteger(sats*count))throw new Error('合計額が大きすぎます。');
      rows=Array.from({length:count},(_,i)=>({id:C.id(),kind:'link',batchId,title:prefix+' #'+pad(i+1,count),sats,state:'planned',lnbitsUrl:conn.url,ownerWalletId:wallet.id,createdAt:new Date().toISOString()}));
      await ledger.putMany(rows);all.push(...rows);selectedLinkBatch=batchId;linkPage=0;
    }
    const base=await discoverWithdrawBase(conn.url,conn.key);
    const api={create:(sats,title)=>createOneLink(base,conn.key,sats,title),info:id=>C.request(base+'/links/'+encodeURIComponent(id),{headers:{'X-Api-Key':conn.key}})};
    saveSettings();$('gen-progress-wrap').classList.add('visible');
    await GiftIssuance.run(ledger,rows,(store,row)=>GiftIssuance.link(store,row,api),{paused:()=>pauseGeneration,onProgress:(done,total,row)=>{
      $('gen-progress-label').textContent=done+' / '+total+'件を処理';$('gen-progress-fill').style.width=(done/total*100)+'%';$('gen-progress-detail').textContent=row.error||row.title;
    }});
    $('gen-status').textContent=pauseGeneration?'停止しました。未完了分を再開できます。':'処理を終えました。CSV保存時に全件を再確認します。';
  });} catch(e){toast(e.message,'error');$('gen-status').textContent=e.message;}
  finally {
    try {generatedLinks=(await ledger.list('link')).map(fromRecord);renderGeneratedTable();$('results-section').style.display='';}catch(e){toast(e.message,'error');}
    resetGenBtn();$('resume-generate-btn').disabled=false;$('pause-generate-btn').disabled=true;
  }
}
async function generateLinks(){return executeLinks(false);}
async function resumeLinks(){return executeLinks(true);}
async function persistLink(link) {
  if(!link.recordId)return;
  const old=await ledger.get(link.recordId);
  await ledger.put({...old,used:link.used,deleted:link.deleted,state:link.state});
}

function resetGenBtn() {
  generating = false;
  $('generate-btn').disabled = false;
  $('generate-btn').innerHTML = '<i class="fas fa-bolt"></i> Generate Links';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Render generated table ─────────────────────────────────────
function renderGeneratedTable() {
  const tbody = $('links-tbody');
  if(!isSharedView)selectedLinkBatch=C.batches(generatedLinks,$('link-batch'),selectedLinkBatch);
  $('link-batch').disabled=isSharedView;
  const shown=batchLinks();
  tbody.innerHTML = '';

  const total   = shown.length;
  const unused  = shown.filter(l => l.state==='verified' && !l.used && !l.deleted).length;
  const used    = shown.filter(l => l.used).length;
  const deleted = shown.filter(l => l.deleted).length;
  const errors  = shown.filter(l => !l.shared && l.state!=='verified' && !l.deleted).length;

  $('result-stats').innerHTML = `
    <span class="stat-chip sc-total"><i class="fas fa-link"></i> ${total} total</span>
    <span class="stat-chip sc-unused"><i class="fas fa-check-circle"></i> ${unused} unused</span>
    <span class="stat-chip sc-used"><i class="fas fa-bolt"></i> ${used} claimed</span>
    ${deleted ? `<span class="stat-chip" style="background:rgba(90,90,122,0.15);color:var(--text3);border:1px solid var(--border);">🗑 ${deleted} voided</span>` : ''}
    ${errors  ? `<span class="stat-chip" style="background:rgba(239,68,68,0.1);color:var(--red);border:1px solid rgba(239,68,68,0.25);">❌ ${errors} errors</span>` : ''}
  `;

  shown.slice(linkPage*100,(linkPage+1)*100).forEach((link, pageIndex) => {
    const idx=generatedLinks.indexOf(link);
    const tr = document.createElement('tr');
    let statusPill, actionCell;

    if (!link.shared && (!link.id || link.state!=='verified')) {
      statusPill = `<span class="pill" style="background:rgba(239,68,68,0.1);color:var(--red);border:1px solid rgba(239,68,68,0.25);">❌ error</span>`;
      actionCell = `<span style="font-size:0.75rem;color:var(--red);">${escHtml(link.error || 'failed')}</span>`;
    } else if (link.deleted) {
      statusPill = `<span class="pill pill-deleted">🗑 voided</span>`;
      actionCell = `<span style="color:var(--text3);font-size:0.78rem;">deleted</span>`;
    } else if (link.used) {
      statusPill = `<span class="pill pill-used">⚡ claimed</span>`;
      actionCell = `<span style="color:var(--text3);font-size:0.78rem;">exhausted</span>`;
    } else if (link.shared) {
      // Shared-view row: no API key available — only QR, copy, download
      statusPill = `<span class="pill pill-unused" style="background:rgba(59,130,246,0.12);color:var(--blue);border:1px solid rgba(59,130,246,0.3);">📎 shared</span>`;
      actionCell = `
        <div class="action-cell">
          <button class="btn-icon" data-action="qr" data-idx="${idx}" title="Show QR"><i class="fas fa-qrcode"></i></button>
          <button class="btn-icon" data-action="copy" data-idx="${idx}" title="Copy LNURL"><i class="fas fa-copy"></i></button>
          <button class="btn-icon" data-action="dl-html" data-idx="${idx}" title="Download QR HTML file"><i class="fas fa-download"></i></button>
        </div>`;
    } else {
      statusPill = `<span class="pill pill-unused">✓ unused</span>`;
      actionCell = `
        <div class="action-cell">
          <button class="btn-icon" data-action="qr" data-idx="${idx}" title="Show QR"><i class="fas fa-qrcode"></i></button>
          <button class="btn-icon" data-action="copy" data-idx="${idx}" title="Copy LNURL"><i class="fas fa-copy"></i></button>
          <button class="btn-icon" data-action="dl-html" data-idx="${idx}" title="Download QR HTML file"><i class="fas fa-download"></i></button>
          ${link.shareableLink ? `<button class="btn-icon" data-action="open-share" data-idx="${idx}" title="Open LNbits shareable page"><i class="fas fa-external-link-alt"></i></button>` : ''}
          ${link.shareableLink ? `<button class="btn-icon" data-action="copy-share" data-idx="${idx}" title="Copy shareable link"><i class="fas fa-share-alt"></i></button>` : ''}
          <button class="btn-icon" data-action="refresh" data-idx="${idx}" title="Check status"><i class="fas fa-sync"></i></button>
          <button class="btn-icon danger" data-action="delete" data-idx="${idx}" title="Void this link"><i class="fas fa-trash"></i></button>
        </div>`;
    }

    // LNURL + shareable link cell
    let shareHref=null;try{if(link.shareableLink)shareHref=C.httpUrl(link.shareableLink);}catch{}
    const lnurlShort = link.lnurl ? link.lnurl.slice(0, 30) + '…' : '—';
    const lnurlCell  = `<div class="lnurl-cell-wrap">
        <span class="lnurl-mono" title="${escHtml(link.lnurl || '')}">${escHtml(lnurlShort)}</span>
        ${shareHref
          ? `<a class="share-url-link" href="${escHtml(shareHref)}" target="_blank" rel="noopener" title="Open LNbits shareable page"><i class="fas fa-external-link-alt"></i> ${escHtml(shareHref.length > 46 ? shareHref.slice(0,46)+'…' : shareHref)}</a>`
          : '<span class="share-url-none">—</span>'}
      </div>`;

    tr.innerHTML = `
      <td style="color:var(--text3);font-size:0.8rem;">${idx + 1}</td>
      <td>${escHtml(link.title)}</td>
      <td class="lnurl-cell">${lnurlCell}</td>
      <td style="font-family:'JetBrains Mono',monospace;">${link.sats.toLocaleString()}</td>
      <td>${statusPill}</td>
      <td>${actionCell}</td>
    `;
    tbody.appendChild(tr);
  });

  const pages=Math.max(1,Math.ceil(shown.length/100));
  $('links-page-label').textContent=(linkPage+1)+' / '+pages+'ページ（'+shown.length+'件）';
  $('links-prev-btn').disabled=linkPage===0;$('links-next-btn').disabled=linkPage+1>=pages;
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', function () {
      handleLinkAction(this.dataset.action, parseInt(this.dataset.idx));
    });
  });
}

async function handleLinkAction(action, idx) {
  const link = generatedLinks[idx];
  if (!link || (!link.id && !link.shared)) return;
  if(link.shared && !['qr','copy','dl-html'].includes(action))return;

  if (action === 'qr') {
    openQrModal(link.lnurl, link.title, link.sats);
  } else if (action === 'copy') {
    await navigator.clipboard.writeText(link.lnurl).catch(() => {});
    toast('LNURL copied!', 'success', 2000);
  } else if (action === 'dl-html') {
    downloadSingleHtml(link);
  } else if (action === 'open-share') {
    if (link.shareableLink) {
      window.open(C.httpUrl(link.shareableLink), '_blank', 'noopener');
    } else {
      toast('No shareable link available for this link.', 'info');
    }
  } else if (action === 'copy-share') {
    if (link.shareableLink) {
      await navigator.clipboard.writeText(link.shareableLink).catch(() => {});
      toast('Shareable link copied!', 'success', 2000);
    } else {
      toast('No shareable link available for this link.', 'info');
    }
  } else if (action === 'refresh') {
    try {await C.exclusive(async()=>{
      const {url,key}=await managedConnection([link]);
      const base=await discoverWithdrawBase(url,key);
      const status = await checkLinkStatus(base, key, link.id);
      if (status) {
        link.used = status.used;
        await persistLink(link);
        renderGeneratedTable();
        toast(status.used ? '⚡ Link has been claimed' : '✓ Link is still unused', status.used ? 'info' : 'success', 2500);
      }
    });} catch (e) { toast('Status check failed: ' + e.message, 'error'); }
  } else if (action === 'delete') {
    if (!confirm(`Void link "${link.title}"? The ${link.sats.toLocaleString()} sats stay in your wallet.`)) return;
    try {await C.exclusive(async()=>{
      const {url,key}=await managedConnection([link]);
      const base=await discoverWithdrawBase(url,key);
      await deleteLink(base, key, link.id);
      link.deleted = true;
      await persistLink(link);
      renderGeneratedTable();
      toast(`Link "${link.title}" voided.`, 'success');
    });} catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
}

// ── Shareable Link ────────────────────────────────────────────
function copyShareableLink() {
  const active = batchLinks().filter(l => l.lnurl && !l.deleted);
  if (active.length === 0) { toast('No active links to share.', 'error'); return; }

  const payload = active.map(l => ({ t: l.title, l: l.lnurl, s: l.sats }));
  let encoded;
  try {
    encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
  } catch (e) {
    toast('Could not encode share data: ' + e.message, 'error');
    return;
  }
  const shareUrl = window.location.href.split('#')[0] + '#share=' + encoded;
  navigator.clipboard.writeText(shareUrl).catch(() => {
    // Fallback for browsers that block clipboard
    const ta = document.createElement('textarea');
    ta.value = shareUrl;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
  toast(`📎 Shareable link copied! (${active.length} links)`, 'success', 5000);
}

// Called on boot — checks window.location.hash for #share=<base64>
function tryLoadFromHash() {
  const hash=window.location.hash;if(!hash.startsWith('#share='))return;
  isSharedView=true;
  $('generate-btn').disabled=true;$('resume-generate-btn').disabled=true;
  try {
    if(hash.length>2000000)throw new Error('共有データが大きすぎます。');
    const next=C.sharedRows(JSON.parse(decodeURIComponent(atob(hash.slice(7)))));
    generatedLinks=next;renderGeneratedTable();$('results-section').style.display='';
    const banner=document.createElement('div');banner.className='warning-callout';
    banner.textContent='共有表示です。QR・コピー・HTML保存を利用できます。ウォレットの管理操作はできません。';
    $('results-section').prepend(banner);
  }catch(e){toast('共有データを読み込めません: '+e.message,'error');}
}

// ── Export CSV ─────────────────────────────────────────────────
async function exportCsv() {
  try {await C.exclusive(async()=>{
    if(generating || isSharedView)throw new Error('管理画面の処理完了後に出力してください。');
    const targets=batchLinks();
    const conn=await managedConnection(targets);
    const base=await discoverWithdrawBase(conn.url,conn.key);
    for(const link of targets) {
      if(link.state!=='verified'||link.deleted||!link.id||link.lnbitsUrl!==conn.url)throw new Error('未確認・無効・別の接続先の記録があります。');
      const data=await C.request(base+'/links/'+encodeURIComponent(link.id),{headers:{'X-Api-Key':conn.key}});
      if(data.id!==link.id||data.min_withdrawable!==link.sats||data.max_withdrawable!==link.sats||data.uses!==1||![0,false].includes(data.used)||data.enabled===false||(data.currency&&data.currency.toLowerCase()!=='sat')||C.lnurl(data.lnurl_url||data.lnurl||data.lnurl_full||data.lnurl_encoded)!==link.lnurl)throw new Error('指定額・単回利用・未使用状態を確認できません。');
    }
    const text=C.linkCsv(targets),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download='lnurl-links-'+Date.now()+'.csv';a.click();URL.revokeObjectURL(a.href);
    toast(targets.length+'件をCSVに保存しました。','success');
  });}catch(e){toast(e.message,'error');}
}

function copyAllLnurls() {
  const urls = batchLinks().filter(l => l.lnurl && !l.deleted).map(l => l.lnurl);
  if (urls.length === 0) { toast('No active LNURLs to copy.', 'error'); return; }
  navigator.clipboard.writeText(urls.join('\n')).catch(() => {});
  toast(`${urls.length} LNURLs copied to clipboard!`, 'success');
}

async function deleteUsedGenerated() {
  const used = batchLinks().filter(l => l.id && l.used && !l.deleted);
  if (used.length === 0) { toast('No claimed links to delete.', 'info'); return; }
  if (!confirm(`Delete ${used.length} claimed link(s)?`)) return;
  await voidGenerated(used);
}

async function deleteAllUnused() {
  const unused = batchLinks().filter(l => l.id && !l.used && !l.deleted);
  if (unused.length === 0) { toast('No unused links to void.', 'info'); return; }
  if (!confirm(`⚠️ Void ${unused.length} UNUSED link(s)? The sats stay in your wallet but no one can claim these links.`)) return;
  await voidGenerated(unused);
}
async function voidGenerated(targets) {
  let done=0;
  try{await C.exclusive(async()=>{
    const {url,key}=await managedConnection(targets),base=await discoverWithdrawBase(url,key);
    for(const link of targets){await deleteLink(base,key,link.id);link.deleted=true;await persistLink(link);done++;}
    toast(`${done}件を無効にしました。`,'success');
  });}catch(e){toast(`${done}件を処理後に停止: ${e.message}`,'error');}
  renderGeneratedTable();
}

// ── Fetch existing links from wallet ──────────────────────────
async function fetchExistingLinks() {
  const btn = $('fetch-existing-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading…';
  $('existing-wrap').innerHTML = '<div class="empty-state">⏳ Fetching links…</div>';

  try {
    const {url,key}=currentConnection(),base=await discoverWithdrawBase(url,key);
    const result=await C.request(base+'/links?all_wallets=false',{headers:{'X-Api-Key':key}});
    const links=Array.isArray(result)?result:result.data;
    if(!Array.isArray(links))throw new Error('リンク一覧の形式を確認できません。');

    renderExistingTable(links, base, key);
    toast(`Loaded ${links.length} link(s)`, 'success', 2500);
  } catch (e) {
    $('existing-wrap').innerHTML = `<div class="empty-state" style="color:var(--red);">❌ ${escHtml(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync"></i> Fetch Existing Links';
  }
}

function renderExistingTable(links, base, key) {
  const unused  = links.filter(l => !(l.used || (l.times_used && l.times_used >= 1)));
  const used    = links.filter(l =>  (l.used || (l.times_used && l.times_used >= 1)));

  $('existing-stats').innerHTML = `
    <span class="stat-chip sc-total"><i class="fas fa-link"></i> ${links.length} total</span>
    <span class="stat-chip sc-unused"><i class="fas fa-check-circle"></i> ${unused.length} unused</span>
    <span class="stat-chip sc-used"><i class="fas fa-bolt"></i> ${used.length} claimed</span>
  `;

  $('delete-existing-used-btn').style.display   = used.length   ? '' : 'none';
  $('delete-existing-unused-btn').style.display = unused.length ? '' : 'none';

  if (links.length === 0) {
    $('existing-wrap').innerHTML = '<div class="empty-state">No withdraw links found on this wallet.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'links-table';
  table.innerHTML = `
    <thead><tr>
      <th>#</th><th>Title</th><th>LNURL / Shareable Link</th><th>Sats</th><th>Status</th><th>Actions</th>
    </tr></thead>
  `;
  const tbody = document.createElement('tbody');

  links.forEach((link, idx) => {
    const isUsed  = !!(link.used || (link.times_used && link.times_used >= 1));
    const sats = Number(link.max_withdrawable || link.min_withdrawable || 0);
    const rawLnurl      = link.lnurl || link.lnurl_encoded || null;
    const lnurl          = rawLnurl ? normaliseLnurl(rawLnurl) : null;
    // Prefer explicit shareable_link field; fall back to lnurl_full if it's a URL
    let shareableLink    = link.shareable_link || link.shareableLink || link.share_link || null;
    if (!shareableLink && link.lnurl_full && /^https?:\/\//i.test(link.lnurl_full)) {
      shareableLink = link.lnurl_full;
    }
    // Fallback: build /withdraw?id= URL from the discovered LNbits base
    if (!shareableLink && link.id && base) {
      const lnbitsBase = base.replace(/\/(withdraw|lnurlw)\/api\/v1.*$/i, '')
                                     .replace(/\/api\/v1\/extensions\/(withdraw|lnurlw)\/api\/v1.*$/i, '');
      if (lnbitsBase) shareableLink = `${lnbitsBase}/withdraw?id=${link.id}`;
    }

    try{if(shareableLink)shareableLink=C.httpUrl(shareableLink);}catch{shareableLink=null;}
    const statusPill = isUsed
      ? `<span class="pill pill-used">⚡ claimed</span>`
      : `<span class="pill pill-unused">✓ unused</span>`;

    let actionCell;
    if (isUsed) {
      actionCell = `
        <div class="action-cell">
          <button class="btn-icon danger" data-eid="${escHtml(link.id)}" data-etitle="${escHtml(link.title||'')}" data-action="del-existing" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    } else {
      actionCell = `
        <div class="action-cell">
          ${lnurl ? `<button class="btn-icon" data-action="qr-existing" data-lnurl="${escHtml(lnurl)}" data-title="${escHtml(link.title||'')}" data-sats="${sats}" title="Show QR"><i class="fas fa-qrcode"></i></button>` : ''}
          ${lnurl ? `<button class="btn-icon" data-action="copy-existing" data-lnurl="${escHtml(lnurl)}" title="Copy LNURL"><i class="fas fa-copy"></i></button>` : ''}
          ${shareableLink ? `<button class="btn-icon" data-action="open-share-existing" data-shareurl="${escHtml(shareableLink)}" title="Open LNbits shareable page"><i class="fas fa-external-link-alt"></i></button>` : ''}
          ${shareableLink ? `<button class="btn-icon" data-action="copy-share-existing" data-shareurl="${escHtml(shareableLink)}" title="Copy shareable link"><i class="fas fa-share-alt"></i></button>` : ''}
          <button class="btn-icon danger" data-eid="${escHtml(link.id)}" data-etitle="${escHtml(link.title||'')}" data-esats="${sats}" data-action="del-existing" title="Void this link">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    }

    const existLnurlShort = lnurl ? lnurl.slice(0,28)+'…' : '—';
    const existShareCell  = shareableLink
      ? `<a class="share-url-link" href="${escHtml(shareableLink)}" target="_blank" rel="noopener" title="Open shareable page"><i class="fas fa-external-link-alt"></i> ${escHtml(shareableLink.length > 40 ? shareableLink.slice(0,40)+'…' : shareableLink)}</a>`
      : '<span class="share-url-none">—</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:0.8rem;">${idx + 1}</td>
      <td>${escHtml(link.title || '(untitled)')}</td>
      <td class="lnurl-cell"><div class="lnurl-cell-wrap"><span class="lnurl-mono" title="${escHtml(lnurl||'')}">${escHtml(existLnurlShort)}</span>${existShareCell}</div></td>
      <td style="font-family:'JetBrains Mono',monospace;">${escHtml(sats.toLocaleString())}</td>
      <td>${statusPill}</td>
      <td>${actionCell}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  $('existing-wrap').innerHTML = '';
  $('existing-wrap').appendChild(table);

  // Wire action buttons
  table.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async function () {
      const action = this.dataset.action;
      if (action === 'qr-existing') {
        openQrModal(this.dataset.lnurl, this.dataset.title, parseInt(this.dataset.sats));
      } else if (action === 'copy-existing') {
        await navigator.clipboard.writeText(this.dataset.lnurl).catch(() => {});
        toast('LNURL copied!', 'success', 2000);
      } else if (action === 'open-share-existing') {
        window.open(C.httpUrl(this.dataset.shareurl), '_blank', 'noopener');
      } else if (action === 'copy-share-existing') {
        await navigator.clipboard.writeText(this.dataset.shareurl).catch(() => {});
        toast('Shareable link copied!', 'success', 2000);
      } else if (action === 'del-existing') {
        const title = this.dataset.etitle || 'this link';
        const sats  = this.dataset.esats;
        const conf  = sats
          ? `Void/delete "${title}"? The ${parseInt(sats).toLocaleString()} sats stay in your wallet.`
          : `Delete "${title}"?`;
        if (!confirm(conf)) return;
        try {await C.exclusive(async()=>{
          checkExistingConnection(base,key);
          await deleteLink(base, key, this.dataset.eid);
          toast(`"${title}" deleted.`, 'success');
        });await fetchExistingLinks();
        } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
      }
    });
  });

  // Wire bulk delete buttons
  $('delete-existing-used-btn').onclick = async () => {
    if (!confirm(`Delete all ${used.length} claimed link(s)?`)) return;
    await voidExisting(used,base,key);
  };
  $('delete-existing-unused-btn').onclick = async () => {
    if (!confirm(`⚠️ Void all ${unused.length} UNUSED link(s)? Sats stay in your wallet.`)) return;
    await voidExisting(unused,base,key);
  };
}
async function voidExisting(links,base,key) {
  let done=0;
  try {await C.exclusive(async()=>{
    checkExistingConnection(base,key);
    for(const link of links){await deleteLink(base,key,link.id);done++;}
    toast(`${done}件を無効にしました。`,'success');
  });await fetchExistingLinks();}catch(e){toast(`${done}件を処理後に停止: ${e.message}`,'error');}
}

// ── Build self-contained QR HTML ─────────────────────────────
// Returns a full HTML string with the QR rendered as a data: PNG inline.
// Uses a hidden canvas trick: render QRCode into a temp div, grab the
// canvas toDataURL, then embed it as an <img src="data:...">.
// This way the file opens offline with no external dependencies.
function buildQrHtml(link) {
  link={...link,lnurl:C.lnurl(link.lnurl),sats:C.integer(link.sats)};
  // Render QR into a temp off-screen div to get a data URL
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
  document.body.appendChild(tmp);

  let dataUrl = '';
  try {
    new QRCode(tmp, {
      text: link.lnurl.toUpperCase(),
      width: 400, height: 400,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    const canvas = tmp.querySelector('canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('QR render failed:', e);
  } finally {
    document.body.removeChild(tmp);
  }

  const safeTitle = escHtml(link.title || 'LNURL Withdraw');
  const safeLnurl = escHtml(link.lnurl);
  const sats = (link.sats || 0).toLocaleString();

  // Embed a rendered QR; a missing library falls back to copyable text.
  const qrSection=dataUrl ? `<img src="${dataUrl}" alt="QR Code" width="340" height="340" style="display:block;margin:0 auto;border-radius:12px;" />` : '<p>QRを生成できませんでした。下のLNURLをコピーしてウォレットで開いてください。</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>⚡ ${safeTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Inter', sans-serif;
      background: #0d0d14;
      color: #e8e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    body::before {
      content: '';
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(247,147,26,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(247,147,26,0.03) 1px, transparent 1px);
      background-size: 48px 48px;
      pointer-events: none; z-index: 0;
    }
    .card {
      position: relative; z-index: 1;
      background: #1e1e32;
      border: 1px solid #2e2e4e;
      border-radius: 20px;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    }
    .logo { font-size: 2.8rem; margin-bottom: 0.5rem; filter: drop-shadow(0 0 12px rgba(255,215,0,0.5)); }
    h1 {
      font-size: 1.3rem; font-weight: 800; margin-bottom: 0.25rem;
      background: linear-gradient(135deg, #ffd700, #f7931a);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle { color: #9898b8; font-size: 0.88rem; margin-bottom: 1.8rem; }
    .qr-wrap {
      background: #fff;
      border-radius: 16px;
      padding: 1rem;
      display: inline-block;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .info-row {
      display: flex; justify-content: center; gap: 1.5rem;
      flex-wrap: wrap; margin-bottom: 1.2rem;
    }
    .badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.35rem 0.9rem; border-radius: 999px;
      font-size: 0.82rem; font-weight: 600;
    }
    .badge-sats  { background: rgba(247,147,26,0.12); color: #f7931a;  border: 1px solid rgba(247,147,26,0.3); }
    .badge-use   { background: rgba(34,197,94,0.12);  color: #22c55e;  border: 1px solid rgba(34,197,94,0.3); }
    .badge-exp   { background: rgba(59,130,246,0.12); color: #60a5fa;  border: 1px solid rgba(59,130,246,0.3); }
    .lnurl-box {
      background: #13131f;
      border: 1px solid #2e2e4e;
      border-radius: 10px;
      padding: 0.65rem 0.9rem;
      font-family: 'Courier New', monospace;
      font-size: 0.7rem;
      color: #9898b8;
      word-break: break-all;
      text-align: left;
      margin-bottom: 1.2rem;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .lnurl-box:hover { border-color: #f7931a; }
    .lnurl-label { font-size: 0.72rem; color: #5a5a7a; margin-bottom: 0.4rem; }
    .copy-btn {
      display: inline-flex; align-items: center; gap: 0.45rem;
      background: #25253d; border: 1px solid #3d3d60;
      border-radius: 10px; color: #e8e8f0;
      font-size: 0.85rem; font-weight: 600;
      padding: 0.6rem 1.4rem;
      cursor: pointer; transition: all 0.2s;
      font-family: inherit;
    }
    .copy-btn:hover { background: rgba(247,147,26,0.1); border-color: #f7931a; color: #f7931a; }
    .footer { margin-top: 1.5rem; font-size: 0.72rem; color: #5a5a7a; }
    .copied-msg { display: none; color: #22c55e; font-size: 0.8rem; margin-top: 0.5rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚡</div>
    <h1>${safeTitle}</h1>
    <p class="subtitle">Scan to claim your sats</p>

    <div class="qr-wrap">
      ${qrSection}
    </div>

    <div class="info-row">
      <span class="badge badge-sats">⚡ ${sats} sats</span>
      <span class="badge badge-use">✓ 1 use</span>
      <span class="badge badge-exp">∞ no expiry</span>
    </div>

    <div class="lnurl-box" onclick="copyLnurl()" title="Click to copy">
      <div class="lnurl-label">LNURL (click to copy)</div>
      <span id="lnurl-text">${safeLnurl}</span>
    </div>

    <button class="copy-btn" onclick="copyLnurl()">
      📋 Copy LNURL
    </button>
    <div class="copied-msg" id="copied-msg">✅ Copied!</div>

    <div class="footer">⚡ Lightning Network · LNURL-withdraw · scan with any Lightning wallet</div>
  </div>

  <script>
    function copyLnurl() {
      const text = document.getElementById('lnurl-text').textContent;
      navigator.clipboard.writeText(text).then(function() {
        const msg = document.getElementById('copied-msg');
        msg.style.display = 'block';
        setTimeout(function() { msg.style.display = 'none'; }, 2000);
      }).catch(function() {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
    }
  <` + `/script>
</body>
</html>`;
}

// ── Download single HTML file ──────────────────────────────────
function downloadSingleHtml(link) {
  if (!link.lnurl) { toast('No LNURL — cannot generate HTML.', 'error'); return; }
  const html     = buildQrHtml(link);
  const safeName = (link.title || 'lnurl').replace(/[^a-zA-Z0-9_\-#]/g, '_');
  const blob     = new Blob([html], { type: 'text/html' });
  const a        = document.createElement('a');
  a.href         = URL.createObjectURL(blob);
  a.download     = `${safeName}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Download all as ZIP ────────────────────────────────────────
async function downloadAllZip() {
  const active = batchLinks().filter(l => l.lnurl && !l.deleted);
  if (active.length === 0) { toast('No active links to export.', 'error'); return; }

  const btn = $('download-zip-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Building ZIP…';

  try {
    const zip = new JSZip();
    active.forEach((link,i) => {
      const html     = buildQrHtml(link);
      const safeName = (link.title || 'lnurl').replace(/[^a-zA-Z0-9_\-#]/g, '_');
      zip.file(`${i+1}-${safeName}.html`, html);
    });

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `lnurl-qr-pages-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`ZIP downloaded — ${active.length} HTML files`, 'success');
  } catch (e) {
    toast('ZIP build failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-archive"></i> Download all QR HTML (ZIP)';
  }
}

// ── QR Modal ───────────────────────────────────────────────────
function openQrModal(lnurl, title, sats) {
  $('qr-modal-title').textContent  = title || 'LNURL-Withdraw QR';
  $('qr-modal-sub').textContent    = `${(sats || 0).toLocaleString()} sats · 1 use · no expiry`;
  $('qr-modal-lnurl').textContent  = lnurl;
  const container = $('qr-modal-container');
  container.innerHTML = '';
  try {
    new QRCode(container, {
      text: lnurl.toUpperCase(),
      width: 240, height: 240,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch {}
  $('qr-modal').classList.add('open');
}

function closeQrModal() { $('qr-modal').classList.remove('open'); }

// ── Utility ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  loadSettings();
  updateCost();

  $('lnbits-url').addEventListener('input', saveSettings);
  $('api-key').addEventListener('input', saveSettings);
  $('sats-per-link').addEventListener('input', updateCost);
  $('link-count').addEventListener('input', updateCost);

  $('toggle-key-btn').addEventListener('click', toggleKey);
  $('check-balance-btn').addEventListener('click', checkBalance);
  $('generate-btn').addEventListener('click', generateLinks);
  $('resume-generate-btn').addEventListener('click',resumeLinks);
  $('pause-generate-btn').addEventListener('click',()=>{pauseGeneration=true;$('pause-generate-btn').disabled=true;});
  $('link-batch').addEventListener('change',()=>{selectedLinkBatch=$('link-batch').value;linkPage=0;renderGeneratedTable();});
  $('links-prev-btn').addEventListener('click',()=>{linkPage=Math.max(0,linkPage-1);renderGeneratedTable();});
  $('links-next-btn').addEventListener('click',()=>{linkPage++;renderGeneratedTable();});
  $('fetch-existing-btn').addEventListener('click', fetchExistingLinks);

  $('export-csv-btn').addEventListener('click', exportCsv);
  $('copy-lnurls-btn').addEventListener('click', copyAllLnurls);
  $('delete-used-btn').addEventListener('click', deleteUsedGenerated);
  $('delete-all-btn').addEventListener('click', deleteAllUnused);
  $('download-zip-btn').addEventListener('click', downloadAllZip);
  $('share-link-btn').addEventListener('click', copyShareableLink);

  // Load from shared URL hash (if present)
  if(window.location.hash.startsWith('#share='))tryLoadFromHash();
  else {try{generatedLinks=(await ledger.list('link')).map(fromRecord);if(generatedLinks.length){renderGeneratedTable();$('results-section').style.display='';}}catch(e){toast(e.message,'error');}}

  $('qr-close-btn').addEventListener('click', closeQrModal);
  $('qr-copy-btn').addEventListener('click', function () {
    const lnurl = $('qr-modal-lnurl').textContent;
    navigator.clipboard.writeText(lnurl).catch(() => {});
    toast('LNURL copied!', 'success', 2000);
  });
  $('qr-modal').addEventListener('click', function (e) {
    if (e.target === this) closeQrModal();
  });
});
