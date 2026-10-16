const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../js/gift-core.js');
function harness({request,write=async()=>{},read}) {
  let current;
  const context=vm.createContext({GiftCore:{...C,request,Ledger:class{get(){return read?read():structuredClone(current);}  put(row){return write(structuredClone(row));}}},GiftIssuance:require('../js/issuance.js'),document:{addEventListener(){}},console,setTimeout,clearTimeout,URL});
  vm.runInContext(fs.readFileSync(require.resolve('../js/prepaid-card.js'),'utf8')+';globalThis.checkCard=verifyCard;',context);
  return (row,conn)=>{current=row;return context.checkCard(row,conn);};
}
const base=()=>({id:'r',kind:'card',walletId:'w',userId:'u',lnbitsUrl:'https://audit.invalid',invoiceKey:'dummy',paymentHash:'b'.repeat(64),state:'verified',active:true,fundedSats:100,balanceSats:100});
test('topup marker survives a later read failure and clears only on successful durable verification',async()=>{
  let fail=true;const saved=[];
  const check=harness({request:async(url)=>{
    if(url.endsWith('b'.repeat(64))&&fail)throw new Error('original payment lookup fails');
    return url.endsWith('/wallet')?{id:'w',user:'u',balance:200000}:{paid:true};
  },write:async(row)=>saved.push(row)});
  const row={...base(),pendingTopup:{state:'payment_pending',paymentHash:'a'.repeat(64),sats:100,targetFunded:200}};
  await assert.rejects(check(row,{url:row.lnbitsUrl}),/lookup fails/);
  assert.equal(row.fundedSats,100);assert.ok(row.pendingTopup);assert.equal(saved.length,0);
  fail=false;await check(row,{url:row.lnbitsUrl});assert.equal(row.pendingTopup,null);assert.equal(row.fundedSats,200);assert.equal(saved.length,1);
});
test('storage failure does not clear the in-memory pending topup',async()=>{
  const check=harness({request:async(url)=>url.endsWith('/wallet')?{id:'w',balance:200000}:{paid:true},write:async()=>{throw new Error('storage failed');}});
  const row={...base(),pendingTopup:{state:'payment_pending',paymentHash:'a'.repeat(64),targetFunded:200}};
  await assert.rejects(check(row,{url:row.lnbitsUrl}),/storage/);assert.ok(row.pendingTopup);assert.equal(row.fundedSats,100);
});
test('a spent card remains manageable but cannot be re-exported as a fully funded card',async()=>{
  const check=harness({request:async(url)=>url.endsWith('/wallet')?{id:'w',balance:25000}:{paid:true}}),row=base();
  await check(row,{url:row.lnbitsUrl});assert.equal(row.state,'verified');assert.equal(row.balanceSats,25);
  assert.throws(()=>C.cardCsv([{...row,batchId:'b',accessUrl:'https://audit.invalid/wallet?wal=w'}]),/確認/);
});
test('legacy records can be reconciled read-only without inventing a missing payment hash',async()=>{
  let reads=0;
  const check=harness({request:async()=>{reads++;return{id:'w',user:'u',balance:100000};}});
  const row={...base(),paymentHash:undefined,legacyImported:true,state:'legacy_unverified'};
  await check(row,{url:row.lnbitsUrl});assert.equal(reads,1);assert.equal(row.state,'verified');assert.equal(row.balanceSats,100);
});
test('stale card refresh cannot overwrite another tab pending topup or deactivation',async()=>{
  const saved={...base(),pendingTopup:{state:'payment_pending',paymentHash:'a'.repeat(64),targetFunded:200}};
  let writes=0;
  const check=harness({read:async()=>structuredClone(saved),request:async()=>({paid:false}),write:async()=>{writes++;}});
  const stale=base();await assert.rejects(check(stale,{url:stale.lnbitsUrl}),/追加の入金/);
  assert.ok(stale.pendingTopup);assert.equal(writes,0);
  saved.state='deactivated';saved.active=false;
  await assert.rejects(check(stale,{url:stale.lnbitsUrl}),/再有効化/);assert.equal(writes,0);
});
test('stale topup only reconciles a persisted pending payment instead of making a new one',async()=>{
  let saved={...base(),ownerWalletId:'owner',pendingTopup:{state:'payment_pending',paymentHash:'a'.repeat(64),sats:100,targetFunded:200}};
  const requests=[],elements=new Map();let modalClosed=false;
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:'',classList:{remove(){if(id==='topup-modal')modalClosed=true;}},appendChild(){}});
    return elements.get(id);
  };
  element('lnbits-url').value=saved.lnbitsUrl;element('api-key').value='DUMMY_OWNER';
  const context=vm.createContext({
    GiftCore:{...C,exclusive:async f=>f(),request:async(url,opts)=>{
      requests.push({url,opts});
      return url.endsWith('/wallet')?(opts.headers['X-Api-Key']==='DUMMY_OWNER'?{id:'owner'}:{id:'w',balance:200000}):{paid:true};
    },Ledger:class{async get(){return structuredClone(saved);}async put(row){saved=structuredClone(row);}}},
    GiftIssuance:require('../js/issuance.js'),document:{addEventListener(){},getElementById:element},URL
  });
  context.stale={...base(),ownerWalletId:'owner'};
  vm.runInContext(fs.readFileSync(require.resolve('../js/prepaid-card.js'),'utf8')+';cards=[stale];topupIdx=0;renderCardsTable=toast=()=>{};globalThis.topup=doTopup;',context);
  await context.topup();
  assert.equal(saved.pendingTopup,null);assert.equal(saved.fundedSats,200);
  assert.equal(requests.filter(r=>r.opts.method==='POST').length,0);
  assert.equal(modalClosed,true);
});
