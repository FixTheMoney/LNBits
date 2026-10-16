(function(root,factory){
  const core=typeof module==='object'&&module.exports?require('./gift-core.js'):root.GiftCore;
  const api=factory(core);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GiftIssuance=api;
})(typeof globalThis==='object'?globalThis:this,function(C){
  'use strict';
  const stamp=()=>new Date().toISOString();
  async function save(store,row,patch={}) { Object.assign(row,patch,{updatedAt:stamp()}); await store.put(row); }
  async function card(store,row,api) {
    C.integer(row.fundedSats,Math.floor(Number.MAX_SAFE_INTEGER/1000));
    if(row.state==='verified') return row;
    if(row.state==='verification_pending' && row.paymentHash) await save(store,row,{state:'payment_pending'});
    if(row.state==='creating_wallet' || row.state==='wallet_unknown') throw new Error('ウォレット作成結果が不明です。自動で作り直さず、記録IDから照合してください。');
    if(row.state==='planned') {
      await save(store,row,{state:'creating_wallet'});
      const data=await api.createWallet(row.name+' ['+row.id+']');
      Object.assign(row,{walletId:data.id,invoiceKey:data.inkey,adminKey:data.adminkey,state:'wallet_created'});
      await save(store,row);
    }
    if(!row.walletId || !row.invoiceKey) throw new Error('ウォレット情報が不足しています。自動入金を停止しました。');
    if(['wallet_created','creating_invoice'].includes(row.state)) {
      const info=await api.info(row.invoiceKey);
      if(info.id!==row.walletId || typeof info.user!=='string') throw new Error('ウォレットの照合に失敗しました。');
      row.userId=info.user;
      row.accessUrl=C.httpUrl(row.lnbitsUrl+'/wallet?usr='+encodeURIComponent(info.user)+'&wal='+encodeURIComponent(row.walletId));
      await save(store,row,{state:'creating_invoice'});
      const invoice=await api.invoice(row.invoiceKey,row.fundedSats,'Fund '+row.id);
      invoice.payment_request=invoice.payment_request||invoice.bolt11;
      C.assertInvoice(invoice.payment_request,row.fundedSats*1000);
      if(typeof invoice.payment_hash!=='string' || !/^[a-f0-9]{64}$/i.test(invoice.payment_hash)) throw new Error('請求書の照合IDがありません。支払いを停止しました。');
      await save(store,row,{state:'invoice_created',bolt11:invoice.payment_request,paymentHash:invoice.payment_hash});
    }
    if(row.state==='invoice_created') {
      C.assertInvoice(row.bolt11,row.fundedSats*1000);
      await save(store,row,{state:'payment_pending'});
      // A pending payment is never submitted again, including after a timeout or reload.
      await api.pay(row.bolt11,row.fundedSats*1000);
    }
    if(row.state==='payment_pending') {
      const payment=await api.payment(row.invoiceKey,row.paymentHash);
      const info=await api.info(row.invoiceKey);
      const balance=Number(info.balance)/1000;
      await save(store,row,{balanceSats:balance});
      if(payment.paid!==true || info.id!==row.walletId || balance!==row.fundedSats) throw new Error('入金確認待ちです。再開時は状態だけを確認し、再送金しません。');
      await save(store,row,{state:'verified',active:true,verifiedAt:stamp(),error:null});
    }
    return row;
  }
  async function link(store,row,api) {
    if(row.state==='verified') return row;
    if(row.state==='creating_link' || row.state==='creation_unknown') throw new Error('リンクの作成結果が不明です。自動で重複作成せず照合してください。');
    if(row.state==='planned') {
      await save(store,row,{state:'creating_link'});
      const result=await api.create(row.sats,row.title);
      if(typeof result.id!=='string' || !result.id) throw new Error('リンクIDを確認できません。作成結果の照合が必要です。');
      await save(store,row,{linkId:result.id,state:'link_created'});
    }
    if(row.state==='link_created') {
      const data=await api.info(row.linkId);
      if(data.id!==row.linkId || data.min_withdrawable!==row.sats || data.max_withdrawable!==row.sats || data.uses!==1 || ![0,false].includes(data.used) || data.enabled===false || (data.currency && data.currency.toLowerCase()!=='sat')) throw new Error('引き出し額・利用回数・状態を確認できません。配布対象から除外しました。');
      const raw=data.lnurl_url||data.lnurl||data.lnurl_full||data.lnurl_encoded;
      const encoded=C.lnurl(raw);
      const shared=data.shareable_link||data.shareableLink||data.share_link||data.lnurl_url;
      if(!shared) throw new Error('配布用HTTPSリンクを確認できません。');
      const url=C.httpUrl(shared);
      await save(store,row,{state:'verified',lnurl:encoded,shareableLink:url,verifiedAt:stamp(),used:false,deleted:false,error:null});
    }
    return row;
  }
  async function transfer(store,row,api) {
    const msats=C.integer(row.sats,Math.floor(Number.MAX_SAFE_INTEGER/1000))*1000;
    C.assertInvoice(row.bolt11,msats);
    if(C.invoicePaymentHash(row.bolt11)!==row.paymentHash) throw new Error('請求書と支払い照合IDが一致しません。');
    if(row.state==='verified') return row;
    if(row.state==='invoice_created') {
      await save(store,row,{state:'payment_pending'});
      await api.pay(row.bolt11,row.sats);
    }
    if(row.state!=='payment_pending') throw new Error('送金記録の状態を確認できません。');
    const payment=await api.payment(row.paymentHash);
    if(payment.paid!==true) throw new Error('送金結果が未確認です。再押下時は照合だけを行い、再送金しません。');
    await save(store,row,{state:'verified',verifiedAt:stamp(),error:null});
    return row;
  }
  async function run(store,rows,process,{paused=()=>false,onProgress=()=>{}}={}) {
    for(let i=0;i<rows.length;i++) {
      if(paused()) break;
      const row=rows[i];
      if(row.state==='verified') {onProgress(i+1,rows.length,row);continue;}
      try { await process(store,row); }
      catch(e) {
        row.error=e.message;
        // If saving fails, abort the whole batch. Previous pre-operation marker remains durable.
        await save(store,row);
        onProgress(i+1,rows.length,row);
        throw e;
      }
      onProgress(i+1,rows.length,row);
    }
  }
  return {card,link,transfer,run,save};
});
