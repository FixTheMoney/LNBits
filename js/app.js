/**
 * ⚡ Lightning QR Drop — App Logic
 * Uses i18n.t() for all user-facing strings.
 */

'use strict';

const State = {
  config: {
    lnbitsUrl: '',
    apiKey: '',
    walletId: '',
    satsAmount: 100,
    totalRounds: 5,
    expiryMinutes: 10,
    sessionName: '',
  },
  session: {
    id: null,
    currentRound: 0,
    claimedCount: 0,
    expiredCount: 0,
    active: false,
    currentLinkId: null,
    currentLnurl: null,
    withdrawApiBase: null,
    balanceAtRoundStart: null,  // msats snapshot — primary claim detection
    _lastClaimedRound: -1,
    _lastExpiredRound: -1,
  },
  log: [],
  blockedFingerprints: new Set(),
  countdownInterval: null,
  pollInterval: null,
  countdownSeconds: 0,
};

const $ = id => document.getElementById(id);

// Re-apply dynamic strings when language changes
document.addEventListener('langchange', () => {
  updateTotalCost();
  renderLog();
  updateBlockedList();
  // Re-apply static QR card text
  if ($('qr-status-text')) {
    // only if status text is one of our known states, refresh it
  }
});

// ─── Config persistence ───────────────────────────────────────────────────────
function loadSavedConfig() {
  const saved = localStorage.getItem('lnqr_config');
  if (saved) {
    try {
      const cfg = JSON.parse(saved);
      if (cfg.lnbitsUrl)     $('lnbits-url').value    = cfg.lnbitsUrl;
      if (cfg.apiKey)        $('api-key').value        = cfg.apiKey;
      if (cfg.walletId)      $('wallet-id').value      = cfg.walletId;
      if (cfg.satsAmount)    $('sats-amount').value    = cfg.satsAmount;
      if (cfg.totalRounds)   $('total-rounds').value   = cfg.totalRounds;
      if (cfg.expiryMinutes) $('expiry-minutes').value = cfg.expiryMinutes;
      if (cfg.sessionName)   $('session-name').value   = cfg.sessionName;
    } catch (e) {}
  }
}

function saveConfig() {
  localStorage.setItem('lnqr_config', JSON.stringify({
    lnbitsUrl:     $('lnbits-url').value.trim(),
    apiKey:        $('api-key').value.trim(),
    walletId:      $('wallet-id').value.trim(),
    satsAmount:    parseInt($('sats-amount').value),
    totalRounds:   parseInt($('total-rounds').value),
    expiryMinutes: parseInt($('expiry-minutes').value),
    sessionName:   $('session-name').value.trim(),
  }));
}

function bindSetupListeners() {
  $('sats-amount').addEventListener('input', updateTotalCost);
  $('total-rounds').addEventListener('input', updateTotalCost);
  // No form submit listener — launch button is wired directly in index.html
}

function updateTotalCost() {
  const sats   = parseInt($('sats-amount').value)  || 0;
  const rounds = parseInt($('total-rounds').value) || 0;
  const total  = sats * rounds;
  $('total-cost-display').textContent = `${total.toLocaleString()} sats`;
  const noteKey = rounds === 1 ? 'total_cost_across' : 'total_cost_across_pl';
  $('total-cost-note').textContent = i18n.t(noteKey, { n: rounds });
}

function toggleReveal(inputId) {
  const input = $(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ─── Language switch ──────────────────────────────────────────────────────────
function setLang(l) {
  const enBtn = document.getElementById('lang-en-btn');
  const jaBtn = document.getElementById('lang-ja-btn');
  if (enBtn) enBtn.classList.toggle('active', l === 'en');
  if (jaBtn) jaBtn.classList.toggle('active', l === 'ja');
  i18n.setLang(l);
  renderLog();
  updateTotalCost();
  updateBlockedList();
}

// ─── Test connection ──────────────────────────────────────────────────────────
async function testConnection() {
  const url    = $('lnbits-url').value.trim().replace(/\/$/, '');
  const apiKey = $('api-key').value.trim();
  const badge  = $('connection-status');

  if (!url || !apiKey) {
    showStatusBadge(badge, 'error', i18n.t('conn_status_missing'));
    return;
  }

  const btn = $('test-connection-btn');
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${i18n.t('btn_testing')}`;
  badge.className = 'status-badge hidden';

  try {
    const res = await fetch(`${url}/api/v1/wallet`, {
      headers: { 'X-Api-Key': apiKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.id) $('wallet-id').value = data.id;
    const balanceSats = Math.floor((data.balance || 0) / 1000);
    showStatusBadge(badge, 'success', i18n.t('conn_status_ok', { balance: balanceSats.toLocaleString() }));
    toast(i18n.t('toast_connected', { name: data.name || 'Unknown', balance: balanceSats.toLocaleString() }), 'success');
  } catch (err) {
    showStatusBadge(badge, 'error', i18n.t('conn_status_fail', { msg: err.message }));
    toast(i18n.t('toast_connect_fail'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-plug"></i> <span data-i18n="btn_test_connection">${i18n.t('btn_test_connection')}</span>`;
  }
}

function showStatusBadge(el, type, msg) {
  el.textContent = msg;
  el.className = `status-badge ${type}`;
}

/**
 * Diagnostic: probe all known withdraw extension paths with GET,
 * then attempt a real POST on the first working one.
 * Shows full server responses so the user can see exactly what's happening.
 */
async function testWithdrawExtension() {
  const url    = $('lnbits-url').value.trim().replace(/\/$/, '');
  const apiKey = $('api-key').value.trim();
  const badge  = $('connection-status');
  const diag   = $('diag-box');

  if (!url || !apiKey) {
    showStatusBadge(badge, 'error', '⚠️ Enter LNbits URL and API key first');
    return;
  }

  const btn = $('test-withdraw-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Probing…';
  badge.className = 'status-badge hidden';

  let diagText = `⚡ Withdraw Extension Diagnostic\n`;
  diagText += `URL: ${url}\n`;
  diagText += `Key: ${apiKey.slice(0,8)}…${apiKey.slice(-4)}\n`;
  diagText += `${'─'.repeat(56)}\n\n`;
  diagText += `Checking ${WITHDRAW_BASES(url).length} known endpoint paths…\n\n`;

  diag.textContent = diagText;
  diag.classList.remove('hidden');

  let foundBase = null;

  for (const base of WITHDRAW_BASES(url)) {
    const ep = `${base}/links`;
    diagText += `GET ${ep.replace(url, '')}\n`;
    diag.textContent = diagText;

    try {
      const res  = await fetch(ep, { headers: { 'X-Api-Key': apiKey } });
      const body = await res.text();
      diagText += `  HTTP ${res.status}`;

      if (res.ok) {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (_) {}
        diagText += ` ✅  ← FOUND!\n`;
        if (Array.isArray(parsed)) diagText += `  (${parsed.length} existing link(s))\n`;
        foundBase = base;
        diagText += `\n`;
        diag.textContent = diagText;
        break;
      }

      // Show body for non-200
      const snippet = body.slice(0, 150).replace(/\n/g, ' ');
      diagText += ` — ${snippet}\n`;
      if (res.status === 401 || res.status === 403) {
        diagText += `  ❌ Auth error — wrong API key type (use Admin key)\n`;
      }
    } catch (err) {
      diagText += `  ❌ Network error: ${err.message}\n`;
    }
    diagText += `\n`;
    diag.textContent = diagText;
  }

  if (!foundBase) {
    diagText += `❌ Extension not found at any path.\n\n`;
    diagText += `To fix:\n`;
    diagText += `  1. Log in to LNbits\n`;
    diagText += `  2. Go to Extensions → find "Withdraw" or "LNURLw" → Enable\n`;
    diagText += `  3. Make sure you are using the Admin key (not Invoice key)\n`;
    diagText += `  4. Confirm CORS is enabled on your LNbits instance\n`;
    showStatusBadge(badge, 'error', '❌ Withdraw extension not found at any path');
    diag.textContent = diagText;
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-vial"></i> Test Withdraw Ext.';
    return;
  }

  // ── Test a real POST ────────────────────────────────────────────────────────
  const sats    = parseInt($('sats-amount').value) || 100;
  const postEp  = `${foundBase}/links`;
  const payload = { title: '[Diagnostic Test]', min_withdrawable: sats, max_withdrawable: sats, uses: 1, wait_time: 1, is_unique: true };

  diagText += `${'─'.repeat(56)}\n`;
  diagText += `POST ${postEp.replace(url, '')}\n`;
  diagText += `Body: ${JSON.stringify(payload)}\n`;
  diag.textContent = diagText;

  try {
    const res = await fetch(postEp, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    diagText += `HTTP ${res.status}\n`;

    if (res.ok) {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (_) {}
      diagText += `✅ Link created!\n`;
      if (parsed) {
        diagText += `Fields: ${Object.keys(parsed).join(', ')}\n`;
        const lnurlVal = parsed.lnurl || parsed.lnurl_full || parsed.lnurl_encoded || parsed.LNURL || null;
        if (lnurlVal) {
          diagText += `LNURL: ${lnurlVal.slice(0,72)}…\n`;
        } else {
          diagText += `⚠️ No lnurl field in response — app will retry GET to find it.\n`;
          diagText += `All returned fields: ${JSON.stringify(parsed).slice(0,300)}\n`;
        }
        if (parsed.id) {
          // cleanup
          await fetch(`${foundBase}/links/${parsed.id}`, { method: 'DELETE', headers: { 'X-Api-Key': apiKey } }).catch(()=>{});
          diagText += `🗑️ Test link deleted\n`;
        }
      }
      diagText += `\n✅ Ready to launch sessions!\n`;
      showStatusBadge(badge, 'success', '✅ Extension working — ready to launch');
    } else {
      diagText += `⚠️ POST failed\nServer: ${raw.slice(0, 300)}\n\n`;
      diagText += `The app will try alternative payload formats on launch.\n`;
      showStatusBadge(badge, 'error', `⚠️ POST HTTP ${res.status} — check details below`);
    }
  } catch (err) {
    diagText += `❌ POST network error: ${err.message}\n`;
    showStatusBadge(badge, 'error', '❌ Network error during POST test');
  }

  diag.textContent = diagText;
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-vial"></i> Test Withdraw Ext.';
}

// ─── Launch ───────────────────────────────────────────────────────────────────
async function handleLaunch(e) {
  if (e && e.preventDefault) e.preventDefault();

  const cfg = {
    lnbitsUrl:     $('lnbits-url').value.trim().replace(/\/$/, ''),
    apiKey:        $('api-key').value.trim(),
    walletId:      $('wallet-id').value.trim(),
    satsAmount:    parseInt($('sats-amount').value),
    totalRounds:   parseInt($('total-rounds').value),
    expiryMinutes: parseInt($('expiry-minutes').value),
    sessionName:   $('session-name').value.trim() || 'Lightning QR Drop',
  };

  if (!cfg.lnbitsUrl)                          { toast(i18n.t('toast_launch_no_url'), 'error'); return; }
  if (!cfg.apiKey)                             { toast(i18n.t('toast_launch_no_key'), 'error'); return; }
  if (!cfg.satsAmount || cfg.satsAmount < 1)   { toast(i18n.t('toast_launch_bad_amount'), 'error'); return; }
  if (!cfg.totalRounds || cfg.totalRounds < 1) { toast(i18n.t('toast_launch_bad_rounds'), 'error'); return; }

  State.config = cfg;
  saveConfig();

  const sessionId = generateId();
  State.session.id = sessionId;
  State.session.currentRound = 0;
  State.session.claimedCount = 0;
  State.session.expiredCount = 0;
  State.session.active = true;
  State.session.withdrawApiBase = null;
  State.session.balanceAtRoundStart = null;
  State.session._lastClaimedRound = -1;
  State.session._lastExpiredRound = -1;
  State.log = [];
  State.blockedFingerprints = new Set();

  try {
    await fetch('tables/withdraw_sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        sats_amount: cfg.satsAmount,
        total_rounds: cfg.totalRounds,
        current_round: 0,
        status: 'active',
        lnbits_url: cfg.lnbitsUrl,
        created_at_human: new Date().toLocaleString(),
      })
    });
  } catch (err) { console.warn('DB save failed:', err); }

  showPanel('drop-panel');
  $('drop-session-name').textContent = cfg.sessionName;
  $('drop-sats').textContent = cfg.satsAmount.toLocaleString();
  updateStats();
  await nextRound();
}

// ─── Next Round ───────────────────────────────────────────────────────────────
async function nextRound() {
  if (!State.session.active) return;

  const { currentRound, claimedCount } = State.session;
  const { totalRounds } = State.config;

  if (currentRound >= totalRounds) { finishSession(); return; }

  State.session.currentRound++;
  const round = State.session.currentRound;
  // Reset per-round guards
  State.session._lastClaimedRound = -1;
  State.session._lastExpiredRound = -1;

  $('round-badge').textContent = i18n.t('round_badge', { n: round });
  $('qr-status-text').textContent = i18n.t('qr_status_generating');
  setStatusDot('active');
  showQrState('loading');
  $('qr-loading-text').textContent = i18n.t('qr_loading_text');

  const pct = (claimedCount / totalRounds) * 100;
  $('progress-fill').style.width = `${pct}%`;
  $('progress-label').textContent = i18n.t('progress_label', { claimed: claimedCount, total: totalRounds });

  updateStats();

  try {
    // Snapshot balance NOW — before the QR is shown — so any drop detected
    // during polling is definitely from this round's withdrawal.
    try {
      State.session.balanceAtRoundStart = await fetchWalletBalance();
      console.log('[Balance] snapshot at round start:', State.session.balanceAtRoundStart, 'msats');
    } catch (e) {
      console.warn('[Balance] snapshot failed:', e.message);
      State.session.balanceAtRoundStart = null;
    }

    const linkData = await createLnurlWithdraw(round);
    State.session.currentLinkId = linkData.id;
    State.session.currentLnurl  = linkData.lnurl;

    displayQr(linkData.lnurl);
    $('lnurl-string').value = linkData.lnurl;
    $('qr-status-text').textContent = i18n.t('qr_status_waiting');
    setStatusDot('waiting');
    showQrState('display');
    startCountdown();
    startPolling(linkData.id, round);
    addLogEntry(round, 'pending', null, '—');
    toast(i18n.t('toast_qr_ready', { n: round }), 'info');
  } catch (err) {
    // Show first line in toast, full detail in QR card
    const firstLine = err.message.split('\n')[0];
    toast(`❌ ${firstLine}`, 'error', 8000);
    $('qr-status-text').textContent = `Error — ${firstLine}`;
    setStatusDot('done');
    showQrState('loading');
    // Show full multi-line error in the loading area
    const loadingText = $('qr-loading-text');
    loadingText.style.whiteSpace = 'pre-wrap';
    loadingText.style.textAlign  = 'left';
    loadingText.style.fontSize   = '0.75rem';
    loadingText.style.color      = 'var(--error, #ff6b6b)';
    loadingText.textContent      = err.message;
  }
}

// ─── LNbits API ───────────────────────────────────────────────────────────────

/**
 * All known endpoint base paths for the LNURL-withdraw extension,
 * ordered from most-likely to least-likely.
 *
 * LNbits naming history:
 *   v0.x (legacy)  → /withdraw/api/v1
 *   v0.12 hosted   → /withdraw/api/v1   (same, but extension must be enabled)
 *   v1.0+ new arch → /lnurlw/api/v1     (extension renamed "lnurlw")
 *   Some builds    → /api/v1/extensions/withdraw/api/v1
 *   Some builds    → /api/v1/extensions/lnurlw/api/v1
 */
const WITHDRAW_BASES = (url) => [
  `${url}/withdraw/api/v1`,
  `${url}/lnurlw/api/v1`,
  `${url}/api/v1/extensions/withdraw/api/v1`,
  `${url}/api/v1/extensions/lnurlw/api/v1`,
];

/**
 * Payload variants for the POST /links endpoint.
 * Different LNbits versions require different field names.
 */
/**
 * Build payloads for both sats-unit and msats-unit APIs.
 * LNbits changed from msats → sats in the withdraw extension around v0.12.
 * We try sats first (current), then msats fallback (legacy).
 */
const WITHDRAW_PAYLOADS = (sats, title) => {
  const msats = sats * 1000;
  return [
    // ── sats-unit (current LNbits withdraw extension) ──────────────────────
    { title, min_withdrawable: sats, max_withdrawable: sats, uses: 1, wait_time: 1, is_unique: true },
    { title, min_withdrawable: sats, max_withdrawable: sats, uses: 1, wait_time: 1 },
    { title, min_withdrawable: sats, max_withdrawable: sats, uses: 1, wait_time: 1, is_unique: true, use_once: true },
    // ── msats-unit (legacy / self-hosted older versions) ──────────────────
    { title, min_withdrawable: msats, max_withdrawable: msats, uses: 1, wait_time: 1, is_unique: true },
    { title, min_withdrawable: msats, max_withdrawable: msats, uses: 1, wait_time: 1 },
  ];
};

/**
 * Creates a one-time LNURL-withdraw link.
 * Tries every known endpoint + payload combination until one works.
 * On success, stores the working base in State.session.withdrawApiBase.
 */
async function createLnurlWithdraw(round) {
  const { lnbitsUrl, apiKey, satsAmount, sessionName } = State.config;
  const title   = `${sessionName} — Round ${round}`;
  const bases    = WITHDRAW_BASES(lnbitsUrl);
  const payloads = WITHDRAW_PAYLOADS(satsAmount, title);  // pass sats, not msats

  // Probe log for the error toast
  const attempts = [];

  for (const base of bases) {
    const endpoint = `${base}/links`;

    // First check if this base path exists at all (GET is cheaper than POST)
    let baseReachable = false;
    try {
      const probe = await fetch(endpoint, { headers: { 'X-Api-Key': apiKey } });
      console.log(`[LNbits] GET ${endpoint} → ${probe.status}`);
      if (probe.status === 404) {
        attempts.push(`GET ${endpoint} → 404 (skipping)`);
        continue; // wrong path entirely — try next base
      }
      if (probe.status === 401 || probe.status === 403) {
        // Auth error on right path — no point trying other payloads, throw immediately
        const body = await probe.text();
        throw new Error(`Auth error (HTTP ${probe.status}): check your Admin API key.\nServer: ${body.slice(0, 100)}`);
      }
      baseReachable = true;
      attempts.push(`GET ${endpoint} → ${probe.status} ✓`);
    } catch (e) {
      if (e.message.startsWith('Auth error')) throw e;
      attempts.push(`GET ${endpoint} → network error: ${e.message}`);
      continue;
    }

    if (!baseReachable) continue;

    // Try each payload variant
    for (const payload of payloads) {
      try {
        console.log(`[LNbits] POST ${endpoint}`, payload);
        const res  = await fetch(endpoint, {
          method: 'POST',
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const raw  = await res.text();
        console.log(`[LNbits] POST ${res.status}:`, raw.slice(0, 400));

        if (!res.ok) {
          attempts.push(`POST ${endpoint} (${JSON.stringify(payload).slice(0,60)}…) → ${res.status}: ${raw.slice(0,120)}`);
          if (res.status === 422) continue; // payload mismatch — try next variant
          break; // other error — move to next base
        }

        let data;
        try { data = JSON.parse(raw); }
        catch (_) { attempts.push(`POST → non-JSON response`); continue; }

        console.log('[LNbits] ✅ Created link, fields:', Object.keys(data));

        // Extract LNURL — field name varies by version
        let rawLnurl = data.lnurl || data.lnurl_full || data.lnurl_encoded
                    || data.lnurl_url || data.LNURL || null;

        // If not in POST response, fetch GET to find it
        if (!rawLnurl && data.id) {
          console.log('[LNbits] lnurl missing in POST, trying GET /links/' + data.id);
          try {
            const gr = await fetch(`${base}/links/${data.id}`, { headers: { 'X-Api-Key': apiKey } });
            if (gr.ok) {
              const gd = await gr.json();
              console.log('[LNbits] GET link fields:', Object.keys(gd));
              rawLnurl = gd.lnurl || gd.lnurl_full || gd.lnurl_encoded
                       || gd.lnurl_url || gd.LNURL || null;
            }
          } catch (_) {}
        }

        if (!rawLnurl) {
          attempts.push(`POST success but no lnurl field. Fields: ${Object.keys(data).join(',')}`);
          console.warn('[LNbits] No lnurl field. Full data:', data);
          continue;
        }

        const finalLnurl = normaliseLnurl(rawLnurl);
        if (!finalLnurl) {
          attempts.push(`lnurl normalise failed: ${rawLnurl.slice(0,60)}`);
          continue;
        }

        // ✅ All good
        State.session.withdrawApiBase = base;
        console.log('[LNbits] ✅ LNURL ready:', finalLnurl.slice(0, 50) + '...');
        return { id: data.id, lnurl: finalLnurl };

      } catch (networkErr) {
        attempts.push(`POST ${endpoint} → network: ${networkErr.message}`);
        console.warn('[LNbits] POST network error:', networkErr);
      }
    }
  }

  // All paths failed — build a useful error
  const summary = attempts.slice(-8).join('\n');
  console.error('[LNbits] All attempts failed:\n' + summary);

  // Determine best hint from attempt log
  let hint = '';
  if (summary.includes('404') || attempts.every(a => a.includes('404') || a.includes('skipping'))) {
    hint = 'The withdraw extension was not found at any known path.\n→ In LNbits go to Extensions and enable "Withdraw" (or "LNURLw").\n→ Make sure you saved the correct LNbits URL.';
  } else if (summary.includes('401') || summary.includes('403')) {
    hint = 'API key rejected. Use your Admin key (not Invoice key).';
  } else if (summary.includes('422')) {
    hint = 'Payload validation failed on all variants. Try a different LNbits version or check the API docs.';
  } else if (summary.includes('network')) {
    hint = 'Network error — check CORS settings and the LNbits URL.';
  }

  throw new Error(
    `Could not create withdraw link after trying ${bases.length} paths × ${payloads.length} payloads.\n` +
    (hint ? `\n${hint}\n` : '') +
    `\nAttempt log:\n${summary}`
  );
}

/**
 * Normalise any LNURL representation to a proper bech32 LNURL string.
 *
 * Accepts:
 *   "lnurl1..." / "LNURL1..."  → return lowercased (already bech32)
 *   "lightning:lnurl1..."      → strip prefix, return lowercased
 *   "https://..."              → encode to bech32 via lnurlEncode()
 */
function normaliseLnurl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const stripped = raw.replace(/^lightning:/i, '').trim();
  if (/^lnurl1/i.test(stripped)) return stripped.toLowerCase();
  if (/^https?:\/\//i.test(stripped)) {
    try { return lnurlEncode(stripped); }
    catch (e) { console.warn('[normaliseLnurl] encode failed:', e); return null; }
  }
  return null;
}

/**
 * Encode a plain URL to bech32 LNURL format (RFC compliant).
 * Minimal pure-JS implementation — no external library needed.
 */
function lnurlEncode(url) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

  function polymod(values) {
    let chk = 1;
    for (const v of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GENERATOR[i];
    }
    return chk;
  }

  function hrpExpand(hrp) {
    const ret = [];
    for (let p = 0; p < hrp.length; p++) ret.push(hrp.charCodeAt(p) >> 5);
    ret.push(0);
    for (let p = 0; p < hrp.length; p++) ret.push(hrp.charCodeAt(p) & 31);
    return ret;
  }

  function convertbits(data, frombits, tobits, pad) {
    let acc = 0, bits = 0;
    const ret = [];
    const maxv = (1 << tobits) - 1;
    for (const value of data) {
      acc = (acc << frombits) | value;
      bits += frombits;
      while (bits >= tobits) { bits -= tobits; ret.push((acc >> bits) & maxv); }
    }
    if (pad && bits > 0) ret.push((acc << (tobits - bits)) & maxv);
    return ret;
  }

  const hrp = 'lnurl';
  const data = convertbits(Array.from(new TextEncoder().encode(url)), 8, 5, true);
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >> (5 * (5 - i))) & 31);
  return hrp + '1' + data.concat(checksum).map(d => CHARSET[d]).join('');
}

/**
 * Returns the base API path that successfully created the last link.
 * Falls back to the first known path if not yet set.
 */
function getWithdrawApiBase() {
  return State.session.withdrawApiBase || WITHDRAW_BASES(State.config.lnbitsUrl)[0];
}

async function checkLnurlStatus(linkId) {
  const { apiKey } = State.config;
  const base = getWithdrawApiBase();
  const res = await fetch(`${base}/links/${linkId}`, {
    headers: { 'X-Api-Key': apiKey },
  });

  // Some LNbits versions delete the link after it is used.
  // Treat a 404 as "claimed" by returning a synthetic object.
  if (res.status === 404) {
    console.log('[Poll] Link 404 — treating as claimed (auto-deleted after use)');
    return { _auto_deleted: true, times_used: 1, uses_left: 0 };
  }

  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return await res.json();
}

async function deleteLnurlLink(linkId) {
  const { apiKey } = State.config;
  const base = getWithdrawApiBase();
  try {
    await fetch(`${base}/links/${linkId}`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': apiKey },
    });
  } catch (e) {}
}

// ─── Wallet balance helper ────────────────────────────────────────────────────
async function fetchWalletBalance() {
  const { lnbitsUrl, apiKey } = State.config;
  const res = await fetch(`${lnbitsUrl}/api/v1/wallet`, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!res.ok) throw new Error(`wallet fetch ${res.status}`);
  const data = await res.json();
  // balance is in msats
  return typeof data.balance === 'number' ? data.balance : null;
}

// ─── Polling ──────────────────────────────────────────────────────────────────
// Primary method: compare wallet balance to snapshot taken at round start.
// If balance dropped by ≥ satsAmount*1000 msats → payment went through.
// Fallback: also check every link-status field for completeness.
function startPolling(linkId, round) {
  clearInterval(State.pollInterval);

  let claimFired = false;
  let pollCount  = 0;
  const manualBar = document.getElementById('manual-claim-bar');
  const pollDebug = document.getElementById('poll-debug');
  const expectedDrop = State.config.satsAmount * 1000; // msats

  State.pollInterval = setInterval(async () => {
    if (!State.session.active || claimFired) {
      clearInterval(State.pollInterval);
      return;
    }
    pollCount++;

    try {
      // ── Primary: wallet balance drop ────────────────────────────────────
      const currentBalance = await fetchWalletBalance();
      const startBalance   = State.session.balanceAtRoundStart;
      const drop           = (startBalance !== null && currentBalance !== null)
                             ? startBalance - currentBalance : 0;
      // Accept any drop between 100% and 102% of the expected amount to allow
      // for routing fees while rejecting unrelated outgoing payments.
      const claimedByBalance = drop >= expectedDrop && drop <= expectedDrop * 1.1;

      // ── Fallback: link status fields ────────────────────────────────────
      let linkClaimed = false;
      let linkRaw = {};
      try {
        linkRaw = await checkLnurlStatus(linkId);
        const timesUsed   = linkRaw.times_used ?? linkRaw.used_times ?? 0;
        const usedBool    = linkRaw.used === true;
        const usesLeft    = (typeof linkRaw.uses_left === 'number') ? linkRaw.uses_left : null;
        const usesZero    = (typeof linkRaw.uses === 'number') && linkRaw.uses === 0;
        const autoDeleted = linkRaw._auto_deleted === true;
        linkClaimed = autoDeleted || usedBool || timesUsed >= 1 || usesLeft === 0 || usesZero;
      } catch (_) {}

      const isClaimed = claimedByBalance || linkClaimed;

      const debugLine =
        `[${new Date().toLocaleTimeString()}] poll #${pollCount}\n` +
        `  balance: ${startBalance !== null ? Math.floor(startBalance/1000)+'→'+Math.floor(currentBalance/1000)+' sats' : 'unknown'}\n` +
        `  drop: ${Math.floor(drop/1000)} sats  (need ${State.config.satsAmount})  byBalance=${claimedByBalance}\n` +
        `  link uses=${linkRaw.uses} used=${linkRaw.used} times_used=${linkRaw.times_used} uses_left=${linkRaw.uses_left}  byLink=${linkClaimed}\n` +
        `  → claimed=${isClaimed}`;

      console.log('[Poll]', debugLine);
      if (manualBar) manualBar.style.display = 'block';
      if (pollDebug) pollDebug.textContent = debugLine;

      if (isClaimed) {
        claimFired = true;
        clearInterval(State.pollInterval);
        clearInterval(State.countdownInterval);
        if (manualBar) manualBar.style.display = 'none';
        onClaimed(round);
      }

    } catch (err) {
      console.warn('[Poll] error:', err.message);
      if (pollDebug) pollDebug.textContent =
        `[${new Date().toLocaleTimeString()}] poll #${pollCount} ERROR: ${err.message}`;
      if (manualBar) manualBar.style.display = 'block';
    }
  }, 3000);
}

// ─── Manual claim override ────────────────────────────────────────────────────
// Operator button: if auto-detection silently fails, press this after the QR
// is visibly used to advance the round and count the claim correctly.
function manualMarkClaimed() {
  const round = State.session.currentRound;
  if (!State.session.active) return;
  if (State.session._lastClaimedRound === round) {
    toast('This round is already marked as claimed.', 'info');
    return;
  }
  clearInterval(State.pollInterval);
  clearInterval(State.countdownInterval);
  const manualBar = document.getElementById('manual-claim-bar');
  if (manualBar) manualBar.style.display = 'none';
  onClaimed(round);
}

// ─── On claimed ───────────────────────────────────────────────────────────────
async function onClaimed(round) {
  // Guard against double-fire
  if (State.session._lastClaimedRound === round) return;
  State.session._lastClaimedRound = round;

  State.session.claimedCount++;
  const recipientId = generateRecipientId(round);
  State.blockedFingerprints.add(recipientId);
  updateBlockedList();
  updateLogEntry(round, 'withdrawn', new Date().toLocaleString(), recipientId);
  showQrState('confirmed');
  setStatusDot('done');
  $('qr-status-text').textContent = i18n.t('qr_status_claimed', { n: round });

  try {
    await fetch('tables/scan_recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: generateId(),
        session_id: State.session.id,
        round_number: round,
        fingerprint_hash: recipientId,
        lnurl_withdraw_id: State.session.currentLinkId,
        status: 'withdrawn',
        scanned_at: new Date().toISOString(),
        withdrawn_at: new Date().toISOString(),
      })
    });
  } catch (e) {}

  updateStats();
  toast(i18n.t('toast_claimed', { n: round, sats: State.config.satsAmount }), 'success');

  setTimeout(() => {
    if (State.session.currentRound >= State.config.totalRounds) finishSession();
    else nextRound();
  }, 2500);
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function startCountdown() {
  clearInterval(State.countdownInterval);
  State.countdownSeconds = State.config.expiryMinutes * 60;
  updateCountdownDisplay();

  State.countdownInterval = setInterval(() => {
    State.countdownSeconds--;
    updateCountdownDisplay();
    if (State.countdownSeconds <= 0) {
      clearInterval(State.countdownInterval);
      clearInterval(State.pollInterval);
      onExpired();
    }
  }, 1000);
}

function updateCountdownDisplay() {
  const s = State.countdownSeconds;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const timerEl = $('countdown-timer');
  timerEl.textContent = `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  timerEl.classList.toggle('urgent', s <= 60);
}

// ─── On expired ───────────────────────────────────────────────────────────────
async function onExpired() {
  const round = State.session.currentRound;
  // Guard: don't double-expire the same round
  if (State.session._lastExpiredRound === round) return;
  State.session._lastExpiredRound = round;
  State.session.expiredCount++;
  if (State.session.currentLinkId) await deleteLnurlLink(State.session.currentLinkId);
  updateLogEntry(round, 'expired', '—', '—');
  showQrState('expired');
  setStatusDot('done');
  $('qr-status-text').textContent = i18n.t('qr_status_expired', { n: round });
  updateStats();
  toast(i18n.t('toast_expired'), 'warning');
  setTimeout(() => nextRound(), 2000);
}

// ─── Finish session ───────────────────────────────────────────────────────────
function finishSession() {
  State.session.active = false;
  clearInterval(State.pollInterval);
  clearInterval(State.countdownInterval);
  showQrState('done');
  setStatusDot('done');
  $('qr-status-text').textContent = i18n.t('qr_status_done');
  $('progress-fill').style.width = '100%';
  $('progress-label').textContent = i18n.t('progress_label', {
    claimed: State.session.claimedCount,
    total: State.config.totalRounds
  });

  try {
    fetch(`tables/withdraw_sessions/${State.session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', current_round: State.session.currentRound })
    });
  } catch (e) {}

  setTimeout(() => showCompletePanel(), 1500);
}

function showCompletePanel() {
  const { claimedCount, expiredCount } = State.session;
  const { satsAmount, totalRounds } = State.config;
  const totalSent = claimedCount * satsAmount;

  const subtitleKey = claimedCount === 1 ? 'complete_subtitle' : 'complete_subtitle_pl';
  $('complete-subtitle').textContent = i18n.t(subtitleKey, {
    claimed: claimedCount, total: totalRounds, sats: satsAmount.toLocaleString()
  });

  $('cs-total-sent').textContent = totalSent.toLocaleString();
  $('cs-recipients').textContent = claimedCount;
  $('cs-expired').textContent    = expiredCount;

  const tbody = $('complete-log-tbody');
  tbody.innerHTML = '';
  State.log.forEach((entry, i) => tbody.appendChild(buildLogRow(i + 1, entry)));

  showPanel('complete-panel');
}

function startNewSession() { showPanel('setup-panel'); }

function endSession() {
  if (!confirm(i18n.t('confirm_end_session'))) return;
  clearInterval(State.pollInterval);
  clearInterval(State.countdownInterval);
  if (State.session.currentLinkId) deleteLnurlLink(State.session.currentLinkId);
  State.session.active = false;
  showCompletePanel();
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  $(panelId).classList.add('active');
  window.scrollTo(0, 0);
}

function showQrState(state) {
  ['loading','display','confirmed','expired','done'].forEach(s => {
    const el = $(`qr-${s}`);
    if (el) el.classList.toggle('hidden', s !== state);
  });
}

function setStatusDot(type) {
  const dot = $('status-dot');
  dot.className = `status-dot ${type}`;
}

function displayQr(lnurl) {
  const container = $('qrcode-container');
  container.innerHTML = '';
  new QRCode(container, {
    text: lnurl.toUpperCase(),
    width: 240,
    height: 240,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function copyLnurl() {
  const val = $('lnurl-string').value;
  if (!val) return;
  navigator.clipboard.writeText(val)
    .then(() => toast(i18n.t('toast_lnurl_copied'), 'success'))
    .catch(() => {
      $('lnurl-string').select();
      document.execCommand('copy');
      toast(i18n.t('toast_lnurl_copied2'), 'success');
    });
}

function updateStats() {
  const { claimedCount, expiredCount } = State.session;
  const { totalRounds } = State.config;
  $('stat-claimed').textContent   = claimedCount;
  $('stat-remaining').textContent = Math.max(0, totalRounds - claimedCount);
  $('stat-expired').textContent   = expiredCount;
}

// ─── Log ──────────────────────────────────────────────────────────────────────
function addLogEntry(round, status, claimedAt, recipientId) {
  State.log.push({ round, status, claimedAt, recipientId });
  renderLog();
}

function updateLogEntry(round, status, claimedAt, recipientId) {
  const entry = State.log.find(e => e.round === round && e.status === 'pending');
  if (entry) { entry.status = status; entry.claimedAt = claimedAt; entry.recipientId = recipientId; }
  renderLog();
}

function renderLog() {
  const tbody = $('log-tbody');
  if (!tbody) return;
  if (!State.log.length) {
    tbody.innerHTML = `<tr class="log-empty-row"><td colspan="5">${i18n.t('log_empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  State.log.forEach((entry, i) => tbody.appendChild(buildLogRow(i + 1, entry)));
}

function buildLogRow(index, entry) {
  const tr = document.createElement('tr');
  const statusClass = entry.status === 'withdrawn' ? 'withdrawn'
                    : entry.status === 'expired'   ? 'expired'  : 'pending';
  const statusIcon  = entry.status === 'withdrawn' ? '✅'
                    : entry.status === 'expired'   ? '⏱️'       : '⏳';
  const statusLabel = i18n.t(`log_status_${entry.status}`);
  const roundLabel  = i18n.t('round_badge', { n: entry.round });

  tr.innerHTML = `
    <td>${index}</td>
    <td>${roundLabel}</td>
    <td><span class="log-status-pill ${statusClass}">${statusIcon} ${statusLabel}</span></td>
    <td>${entry.claimedAt || '—'}</td>
    <td class="recipient-id-cell" title="${entry.recipientId || '—'}">${truncate(entry.recipientId || '—', 16)}</td>
  `;
  return tr;
}

function updateBlockedList() {
  const el = $('blocked-list');
  if (!el) return;
  if (!State.blockedFingerprints.size) {
    el.innerHTML = `<span class="muted">${i18n.t('blocked_none')}</span>`;
    return;
  }
  el.innerHTML = '';
  State.blockedFingerprints.forEach(fp => {
    const tag = document.createElement('span');
    tag.className = 'blocked-tag';
    tag.textContent = truncate(fp, 16);
    tag.title = fp;
    el.appendChild(tag);
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function generateRecipientId(round) {
  const ts = Date.now();
  const raw = `round-${round}-${ts}-${Math.random().toString(36).slice(2, 8)}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) + hash) + raw.charCodeAt(i); hash = hash & hash; }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `rcpt-${hex}-${raw.split('-').pop()}`;
}

function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function toast(msg, type = 'info', duration = 4000) {
  const container = $('toast-container');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  div.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => {
    div.style.transition = 'all 0.3s ease';
    div.style.opacity = '0';
    div.style.transform = 'translateX(120%)';
    setTimeout(() => div.remove(), 300);
  }, duration);
}
