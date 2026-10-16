const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../js/gift-core.js');

function harness() {
  const elements=new Map(),requests=[],saved=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:'',textContent:'',appendChild(){},classList:{add(){},remove(){}}});
    return elements.get(id);
  };
  const row={id:'link-a',recordId:'record-a',distributionId:'record-a',kind:'link',title:'test',sats:100,state:'verified',lnbitsUrl:'https://a.invalid',ownerWalletId:'wallet-a',deleted:false};
  const context=vm.createContext({
    GiftCore:{...C,exclusive:async f=>f(),request:async(url,options)=>{
      requests.push({url,key:options.headers['X-Api-Key']});return{id:'wallet-a'};
    },Ledger:class{async get(){return row;}async put(r){saved.push(r);}}},
    document:{getElementById:element,createElement:()=>({remove(){}}),addEventListener(){}},
    fetch:async(url,options)=>{requests.push({url,key:options.headers['X-Api-Key'],method:options.method||'GET'});return{ok:true,status:200,json:async()=>({used:false})};},
    confirm:()=>true,setTimeout:()=>0,clearTimeout(){},AbortSignal,URL,console
  });
  context.record=row;
  vm.runInContext(fs.readFileSync(require.resolve('../js/generate-links.js'),'utf8')+';generatedLinks=[record];renderGeneratedTable=()=>{};globalThis.api={handleLinkAction,discoverWithdrawBase,checkExistingConnection};',context);
  element('lnbits-url').value=row.lnbitsUrl;element('api-key').value='DUMMY_A';
  return {api:context.api,row,requests,saved,element};
}

test('changing connection cannot send a new key to a previously discovered server',async()=>{
  const h=harness();
  await h.api.discoverWithdrawBase('https://a.invalid','DUMMY_A');
  h.requests.length=0;h.element('lnbits-url').value='https://b.invalid';h.element('api-key').value='DUMMY_B';
  await h.api.handleLinkAction('delete',0);
  assert.equal(h.requests.length,0);assert.equal(h.saved.length,0);assert.equal(h.row.deleted,false);
  assert.throws(()=>h.api.checkExistingConnection('https://a.invalid/withdraw/api/v1','DUMMY_A'),/変わりました/);
});

test('same-origin records still require the original owner wallet',async()=>{
  const h=harness();h.row.ownerWalletId='different-wallet';
  await h.api.handleLinkAction('delete',0);
  assert.equal(h.requests.length,1);assert.ok(h.requests[0].url.endsWith('/wallet'));
  assert.equal(h.saved.length,0);assert.equal(h.row.deleted,false);
});

test('a matching connection can void a link and persist the result',async()=>{
  const h=harness();await h.api.handleLinkAction('delete',0);
  const mutation=h.requests.find(r=>r.method==='DELETE');
  assert.equal(mutation.url,'https://a.invalid/withdraw/api/v1/links/link-a');
  assert.equal(mutation.key,'DUMMY_A');assert.equal(h.saved.length,1);assert.equal(h.saved[0].deleted,true);
});
