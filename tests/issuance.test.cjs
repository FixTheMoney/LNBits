'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../js/gift-core.js');
const I=require('../js/issuance.js');

// Synthetic checksummed invoice: 1000 nano-BTC = 100 sats. No real invoice/payee.
function invoice(hrp='lnbc1000n') {
  const alphabet='qpzry9x8gf2tvdw0s3jn54khce6mua7l',data=Array(110).fill(0);
  const expanded=[...hrp].map(c=>c.charCodeAt(0)>>5).concat(0,[...hrp].map(c=>c.charCodeAt(0)&31));
  let check=1;
  for(const v of expanded.concat(data,[0,0,0,0,0,0])) {
    const top=check>>>25;check=((check&0x1ffffff)<<5)^v;
    [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3].forEach((g,i)=>{if((top>>>i)&1)check^=g;});
  }
  check^=1;
  return hrp+'1'+data.concat(Array.from({length:6},(_,i)=>(check>>>(5*(5-i)))&31)).map(n=>alphabet[n]).join('');
}
class Store {
  constructor(reject=()=>false){this.rows=new Map();this.reject=reject;}
  async put(row){if(this.reject(row))throw new Error('mock storage failure');this.rows.set(row.id,structuredClone(row));}
  async get(id){return structuredClone(this.rows.get(id));}
}
const card=(id='one')=>({id,kind:'card',batchId:'batch',name:'Card '+id,state:'planned',lnbitsUrl:'https://audit.invalid',fundedSats:100,balanceSats:0,active:false});
function api(options={}) {
  const count={created:0,paid:0};let walletId='wallet-one';
  return {count,
    createWallet:async name=>{count.created++;walletId='wallet-'+name.match(/\[(.*)\]$/)[1];return{id:walletId,inkey:'dummy-invoice-key',adminkey:'dummy-card-key'};},
    info:async()=>{if(count.paid&&options.balanceFailure)throw new Error('mock balance failure');return{id:walletId,user:'dummy-user',balance:options.zero?0:100000};},
    invoice:async()=>({payment_request:invoice(options.mismatch?'lnbc2000n':undefined),payment_hash:'a'.repeat(64)}),
    pay:async()=>{count.paid++;if(options.payTimeout)throw new Error('mock response timeout');},
    payment:async()=>({paid:true})
  };
}
test('records wallet authority before funding and verifies payment and exact balance',async()=>{
  const store=new Store(),row=card(),a=api();await store.put(row);await I.card(store,row,a);
  const saved=await store.get(row.id);
  assert.equal(saved.state,'verified');assert.equal(saved.balanceSats,100);assert.equal(a.count.paid,1);
  assert.match(C.cardCsv([saved]),/verified/);assert.doesNotMatch(C.cardCsv([saved]),/dummy-card-key|dummy-invoice-key|invoice_key/);
});
test('balance failure after funding retains IDs and never resends on resume',async()=>{
  const store=new Store(),row=card(),options={balanceFailure:true},a=api(options);
  await assert.rejects(I.card(store,row,a),/balance failure/);
  const saved=await store.get(row.id);assert.equal(saved.state,'payment_pending');assert.equal(saved.walletId,'wallet-one');assert.equal(saved.paymentHash.length,64);
  options.balanceFailure=false;await I.card(store,saved,a);assert.equal(a.count.created,1);assert.equal(a.count.paid,1);assert.equal(saved.state,'verified');
});
test('zero balance is not successful and cannot enter the CSV',async()=>{
  const store=new Store(),row=card(),a=api({zero:true});await assert.rejects(I.card(store,row,a),/入金確認待ち/);
  assert.equal((await store.get(row.id)).state,'payment_pending');assert.throws(()=>C.cardCsv([row]),/確認/);
});
test('payment response timeout is reconciled without another payment',async()=>{
  const store=new Store(),row=card(),a=api({payTimeout:true});await assert.rejects(I.card(store,row,a),/timeout/);
  const saved=await store.get(row.id);await I.card(store,saved,a);assert.equal(a.count.paid,1);assert.equal(saved.state,'verified');
});
test('storage failure before a mutation prevents that mutation',async()=>{
  const store=new Store(r=>r.state==='creating_wallet'),a=api();await assert.rejects(I.card(store,card(),a),/storage/);assert.equal(a.count.created,0);
  const beforePay=new Store(r=>r.state==='payment_pending'),b=api();await assert.rejects(I.card(beforePay,card(),b),/storage/);assert.equal(b.count.paid,0);
});
test('post-payment storage failure leaves a durable pending payment for reconciliation',async()=>{
  const store=new Store(r=>r.state==='verified'),a=api(),row=card();await assert.rejects(I.card(store,row,a),/storage/);
  assert.equal((await store.get(row.id)).state,'payment_pending');assert.equal(a.count.paid,1);
});
test('unknown wallet creation cannot be replayed automatically',async()=>{
  const store=new Store(),row=card(),a=api();row.state='creating_wallet';await assert.rejects(I.card(store,row,a),/不明/);assert.equal(a.count.created,0);
});
test('invoice with a higher amount is rejected before payment',async()=>{
  const store=new Store(),row=card(),a=api({mismatch:true});await assert.rejects(I.card(store,row,a),/金額/);assert.equal(a.count.paid,0);
});
test('link amount/usage mismatch preserves the created ID without retrying creation',async()=>{
  const store=new Store(),row={id:'r',kind:'link',state:'planned',title:'Title',sats:100};let calls=0;
  const a={create:async()=>{calls++;return{id:'remote'};},info:async()=>({id:'remote',min_withdrawable:100000,max_withdrawable:100000,uses:1,used:0})};
  await assert.rejects(I.link(store,row,a),/引き出し額/);assert.equal((await store.get('r')).linkId,'remote');
  await assert.rejects(I.link(store,await store.get('r'),a));assert.equal(calls,1);
});
test('shared input rejects script payloads, bad types/checksums and accepts legitimate long LNURLs',()=>{
  const valid=C.lnurlEncode('https://audit.invalid/withdraw/'+('x'.repeat(180)));
  const title='日本語 "quoted" <text>, next\nline';
  assert.equal(C.sharedRows([{t:title,l:'lightning:'+valid.toUpperCase(),s:100}])[0].title,title);
  assert.equal(C.lnurl(valid.toUpperCase()),valid);
  for(const item of [{t:'t',l:'<svg/onload=alert(1)>',s:1},{t:'t',l:'lnurl1<svg>',s:1},{t:'t',l:valid,s:'<svg>'},{t:'t',l:valid,s:{}},{t:'t',l:valid.slice(0,-1)+'!',s:1},null])assert.throws(()=>C.sharedRows([item]));
  assert.throws(()=>C.sharedRows([{t:'safe',l:valid,s:1},null]));
  for(const url of ['javascript:alert(1)','data:text/html,test','https://user:pass@audit.invalid','https://audit.invalid/"onclick=x','https://audit.invalid\\@evil.invalid'])assert.throws(()=>C.httpUrl(url));
});
test('CSV quotes delimiters/newlines, blocks duplicate and unverified records, omits credentials',()=>{
  assert.match(C.csv([['a,b','x"y','line\nbreak','=1+1']]),/"a,b","x""y","line\nbreak","'=1\+1"/);
  const row={...card(),walletId:'w',accessUrl:'https://audit.invalid/wallet?wal=w',balanceSats:100,state:'verified',active:true,verifiedAt:'now'};
  assert.throws(()=>C.cardCsv([row,row]),/重複/);assert.throws(()=>C.cardCsv([{...row,pendingTopup:{}}]),/確認/);
});
test('30000 simulated cards complete with unique durable records and matching CSV count',async()=>{
  const store=new Store(),rows=Array.from({length:30000},(_,i)=>card(String(i))),a=api();
  await I.run(store,rows,(db,row)=>I.card(db,row,a));
  assert.equal(store.rows.size,30000);assert.equal(a.count.created,30000);assert.equal(a.count.paid,30000);
  const text=C.cardCsv(rows);assert.equal(text.split('\r\n').length,30002);
});
test('3000 simulated links retain unique distributions and pass export validation',async()=>{
  const store=new Store(),rows=Array.from({length:3000},(_,i)=>({id:'row-'+i,kind:'link',batchId:'b',state:'planned',title:'Link '+i,sats:100}));
  const a={create:async(_s,title)=>({id:title.split(' ')[1]}),info:async id=>({id,min_withdrawable:100,max_withdrawable:100,uses:1,used:0,lnurl_url:'https://audit.invalid/withdraw/'+id})};
  await I.run(store,rows,(db,row)=>I.link(db,row,a));
  const mapped=rows.map(r=>({...r,id:r.linkId,distributionId:r.id}));assert.equal(C.linkCsv(mapped).split('\r\n').length,3002);
});
module.exports={invoice};
