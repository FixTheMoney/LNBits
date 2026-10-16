'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../js/gift-core.js');
const I=require('../js/issuance.js');
const {invoice}=require('./helpers/bolt11.cjs');

function harness(options={}) {
  const saved=options.saved||new Map(),calls=[],elements=new Map();let sequence=0;
  const el=id=>{
    if(!elements.has(id)) elements.set(id,{value:'',style:{},appendChild(){},querySelectorAll:()=>[]});
    return elements.get(id);
  };
  el('lnbits-url').value='https://wallet.invalid';el('api-key').value='DUMMY';
  const request=async(url,opts={})=>{
    calls.push({url,opts});
    if(url.endsWith('/wallet')) return {id:options.owner||'owner'};
    if(url.includes('/.well-known/')) return {tag:'payRequest',minSendable:1,maxSendable:1000000,callback:options.callback||'https://recipient.invalid/invoice?amount=1&other=keep'};
    if(url.startsWith('https://recipient.invalid/')) return {pr:invoice()};
    if(opts.method==='POST') {if(options.timeout) throw new Error('response timeout');return {payment_hash:'a'.repeat(64)};}
    if(url.includes('/payments/')) return {paid:options.paid!==false};
    throw new Error('Unexpected request '+url);
  };
  const context=vm.createContext({
    GiftCore:{...C,request,id:()=>`payment-${++sequence}`,exclusive:async f=>f(),Ledger:class {
      async open(){} async list(){return [...saved.values()].map(row=>structuredClone(row));}
      async get(id){return structuredClone(saved.get(id));}
      async put(row){if(options.storageFailure || row.state===options.storageFailureState) throw new Error('storage failed');saved.set(row.id,structuredClone(row));}
    }},GiftIssuance:I,URL,console,document:{getElementById:el,addEventListener(){}}
  });
  const source=fs.readFileSync(require.resolve('../bulk-send.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(source+`;renderRows=updateSendBtn=saveSettings=log=toast=()=>{};recordSuccessfulPayment=()=>{if(globalThis.addressBookFailure)throw new Error('address book full');};globalThis.api={sendAll,resetStatuses,clearAll,getInvoice,resolveLightningAddress,restorePendingPayments,getRows:()=>rows,setRows:value=>{rows=value;}};`,context);
  context.addressBookFailure=options.addressBookFailure;
  context.api.setRows([{id:1,address:'alice@recipient.invalid',sats:'100',status:'idle'}]);
  return {api:context.api,calls,saved,el};
}
const payments=h=>h.calls.filter(c=>c.opts.method==='POST');

test('bulk send saves before paying and skips settled rows after reset or repeated click',async()=>{
  const h=harness({addressBookFailure:true});
  await h.api.sendAll();await h.api.resetStatuses();await h.api.sendAll();
  assert.equal(payments(h).length,1);assert.equal(h.api.getRows()[0].status,'ok');
  assert.equal([...h.saved.values()][0].state,'verified');
  assert.ok(!JSON.stringify([...h.saved.values()]).includes('DUMMY'));
  const callback=h.calls.find(c=>c.url.startsWith('https://recipient.invalid/invoice'));
  assert.equal(new URL(callback.url).searchParams.getAll('amount').length,1);
  assert.equal(new URL(callback.url).searchParams.get('amount'),'100000');
});
test('bulk timeout stops the batch and reload only reconciles the original payment',async()=>{
  const options={timeout:true},h=harness(options);
  h.api.getRows().push({id:2,address:'bob@recipient.invalid',sats:'100',status:'idle'});
  await h.api.sendAll();assert.equal(payments(h).length,1);assert.equal(h.api.getRows()[1].status,'idle');
  assert.equal([...h.saved.values()][0].state,'payment_pending');
  const next=harness({saved:h.saved});next.api.setRows([]);
  await next.api.restorePendingPayments();await next.api.sendAll();
  assert.equal(payments(next).length,0);assert.equal(next.api.getRows()[0].status,'ok');
  assert.ok(!next.calls.some(c=>c.url.includes('/.well-known/')));
});
test('an unsettled payment stays pending and cannot be reset or cleared',async()=>{
  const h=harness({paid:false});await h.api.sendAll();await h.api.resetStatuses();await h.api.clearAll();await h.api.sendAll();
  assert.equal(payments(h).length,1);assert.equal(h.api.getRows()[0].status,'pending');
  assert.equal([...h.saved.values()][0].state,'payment_pending');
});
test('recovering another tab payment does not send the stale recipient list on the same click',async()=>{
  const h=harness({timeout:true});await h.api.sendAll();
  const next=harness({saved:h.saved});await next.api.sendAll();
  assert.equal(payments(next).length,0);
  assert.equal(next.api.getRows()[0].status,'idle');assert.equal(next.api.getRows()[1].status,'ok');
});
test('bulk storage failure prevents the outgoing payment',async()=>{
  const h=harness({storageFailure:true});await h.api.sendAll();assert.equal(payments(h).length,0);
});
test('storage failure after paying retains the pending record and never resends after reload',async()=>{
  const h=harness({storageFailureState:'verified'});await h.api.sendAll();
  assert.equal(payments(h).length,1);assert.equal([...h.saved.values()][0].state,'payment_pending');
  const next=harness({saved:h.saved});next.api.setRows([]);await next.api.sendAll();
  assert.equal(payments(next).length,0);assert.equal([...next.saved.values()][0].state,'verified');
});
test('restored bulk payment cannot be checked or sent using another wallet',async()=>{
  const h=harness({timeout:true});await h.api.sendAll();
  const next=harness({saved:h.saved,owner:'different'});next.api.setRows([]);await next.api.sendAll();
  assert.equal(payments(next).length,0);assert.equal(next.api.getRows()[0].status,'pending');
  assert.ok(!next.calls.some(c=>c.url.includes('/payments/')));
});
test('fractional amounts and unsafe invoice callbacks fail before payment',async()=>{
  const h=harness();h.api.getRows()[0].sats='100.9';await h.api.sendAll();assert.equal(payments(h).length,0);
  const unsafe=harness({callback:'http://recipient.invalid/invoice'});await unsafe.api.sendAll();assert.equal(payments(unsafe).length,0);
  assert.ok(!unsafe.calls.some(c=>c.url.startsWith('http:')));
});
test('BOLT11 payment hash parser accepts uppercase and rejects missing, duplicate or truncated tags',()=>{
  assert.equal(C.invoicePaymentHash(invoice().toUpperCase()),'a'.repeat(64));
  for(const fields of [[],[1,1,20,...Array(51).fill(0)],[1,1,20,...Array(52).fill(0),1,1,20,...Array(52).fill(0)]]) assert.throws(()=>C.invoicePaymentHash(invoice({fields})));
});
