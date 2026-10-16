
/* ================================================================
   Prepaid Lightning Cards — app
   ================================================================
   Mechanism:
     1. POST /api/v1/wallets          → create named sub-wallet
     2. GET  /api/v1/wallet (sub-key) → confirm creation + get IDs
     3. POST /api/v1/payments         → fund sub-wallet by paying its
                                        invoice from the admin wallet
        (Create invoice on sub-wallet, pay it from admin wallet)
     4. Sub-wallet URL: {LNBITS_URL}/wallet?usr={usr}&wal={wal_id}
        → cardholder opens this URL to see balance and pay merchants
     5. DELETE /api/v1/wallets/{id}   → deactivate (destroys balance!)

   Storage:
     lnbits_url         → shared LNbits URL
     管理キーはメモリ内のみ。作成記録は IndexedDB に保存。
     prepaid_cards      → 旧記録の移行元（元データは残す）
   ================================================================ */

const LS_URL   = 'lnbits_url';
const LS_KEY   = 'lnbits_api_key';
const LS_CARDS = 'prepaid_cards';
const C = GiftCore;
const ledger = new C.Ledger();
let selectedCardBatch='';
function batchCards(){return selectedCardBatch?cards.filter(c=>c.batchId===selectedCardBatch):cards;}
let cardPage = 0;
const cardPageSize = 100;
let pauseCreation = false;

// ── State ──────────────────────────────────────────────────────
let cards      = [];   // array of card objects (this session + loaded)
let creating   = false;
let qrModalCard = null; // card currently shown in QR modal

// ── DOM ────────────────────────────────────────────────────────
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
  $('api-key').value = '';
  try {C.clearLegacyKey(localStorage);$('lnbits-url').value=localStorage.getItem(LS_URL)||tryQrDropConfig('lnbitsUrl')||'';}
  catch {toast('ブラウザの設定保存を利用できません。接続先を入力してください。','error');}
}
function tryQrDropConfig(field) {
  try { return JSON.parse(localStorage.getItem('lnqr_config') || '{}')[field] || ''; } catch { return ''; }
}
function saveSettings() {try{localStorage.setItem(LS_URL, $('lnbits-url').value.trim());}catch{}}
function getConn() { return {url:$('lnbits-url').value.trim().replace(/\/$/,''), key:$('api-key').value.trim()}; }

// ── Key visibility ─────────────────────────────────────────────
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
  const sats  = parseInt($('card-sats').value)  || 0;
  const count = parseInt($('card-count').value) || 0;
  $('total-cost-display').textContent = (sats * count).toLocaleString() + ' sats';
  $('total-cost-note').textContent = `for ${count} card${count !== 1 ? 's' : ''}`;
}

// ── Saved cards storage ────────────────────────────────────────
async function loadSavedCards() { return ledger.list('card'); }
async function mergeAndSave(newCards) {
  for (const card of newCards) {
    if (!card.id) throw new Error('記録IDがないため保存を停止しました。');
    await ledger.put(card);
  }
}
async function migrateSavedCards() {
  const raw=localStorage.getItem(LS_CARDS);
  if(!raw || await ledger.get('migration:prepaid-v1')) return;
  const saved=JSON.parse(raw);
  if(!Array.isArray(saved)) throw new Error('以前の保存データが不正です。削除せず停止しました。');
  for(const old of saved) {
    if(!old.walletId || !old.lnbitsUrl) throw new Error('以前の記録に接続先やIDがありません。元データは保持しています。');
    const id='legacy:'+old.lnbitsUrl+':'+old.walletId;
    if(!await ledger.get(id))await ledger.put({...old,id,kind:'card',batchId:'legacy',legacyImported:true,state:old.active?'legacy_unverified':'deactivated',active:false});
  }
  await ledger.put({id:'migration:prepaid-v1',kind:'migration'});
  // Keep the old copy until the owner has backed up the migrated records.
}

// ── Create sub-wallet ──────────────────────────────────────────
// POST /api/v1/wallets — creates a new wallet under the same user
// Returns { id, name, adminkey, inkey }
async function createSubWallet(adminKey,url,name) {
  return C.request(url+'/api/v1/wallets',{method:'POST',headers:{'X-Api-Key':adminKey,'Content-Type':'application/json'},body:JSON.stringify({name})});
}

// ── Get wallet info (balance, user id) ────────────────────────
async function getWalletInfo(invoiceKey,url) { return C.request(url+'/api/v1/wallet',{headers:{'X-Api-Key':invoiceKey}}); }

// ── Create an invoice on the sub-wallet ──────────────────────
// We pay this invoice FROM the admin wallet to fund the sub-wallet
async function createSubInvoice(invoiceKey,url,msats,memo) {
  return C.request(url+'/api/v1/payments',{method:'POST',headers:{'X-Api-Key':invoiceKey,'Content-Type':'application/json'},body:JSON.stringify({out:false,amount:msats,unit:'msat',memo})});
}

// ── Pay invoice from admin wallet (funds the sub-wallet) ──────
async function payInvoiceFromAdmin(adminKey,url,bolt11,msats) {
  C.assertInvoice(bolt11,msats);
  return C.request(url+'/api/v1/payments',{method:'POST',headers:{'X-Api-Key':adminKey,'Content-Type':'application/json'},body:JSON.stringify({out:true,bolt11})});
}

// ── Get live balance of a sub-wallet ──────────────────────────
async function fetchSubBalance(invoiceKey, url) {
  const res = await fetch(`${url}/api/v1/wallet`, { headers: { 'X-Api-Key': invoiceKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return Math.floor(d.balance / 1000); // msats → sats
}

// ── Delete a sub-wallet (deactivate) ─────────────────────────
// WARNING: any remaining balance is lost
async function deleteSubWallet(adminKey, url, walletId) {
  const res = await fetch(`${C.serverUrl(url)}/api/v1/wallets/${encodeURIComponent(walletId)}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': adminKey },signal:AbortSignal.timeout(20000),redirect:'error'
  });
  // 200, 204, or 404 all count as success here
  if (!res.ok && res.status !== 404 && res.status !== 204) {
    throw new Error(`Delete failed HTTP ${res.status}`);
  }
}

// ── Build card wallet URL ──────────────────────────────────────
// The cardholder opens this URL in a browser to see their balance and pay
function cardUrl(url,userId,walletId) {
  return C.httpUrl(url+'/wallet?usr='+encodeURIComponent(userId)+'&wal='+encodeURIComponent(walletId));
}
function cardApi(conn) {
  return {
    createWallet:name=>createSubWallet(conn.key,conn.url,name),
    info:key=>getWalletInfo(key,conn.url),
    invoice:(key,sats,memo)=>createSubInvoice(key,conn.url,sats*1000,memo),
    pay:(invoice,msats)=>payInvoiceFromAdmin(conn.key,conn.url,invoice,msats),
    payment:(key,hash)=>C.request(conn.url+'/api/v1/payments/'+encodeURIComponent(hash),{headers:{'X-Api-Key':key}})
  };
}
async function cardManagementConnection(targets) {
  // The Web Lock serializes operations; refresh snapshots after taking it too.
  for(const card of targets) await reloadCard(card);
  const conn=getConn();conn.url=C.serverUrl(conn.url);
  if(!conn.key||targets.some(c=>c.lnbitsUrl!==conn.url))throw new Error('作成時と同じ接続先と管理用キーが必要です。');
  const wallet=await getWalletInfo(conn.key,conn.url);
  if(!wallet.id||targets.some(c=>c.legacyImported?(!wallet.user||wallet.user!==c.userId):wallet.id!==c.ownerWalletId))throw new Error('作成時と同じウォレットを指定してください。');
  return conn;
}
async function reloadCard(card) {
  const saved=await ledger.get(card.id);
  if(!saved || saved.kind!=='card' || saved.walletId!==card.walletId || saved.lnbitsUrl!==card.lnbitsUrl) throw new Error('保存済みカードの照合に失敗しました。再読み込みしてください。');
  Object.assign(card,{pendingTopup:null},saved);
  return card;
}
async function executeCards(resume=false) {
  if(creating) return;
  creating=true; pauseCreation=false;
  $('create-btn').disabled=true; $('resume-create-btn').disabled=true; $('pause-create-btn').disabled=false;
  try {
    await C.exclusive(async()=>{
      const conn=getConn();conn.url=C.serverUrl(conn.url); if(!conn.key) throw new Error('管理用キーを入力してください。');
      await ledger.open(); await migrateSavedCards();
      const wallet=await getWalletInfo(conn.key,conn.url);
      if(!wallet.id) throw new Error('接続先のウォレットを確認できません。');
      cards=await loadSavedCards();
      let batchRows;
      if(resume) {
        batchRows=cards.filter(c=>c.lnbitsUrl===conn.url && c.ownerWalletId===wallet.id && (!selectedCardBatch||c.batchId===selectedCardBatch) && c.state!=='verified' && c.state!=='deactivated');
        if(!batchRows.length) throw new Error('再開できる記録がありません。');
      } else {
        const sats=C.integer($('card-sats').value,2100000000000000), count=C.integer($('card-count').value,30000);
        if(!Number.isSafeInteger(sats*count)) throw new Error('合計額が大きすぎます。');
        if(!confirm(count.toLocaleString()+'件を作成し、1件 '+sats.toLocaleString()+' satsを入金します。続けますか？')) return;
        const batchId=C.id(), label=$('card-label').value.trim()||'Prepaid Card';
        batchRows=Array.from({length:count},(_,i)=>({id:C.id(),kind:'card',batchId,name:label+' #'+String(i+1).padStart(String(count).length,'0'),state:'planned',lnbitsUrl:conn.url,ownerWalletId:wallet.id,fundedSats:sats,balanceSats:0,active:false,createdAt:new Date().toISOString()}));
        await ledger.putMany(batchRows);
        cards.push(...batchRows);selectedCardBatch=batchId;cardPage=0;
      }
      saveSettings();
      $('gen-progress').classList.add('visible'); $('cards-section').style.display='';
      const api=cardApi(conn);
      await GiftIssuance.run(ledger,batchRows,(store,row)=>GiftIssuance.card(store,row,api),{
        paused:()=>pauseCreation,
        onProgress:(done,total,row)=>{
          $('gen-label').textContent=done.toLocaleString()+' / '+total.toLocaleString()+'件を処理';
          $('gen-fill').style.width=(done/total*100)+'%';
          $('gen-detail').textContent=row.error||row.name;
        }
      });
      $('create-status').textContent=pauseCreation?'停止しました。未完了分を再開できます。':'処理を終えました。CSV出力前に全件確認を実行してください。';
    });
  } catch(e) { $('create-status').textContent=e.message; toast(e.message,'error'); }
  finally {
    creating=false; $('create-btn').disabled=false; $('resume-create-btn').disabled=false; $('pause-create-btn').disabled=true;
    try { cards=await loadSavedCards();renderCardsTable();$('cards-section').style.display=''; } catch(e) { toast(e.message,'error'); }
  }
}
async function createCards() { return executeCards(false); }
async function resumeCards() { return executeCards(true); }

// ── Render table ───────────────────────────────────────────────
function renderCardsTable() {
  const tbody = $('cards-tbody');
  selectedCardBatch=C.batches(cards,$('card-batch'),selectedCardBatch);
  const shown=batchCards();
  tbody.innerHTML = '';

  const active   = shown.filter(c => c.active && !c.failed).length;
  const empty    = shown.filter(c => c.active && !c.failed && (c.balanceSats || 0) === 0).length;
  const inactive = shown.filter(c => c.state==='deactivated').length;
  const errors   = shown.filter(c => c.state!=='verified' && c.state!=='deactivated').length;

  $('card-stats').innerHTML = `
    <span class="stat-chip sc-total"><i class="fas fa-credit-card"></i> ${shown.length} total</span>
    <span class="stat-chip sc-active"><i class="fas fa-circle"></i> ${active} active</span>
    ${empty    ? `<span class="stat-chip sc-empty"><i class="fas fa-battery-empty"></i> ${empty} empty</span>` : ''}
    ${inactive ? `<span class="stat-chip sc-off"><i class="fas fa-power-off"></i> ${inactive} deactivated</span>` : ''}
    ${errors   ? `<span class="stat-chip sc-empty"><i class="fas fa-times"></i> ${errors} 確認待ち</span>` : ''}
  `;

  if (shown.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No cards yet.</div></td></tr>';
    return;
  }

  shown.slice(cardPage*cardPageSize,(cardPage+1)*cardPageSize).forEach((card, pageIndex) => {
    const idx=cards.indexOf(card);
    const tr = document.createElement('tr');

    if (card.state !== 'verified' && card.state !== 'deactivated') {
      tr.innerHTML = `
        <td style="color:var(--text3);font-size:0.8rem;">${idx + 1}</td>
        <td>${escHtml(card.name)}</td>
        <td colspan="3" style="color:var(--red);font-size:0.8rem;">❌ ${escHtml(card.error || '確認待ち: '+card.state)}</td>
        <td></td>
      `;
      tbody.appendChild(tr);
      return;
    }

    const balance   = card.balanceSats || 0;
    const funded    = card.fundedSats  || 0;
    const pct       = funded > 0 ? Math.round((balance / funded) * 100) : 0;
    const fillCls   = pct === 0 ? 'zero' : pct < 25 ? 'low' : '';
    const statusPill = !card.active
      ? `<span class="pill pill-inactive"><i class="fas fa-power-off"></i> deactivated</span>`
      : balance === 0
        ? `<span class="pill pill-empty"><i class="fas fa-battery-empty"></i> empty</span>`
        : `<span class="pill pill-active"><i class="fas fa-circle"></i> active</span>`;

    const balanceBar = card.active
      ? `<div class="balance-bar-wrap">
           <div class="balance-bar-track">
             <div class="balance-bar-fill ${fillCls}" style="width:${pct}%"></div>
           </div>
           <span class="mono" style="font-size:0.78rem;color:var(--text2);white-space:nowrap;">${balance.toLocaleString()} s</span>
         </div>`
      : `<span style="color:var(--text3);font-size:0.8rem;">—</span>`;

    const actionBtns = card.active ? `
      <button class="btn-icon" data-action="show-qr"  data-idx="${idx}" title="Show QR / Card URL"><i class="fas fa-qrcode"></i></button>
      <button class="btn-icon" data-action="refresh"  data-idx="${idx}" title="Refresh balance"><i class="fas fa-sync"></i></button>
      <button class="btn-icon" data-action="topup"    data-idx="${idx}" title="Top up"><i class="fas fa-plus-circle"></i></button>
      <button class="btn-icon danger" data-action="deactivate" data-idx="${idx}" title="Deactivate (delete wallet)"><i class="fas fa-power-off"></i></button>
    ` : `
      <span style="color:var(--text3);font-size:0.78rem;">deleted</span>
    `;

    tr.innerHTML = `
      <td style="color:var(--text3);font-size:0.8rem;">${idx + 1}</td>
      <td>${escHtml(card.name)}</td>
      <td>${balanceBar}</td>
      <td class="mono" style="color:var(--text3);">${funded.toLocaleString()} s</td>
      <td>${statusPill}</td>
      <td><div class="action-cell">${actionBtns}</div></td>
    `;
    tbody.appendChild(tr);
  });

  const pages=Math.max(1,Math.ceil(shown.length/cardPageSize));
  $('cards-page-label').textContent=(cardPage+1)+' / '+pages+'ページ（'+shown.length.toLocaleString()+'件）';
  $('cards-prev-btn').disabled=cardPage===0; $('cards-next-btn').disabled=cardPage+1>=pages;
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', function () {
      handleCardAction(this.dataset.action, parseInt(this.dataset.idx));
    });
  });
}

// ── Card actions ───────────────────────────────────────────────
async function handleCardAction(action, idx) {
  const card = cards[idx];
  const { url, key } = getConn();
  if (!card || creating) return;
  if(card.lnbitsUrl!==url){toast('元の接続先URLを指定してください。','error');return;}

  if (action === 'show-qr') {
    openQrModal(card);

  } else if (action === 'refresh') {
    try {
      await C.exclusive(()=>verifyCard(card,{url,key}));
      renderCardsTable();
      toast(`${card.name}: ${card.balanceSats.toLocaleString()} sats`, 'success', 2500);
    } catch (e) { toast('Refresh failed: ' + e.message, 'error'); }

  } else if (action === 'topup') {
    openTopupModal(idx);

  } else if (action === 'deactivate') {
    const bal = card.balanceSats || 0;
    const msg = bal > 0
      ? `⚠️ Deactivate "${card.name}"?\n\nThe remaining ${bal.toLocaleString()} sats will be LOST (LNbits does not return funds from deleted sub-wallets). Make sure the cardholder has spent or the balance has been withdrawn first.`
      : `Deactivate "${card.name}"? The wallet will be deleted from LNbits.`;
    if (!confirm(msg)) return;
    try {
      await C.exclusive(async()=>{
      const conn=await cardManagementConnection([card]);
      card.state='deactivation_pending';await ledger.put(card);
      await deleteSubWallet(conn.key, conn.url, card.walletId);
      card.active = false;
      card.state = 'deactivated';
      card.balanceSats = 0;
      await mergeAndSave([card]);
      });
      renderCardsTable();
      toast(`"${card.name}" deactivated.`, 'success');
    } catch (e) { toast('Deactivate failed: ' + e.message, 'error'); }
  }
}

// ── Top-up modal ───────────────────────────────────────────────
let topupIdx = null;
function openTopupModal(idx) {
  topupIdx = idx;
  const card = cards[idx];
  $('topup-card-name').textContent = `Adding sats to "${card.name}" (current balance: ${(card.balanceSats || 0).toLocaleString()} sats)`;
  $('topup-sats').value = '1000';
  $('topup-modal').classList.add('open');
}
async function doTopup() {
  const card=cards[topupIdx], btn=$('topup-confirm-btn'); if(!card || creating) return;
  btn.disabled=true;
  try { await C.exclusive(async()=>{
    const conn=await cardManagementConnection([card]);
    if(card.state!=='verified' || !card.active) throw new Error('有効な入金確認済みカードだけに追加できます。');
    if(card.pendingTopup?.state==='payment_pending') {
      await verifyCard(card,conn);
      $('topup-modal').classList.remove('open');renderCardsTable();
      toast('前回の追加送金を確認しました。再送金は行っていません。','success');
      return;
    }
    const sats=card.pendingTopup?.sats||C.integer($('topup-sats').value,Math.floor(Number.MAX_SAFE_INTEGER/1000));
    const targetFunded=C.integer(card.fundedSats,Math.floor(Number.MAX_SAFE_INTEGER/1000))+sats;
    C.integer(targetFunded,Math.floor(Number.MAX_SAFE_INTEGER/1000));
    card.pendingTopup=card.pendingTopup||{id:C.id(),sats,state:'creating_invoice',targetFunded};
    await ledger.put(card);
    const invoice=await createSubInvoice(card.invoiceKey,conn.url,sats*1000,'Top up '+card.pendingTopup.id);
    invoice.payment_request=invoice.payment_request||invoice.bolt11;
    C.assertInvoice(invoice.payment_request,sats*1000);
    if(!/^[a-f0-9]{64}$/i.test(invoice.payment_hash||'')) throw new Error('請求書の照合IDがありません。');
    Object.assign(card.pendingTopup,{paymentHash:invoice.payment_hash,state:'payment_pending'});
    await ledger.put(card);
    await payInvoiceFromAdmin(conn.key,conn.url,invoice.payment_request,sats*1000);
    await verifyCard(card,conn);
    $('topup-modal').classList.remove('open'); renderCardsTable();
    toast('入金を確認しました。','success');
  }); } catch(e) {toast(e.message,'error');} finally {btn.disabled=false;}
}
async function verifyCard(card,conn) {
  await reloadCard(card);
  if(card.state==='deactivated'||card.state==='deactivation_pending')throw new Error('無効化の記録があるため再有効化しません。');
  if(card.lnbitsUrl!==conn.url)throw new Error('記録と接続先が一致しません。');
  const api=cardApi(conn),next={...card};
  if(card.pendingTopup) {
    const pending=card.pendingTopup;
    if(!pending.paymentHash||(await api.payment(card.invoiceKey,pending.paymentHash)).paid!==true)throw new Error('追加の入金を確認できません。再送金は行いません。');
    next.fundedSats=pending.targetFunded;next.pendingTopup=null;
  }
  if(!card.legacyImported && (!card.paymentHash||(await api.payment(card.invoiceKey,card.paymentHash)).paid!==true))throw new Error('元の入金記録を確認できません。');
  const info=await api.info(card.invoiceKey);
  if(info.id!==card.walletId || !Number.isSafeInteger(info.balance) || info.balance<0)throw new Error('ウォレットの残高を確認できません。');
  if(card.legacyImported) {
    if(typeof info.user!=='string'||info.user!==card.userId)throw new Error('以前のウォレットを照合できません。');
    next.accessUrl=cardUrl(conn.url,info.user,info.id);
  }
  Object.assign(next,{balanceSats:info.balance/1000,state:'verified',active:true,verifiedAt:new Date().toISOString(),error:null});
  // Commit before changing the in-memory pending marker. Failed reads/writes remain retry-safe.
  await ledger.put(next);Object.assign(card,next);
}

// ── Refresh all balances ───────────────────────────────────────
async function refreshAllBalances() {
  if(creating) return;
  const btn=$('refresh-all-btn');btn.disabled=true;
  try {await C.exclusive(async()=>{
    const conn=getConn();conn.url=C.serverUrl(conn.url); let done=0;
    for(const card of batchCards().filter(c=>c.walletId && c.state!=='deactivated')) {
      try {await verifyCard(card,conn);done++;}
      catch(e) {card.error=e.message;if(card.state==='verified')card.state='verification_pending';await ledger.put(card);}
      $('create-status').textContent=done.toLocaleString()+'件の確認を完了';
    }
    renderCardsTable();toast(done.toLocaleString()+'件の入金・残高を確認しました。','info');
  });} catch(e){toast(e.message,'error');} finally{btn.disabled=false;}
}

// ── Deactivate all ─────────────────────────────────────────────
async function deactivateAll() {
  if(creating)return;
  const active = batchCards().filter(c => c.active && !c.failed);
  if (active.length === 0) { toast('No active cards.', 'info'); return; }
  const totalBal = active.reduce((s, c) => s + (c.balanceSats || 0), 0);
  if (!confirm(`⚠️ Deactivate ALL ${active.length} active card(s)?\n\nTotal remaining balance: ${totalBal.toLocaleString()} sats — this will be LOST.`)) return;
  let done = 0;
  try {await C.exclusive(async()=>{
  const {url,key}=await cardManagementConnection(active);
  for (const card of active) {
    card.state='deactivation_pending';await ledger.put(card);
    await deleteSubWallet(key,url,card.walletId);
    card.active=false;card.state='deactivated';card.balanceSats=0;
    await ledger.put(card);done++;
    await sleep(120);
  }
  });}catch(e){toast(e.message,'error');}
  renderCardsTable();
  toast(`Deactivated ${done} card${done !== 1 ? 's' : ''}`, 'success');
}

// ── Load saved cards ───────────────────────────────────────────
async function loadSavedCardsUI() {
  await migrateSavedCards();
  const saved = await loadSavedCards();
  if (saved.length === 0) { toast('No saved cards found in browser storage.', 'info'); return; }
  // Merge saved into current session without duplicates
  saved.forEach(sc => {
    if (!cards.find(c => c.walletId === sc.walletId)) cards.push(sc);
  });
  renderCardsTable();
  $('cards-section').style.display = '';
  toast(`Loaded ${saved.length} saved card${saved.length !== 1 ? 's' : ''}.`, 'success');
}

// ── QR Modal ───────────────────────────────────────────────────
function openQrModal(card) {
  qrModalCard = card;
  $('qr-modal-title').textContent = card.name;
  $('qr-modal-sub').textContent   = `${(card.balanceSats || 0).toLocaleString()} sats remaining`;
  $('qr-modal-url').textContent   = card.accessUrl;
  $('qr-modal-key').textContent   = card.invoiceKey;

  const container = $('qr-modal-container');
  container.innerHTML = '';
  try {
    new QRCode(container, {
      text: card.accessUrl,
      width: 240, height: 240,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch {}
  $('qr-modal').classList.add('open');
}
function closeQrModal() { $('qr-modal').classList.remove('open'); }

// ── Build card HTML page ───────────────────────────────────────
function buildCardHtml(card) {
  const safeTitle  = C.escapeHtml(card.name||'Prepaid Card');
  const rawUrl=C.httpUrl(card.accessUrl);
  const safeUrl=C.escapeHtml(rawUrl);
  const sats       = (card.fundedSats || 0).toLocaleString();

  // Render QR into a temp div to get data URL
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
  document.body.appendChild(tmp);
  let dataUrl = '';
  try {
    new QRCode(tmp, { text: rawUrl, width: 400, height: 400, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    const canvas = tmp.querySelector('canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  } catch {} finally { document.body.removeChild(tmp); }

  const qrImg = dataUrl
    ? `<img src="${dataUrl}" alt="QR" width="300" height="300" style="display:block;margin:0 auto;border-radius:12px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>\u26a1 ${safeTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Inter', sans-serif;
      background: #0d0d14; color: #e8e8f0;
      min-height: 100vh; display: flex; align-items: center;
      justify-content: center; padding: 2rem 1rem;
    }
    body::before {
      content: ''; position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(247,147,26,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(247,147,26,0.03) 1px, transparent 1px);
      background-size: 48px 48px; pointer-events: none; z-index: 0;
    }
    .card {
      position: relative; z-index: 1; background: #1e1e32;
      border: 1px solid #2e2e4e; border-radius: 20px;
      padding: 2.5rem 2rem; max-width: 460px; width: 100%;
      text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    }
    .logo { font-size: 2.6rem; margin-bottom: 0.5rem; filter: drop-shadow(0 0 12px rgba(255,215,0,0.5)); }
    h1 {
      font-size: 1.3rem; font-weight: 800; margin-bottom: 0.2rem;
      background: linear-gradient(135deg, #ffd700, #f7931a);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .subtitle { color: #9898b8; font-size: 0.88rem; margin-bottom: 1.6rem; }
    .qr-wrap {
      background: #fff; border-radius: 16px; padding: 1rem;
      display: inline-block; margin-bottom: 1.4rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .info-row { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.3rem; }
    .badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.35rem 0.85rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600;
    }
    .badge-sats   { background: rgba(247,147,26,0.12); color: #f7931a; border: 1px solid rgba(247,147,26,0.3); }
    .badge-reuse  { background: rgba(34,197,94,0.12);  color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
    .badge-spend  { background: rgba(59,130,246,0.12); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
    .url-box {
      background: #13131f; border: 1px solid #2e2e4e; border-radius: 10px;
      padding: 0.65rem 0.9rem; font-family: 'Courier New', monospace; font-size: 0.7rem;
      color: #9898b8; word-break: break-all; text-align: left; margin-bottom: 0.8rem;
      cursor: pointer; transition: border-color 0.2s;
    }
    .url-box:hover { border-color: #f7931a; }
    .url-label { font-size: 0.7rem; color: #5a5a7a; margin-bottom: 0.3rem; }
    .btn-row { display: flex; gap: 0.65rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .copy-btn {
      display: inline-flex; align-items: center; gap: 0.45rem;
      background: #25253d; border: 1px solid #3d3d60; border-radius: 10px;
      color: #e8e8f0; font-size: 0.85rem; font-weight: 600;
      padding: 0.6rem 1.3rem; cursor: pointer; transition: all 0.2s; font-family: inherit;
    }
    .copy-btn:hover { background: rgba(247,147,26,0.1); border-color: #f7931a; color: #f7931a; }
    .open-btn {
      display: inline-flex; align-items: center; gap: 0.45rem;
      background: linear-gradient(135deg, #f7931a, #e67e00);
      border: none; border-radius: 10px; color: #fff;
      font-size: 0.85rem; font-weight: 700;
      padding: 0.6rem 1.3rem; cursor: pointer; text-decoration: none;
      box-shadow: 0 4px 14px rgba(247,147,26,0.35);
    }
    .instructions {
      background: #13131f; border: 1px solid #2e2e4e; border-radius: 10px;
      padding: 1rem; text-align: left; font-size: 0.82rem; color: #9898b8;
      line-height: 1.7; margin-bottom: 1rem;
    }
    .instructions strong { color: #e8e8f0; }
    .copied-msg { display: none; color: #22c55e; font-size: 0.8rem; margin-top: 0.4rem; font-weight: 600; }
    .footer { font-size: 0.7rem; color: #5a5a7a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">\ud83d\udcb3</div>
    <h1>${safeTitle}</h1>
    <p class="subtitle">Your prepaid Lightning card</p>

    <div class="qr-wrap">${qrImg}</div>

    <div class="info-row">
      <span class="badge badge-sats">\u26a1 ${sats} sats</span>
      <span class="badge badge-reuse">\u267e\ufe0f reusable</span>
      <span class="badge badge-spend">\ud83d\uded2 pay any merchant</span>
    </div>

    <div class="instructions">
      <strong>How to use:</strong><br>
      1. Scan the QR or click Open Wallet below<br>
      2. Your LNbits wallet opens in a browser — no app needed<br>
      3. To pay: show the merchant's QR and tap Scan to pay, or paste a Lightning invoice<br>
      4. Your balance decreases with each payment until it reaches zero
    </div>

    <div class="url-box" onclick="copyUrl()" title="Click to copy">
      <div class="url-label">Wallet URL (click to copy)</div>
      <span id="wallet-url">${safeUrl}</span>
    </div>

    <div class="btn-row">
      <button class="copy-btn" onclick="copyUrl()">\ud83d\udccb Copy URL</button>
      <a class="open-btn" href="${safeUrl}" target="_blank">\u26a1 Open Wallet</a>
    </div>
    <div class="copied-msg" id="copied-msg">\u2705 Copied!</div>

    <div class="footer">\u26a1 Lightning Network \u00b7 Powered by LNbits \u00b7 Scan with any browser</div>
  </div>

  <script>
    function copyUrl() {
      const text = document.getElementById('wallet-url').textContent;
      navigator.clipboard.writeText(text).then(function() {
        const m = document.getElementById('copied-msg');
        m.style.display = 'block';
        setTimeout(function(){ m.style.display='none'; }, 2000);
      }).catch(function(){
        const el = document.createElement('textarea');
        el.value = text; document.body.appendChild(el); el.select();
        document.execCommand('copy'); document.body.removeChild(el);
      });
    }
  <\/script>
</body>
</html>`;
}

// ── Download single card HTML ──────────────────────────────────
function downloadCardHtml(card) {
  const html     = buildCardHtml(card);
  const safeName = (card.name || 'card').replace(/[^a-zA-Z0-9_\-#]/g, '_');
  const blob     = new Blob([html], { type: 'text/html' });
  const a        = document.createElement('a');
  a.href         = URL.createObjectURL(blob);
  a.download     = `${safeName}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Download all as ZIP ────────────────────────────────────────
async function downloadAllZip() {
  const active = batchCards().filter(c => c.state==='verified' && c.active && !c.failed && c.accessUrl);
  if (active.length === 0) { toast('No active cards to export.', 'error'); return; }

  const btn = $('download-zip-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Building ZIP…';

  try {
    const zip = new JSZip();
    active.forEach((card,i) => {
      const html     = buildCardHtml(card);
      const safeName = (card.name || 'card').replace(/[^a-zA-Z0-9_\-#]/g, '_');
      zip.file(`${i+1}-${safeName}.html`, html);
    });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `prepaid-cards-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`ZIP downloaded — ${active.length} card HTML files`, 'success');
  } catch (e) {
    toast('ZIP failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-archive"></i> Download all as HTML (ZIP)';
  }
}

// ── Export CSV ─────────────────────────────────────────────────
async function exportCsv() {
  try {await C.exclusive(async()=>{
    if(creating)throw new Error('処理が完了してから出力してください。');
    const conn=getConn();conn.url=C.serverUrl(conn.url);
    const targets=batchCards();for(const card of targets)await verifyCard(card,conn);
    const csv=C.cardCsv(targets),a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='prepaid-cards-'+Date.now()+'.csv';a.click();URL.revokeObjectURL(a.href);
    toast(targets.length.toLocaleString()+'件を照合し、CSVに保存しました。','success');
  });}catch(e){toast(e.message,'error');}
}

// ── Utilities ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  loadSettings();
  updateCost();

  $('lnbits-url').addEventListener('input', saveSettings);
  $('api-key').addEventListener('input',    saveSettings);
  $('card-sats').addEventListener('input',  updateCost);
  $('card-count').addEventListener('input', updateCost);

  $('toggle-key-btn').addEventListener('click',    toggleKey);
  $('check-balance-btn').addEventListener('click', checkBalance);
  $('create-btn').addEventListener('click', createCards);
  $('resume-create-btn').addEventListener('click', resumeCards);
  $('pause-create-btn').addEventListener('click',()=>{pauseCreation=true;$('pause-create-btn').disabled=true;});
  $('card-batch').addEventListener('change',()=>{selectedCardBatch=$('card-batch').value;cardPage=0;renderCardsTable();});
  $('cards-prev-btn').addEventListener('click',()=>{cardPage=Math.max(0,cardPage-1);renderCardsTable();});
  $('cards-next-btn').addEventListener('click',()=>{cardPage++;renderCardsTable();});
  $('refresh-all-btn').addEventListener('click',   refreshAllBalances);
  $('deactivate-all-btn').addEventListener('click',deactivateAll);
  $('load-saved-btn').addEventListener('click',    loadSavedCardsUI);
  $('export-csv-btn').addEventListener('click',    exportCsv);
  $('download-zip-btn').addEventListener('click',  downloadAllZip);

  // QR modal
  $('qr-close-btn').addEventListener('click', closeQrModal);
  $('qr-modal').addEventListener('click', function (e) { if (e.target === this) closeQrModal(); });
  $('qr-copy-url-btn').addEventListener('click', function () {
    if (!qrModalCard) return;
    navigator.clipboard.writeText(qrModalCard.accessUrl).catch(() => {});
    toast('URL copied!', 'success', 2000);
  });
  $('qr-dl-html-btn').addEventListener('click', function () {
    if (qrModalCard) { downloadCardHtml(qrModalCard); closeQrModal(); }
  });

  // Top-up modal
  $('topup-cancel-btn').addEventListener('click', function () { $('topup-modal').classList.remove('open'); });
  $('topup-modal').addEventListener('click', function (e) { if (e.target === this) $('topup-modal').classList.remove('open'); });
  $('topup-confirm-btn').addEventListener('click', doTopup);
  try { await migrateSavedCards(); cards=await loadSavedCards();if(cards.length){$('cards-section').style.display='';renderCardsTable();} } catch(e){toast(e.message,'error');}
});
