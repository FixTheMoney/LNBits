const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../js/gift-core.js');
// Synthetic checksummed BOLT11 fixture; no real signature or payee.
const invoice='lnbc1000n1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqtf5sfp';

test('Bulk Send checks the amount before its actual payment request',async()=>{
  const calls=[];
  const html=fs.readFileSync(require.resolve('../bulk-send.html'),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const context=vm.createContext({URL,AbortController,setTimeout,clearTimeout,document:{addEventListener(){}},fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({paid:true})};}});
  vm.runInContext(fs.readFileSync(require.resolve('../js/gift-core.js'),'utf8'),context);
  vm.runInContext(script+';globalThis.pay=payInvoice;',context);
  await assert.rejects(context.pay(invoice,'https://audit.invalid','DUMMY',50),/金額/);
  assert.equal(calls.length,0);
  await context.pay(invoice.toUpperCase(),'https://audit.invalid','DUMMY',100);
  assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].options.body).out,true);assert.equal(calls[0].options.redirect,'error');
});

test('QR Drop does not report expiry or completion when deletion fails',async()=>{
  let status=503,completed=0,timers=0;
  const elements=new Map();
  const source=fs.readFileSync(require.resolve('../js/app3.js'),'utf8');
  const boot=source.indexOf('// ── App init');assert.ok(boot>0);
  const context=vm.createContext({
    GiftCore:C,localStorage:{getItem:()=>null},
    document:{addEventListener(){},getElementById:id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id);}},
    fetch:async()=>({ok:status===204,status}),AbortSignal,
    confirm:()=>true,clearInterval(){},setTimeout(){timers++;},
    onComplete(){completed++;}
  });
  vm.runInContext(source.slice(0,boot)+`;toast=()=>{};showCompletePanel=onComplete;updateLogEntry=showQrState=setStatusDot=updateStats=()=>{};globalThis.api={State,onExpired,endSession,deleteLnurlLink};`,context);
  const {api}=context;
  Object.assign(api.State.config,{lnbitsUrl:'https://audit.invalid',apiKey:'DUMMY'});
  Object.assign(api.State.session,{active:true,currentLinkId:'link',currentRound:1});
  await assert.rejects(api.deleteLnurlLink('link'),/HTTP 503/);
  await api.onExpired();assert.equal(api.State.session.expiredCount,0);assert.equal(timers,0);assert.match(elements.get('qr-status-text').textContent,/失効未確認/);
  await api.endSession();assert.equal(completed,0);assert.equal(api.State.session.active,true);
  status=204;await api.endSession();assert.equal(completed,1);assert.equal(api.State.session.active,false);
});

test('downloaded QR HTML escapes titles and rejects malicious LNURLs even without the QR library',()=>{
  const source=fs.readFileSync(require.resolve('../js/generate-links.js'),'utf8');
  const context=vm.createContext({GiftCore:{...C,Ledger:class{}},
    document:{addEventListener(){},createElement:()=>({style:{},querySelector:()=>null}),body:{appendChild(){},removeChild(){}}},console:{warn(){}}
  });
  vm.runInContext(source+';globalThis.build=buildQrHtml;',context);
  const lnurl=C.lnurlEncode('https://audit.invalid/withdraw/example');
  const html=context.build({title:'</title><svg onload="attack()">日本語',lnurl,sats:100});
  assert.ok(html.includes('&lt;svg onload=&quot;attack()&quot;&gt;日本語'));
  assert.ok(html.includes(lnurl));assert.ok(!/<svg|<script\s+src/i.test(html));
  assert.throws(()=>context.build({title:'ok',lnurl:'lnurl1<svg/onload=attack()>',sats:100}));
});
