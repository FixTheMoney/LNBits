/**
 * ⚡ Lightning QR Drop — Single-file bundle
 *
 * Load order:
 *   1. i18n IIFE  (defines window.i18n)
 *   2. App logic  (State, all functions — 'use strict')
 *   3. Boot wiring (button addEventListener, lang init)
 *      — NO DOMContentLoaded wrapper; script is at end of <body>
 *        so all DOM elements already exist when this executes.
 *
 * Why one file?
 *   Genspark's hosted environment either sandboxes deferred external scripts
 *   or fires DOMContentLoaded before deferred scripts execute, making
 *   cross-file global references (i18n, setLang, …) undefined at wire-up time.
 *   A single non-deferred <script src="js/main.js"> at the bottom of <body>
 *   guarantees load order and full DOM availability with zero timing issues.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   PART 1 — i18n Translation Engine
   Supports: English (en) | Japanese (ja)
═══════════════════════════════════════════════════════════════════════════ */

const i18n = (() => {

  // ─── Current language ─────────────────────────────────────────────────────
  let lang = localStorage.getItem('lnqr_lang') || 'en';

  // ─── Translation dictionary ───────────────────────────────────────────────
  const dict = {

    /* ══════════════════════════════════════════════════
       SHARED — used on both pages
    ══════════════════════════════════════════════════ */
    en: {
      // Poll interval
      label_poll_interval: 'Poll Interval',
      hint_poll_interval: 'How often to check if the QR was scanned (default: 3s)',

      // Claim mode
      label_claim_mode: 'Claim Mode',
      mode_auto_label: 'Auto',
      mode_manual_label: 'Manual',
      hint_mode_auto: 'QR advances automatically when a claim is detected',
      hint_mode_manual: 'QR only advances when you press the Claimed button',
      claimed_btn_auto_fallback: '✅ QR was used — Mark as Claimed',
      claimed_btn_manual: '✅ Mark as Claimed — Next QR',

      // Language toggle
      lang_toggle_label: 'Language',
      lang_en: 'EN',
      lang_ja: 'JA',

      // Nav
      nav_brand: '⚡ Lightning QR Drop',
      nav_how_it_works: 'How It Works',
      nav_back_to_app: 'Back to App',

      // Page titles
      page_title_app: '⚡ Lightning QR Drop',
      page_title_hiw: '⚡ How It Works — Lightning QR Drop',

      /* ══════════════════════════
         INDEX — Setup Panel
      ══════════════════════════ */
      app_headline: 'Lightning QR Drop',
      app_subtitle: 'Send sats to random recipients — one scan at a time',

      // Section: LNbits Connection
      section_lnbits: 'LNbits Connection',
      section_lnbits_desc: 'Connect your <a href="https://lnbits.com" target="_blank">LNbits</a> wallet to fund withdrawals. Your API key is stored locally and never sent to any server except your LNbits instance.',
      label_lnbits_url: 'LNbits Instance URL',
      hint_lnbits_url: 'Use the public demo or your own self-hosted instance',
      placeholder_lnbits_url: 'https://legend.lnbits.com',
      label_api_key: 'LNbits Admin/Invoice API Key',
      placeholder_api_key: 'Paste your LNbits Admin key here',
      hint_api_key: 'Found in LNbits → Wallet → API Info → Admin key',
      label_wallet_id: 'Wallet ID (optional)',
      placeholder_wallet_id: 'Auto-detected from API key',
      hint_wallet_id: 'Leave blank to auto-detect from your API key',
      btn_test_connection: 'Test Connection',
      btn_test_withdraw: 'Test Withdraw Ext.',
      btn_testing: 'Testing...',

      // Section: Drop Settings
      section_drop_settings: 'Drop Settings',
      label_sats_amount: 'Amount per Recipient',
      label_total_rounds: 'Number of Recipients',
      hint_total_rounds: 'Each QR auto-regenerates after a successful claim',
      label_expiry: 'QR Expiry (per code)',
      hint_expiry: 'QR expires if not scanned within this time (then regenerates)',
      label_session_name: 'Session Name (optional)',
      placeholder_session_name: 'e.g. Birthday Party Drop',

      // Total cost
      total_cost_label: 'Total Cost:',
      total_cost_across: 'across {n} recipient',
      total_cost_across_pl: 'across {n} recipients',

      // Launch
      btn_launch: 'Launch QR Drop Session',

      /* ══════════════════════════
         INDEX — Active Drop Panel
      ══════════════════════════ */
      btn_end_session: 'End Session',
      progress_label: '{claimed} / {total} claimed',
      qr_status_generating: 'Generating...',
      qr_status_waiting: 'Waiting for scan...',
      qr_status_claimed: 'Round {n} claimed! ✅',
      qr_status_expired: 'Round {n} expired — regenerating...',
      qr_status_done: 'All rounds complete!',
      round_badge: 'Round {n}',
      qr_loading_text: 'Creating LNURL-Withdraw link...',
      qr_loading_error: 'Error: {msg}. Check your LNbits connection.',
      qr_scan_label: '⚡ Scan to claim sats',
      confirmed_text: 'Sats Claimed!',
      confirmed_sub: 'Generating next QR...',
      expired_text: 'QR Expired',
      expired_sub: 'Regenerating...',
      done_text: 'All Rounds Complete!',
      done_sub: 'All recipients have received their sats.',
      expires_in: 'Expires in:',
      lnurl_copy_hint: 'Copy the LNURL string if QR won\'t scan',

      // Log sidebar
      log_title: 'Recipient Log',
      log_desc: 'Each recipient is logged to prevent duplicate claims.',
      stat_claimed: 'Claimed',
      stat_remaining: 'Remaining',
      stat_expired: 'Expired',
      log_th_num: '#',
      log_th_round: 'Round',
      log_th_status: 'Status',
      log_th_claimed_at: 'Claimed At',
      log_th_recipient_id: 'Recipient ID',
      log_empty: 'No claims yet — waiting for first scan...',
      blocked_title: 'Blocked Fingerprints',
      blocked_desc: 'Devices that already claimed sats are blocked from re-scanning.',
      blocked_none: 'None blocked yet',
      log_status_withdrawn: 'Withdrawn',
      log_status_pending: 'Pending',
      log_status_expired: 'Expired',

      /* ══════════════════════════
         INDEX — Complete Panel
      ══════════════════════════ */
      complete_title: 'Drop Complete!',
      complete_subtitle: '{claimed} of {total} recipient received {sats} sats each.',
      complete_subtitle_pl: '{claimed} of {total} recipients received {sats} sats each.',
      stat_total_sent: 'Total Sats Sent',
      stat_recipients: 'Recipients',
      complete_log_title: 'Full Session Log',
      btn_new_session: 'Start New Session',

      /* ══════════════════════════
         INDEX — Toast messages
      ══════════════════════════ */
      toast_connected: 'Connected to LNbits! Wallet: {name} ({balance} sats)',
      toast_connect_fail: 'Connection failed. See status message for details.',
      toast_launch_no_url: 'Please enter your LNbits URL',
      toast_launch_no_key: 'Please enter your LNbits API key',
      toast_launch_bad_amount: 'Amount must be at least 1 sat',
      toast_launch_bad_rounds: 'Must have at least 1 round',
      toast_qr_ready: 'Round {n} QR ready! Waiting for claim...',
      toast_qr_fail: 'Failed to create LNURL link: {msg}',
      toast_claimed: '🎉 Round {n} claimed! {sats} sats sent.',
      toast_expired: '⏱️ QR expired. Generating new one...',
      toast_lnurl_copied: 'LNURL copied to clipboard!',
      toast_lnurl_copied2: 'LNURL copied!',
      conn_status_ok: '✅ Connected! Balance: {balance} sats',
      conn_status_fail: '❌ Connection failed: {msg}. Check URL, API key, and CORS settings.',
      conn_status_missing: '⚠️ Please enter URL and API key first',
      confirm_end_session: 'End this drop session? Any active QR code will be deleted.',

      /* ══════════════════════════
         HOW IT WORKS PAGE
      ══════════════════════════ */
      hiw_title: 'How It Works',
      hiw_subtitle: 'A visual walkthrough of the full payment flow — from QR generation to sats delivery — and how the system prevents recipients from claiming more than once.',

      arch_section_title: 'System Architecture',
      arch_section_sub: 'Three actors, one protocol — no intermediaries',
      arch_card1_title: 'You (The Sender)',
      arch_card1_body: 'You configure the drop: amount per recipient, number of rounds, and expiry time. Your LNbits wallet funds every withdrawal. You never share your private keys — only your LNbits Admin API key is used.',
      arch_card2_title: 'LNbits (Your Node)',
      arch_card2_body: 'Your LNbits instance manages the LNURL-withdraw links. It enforces the <code>uses: 1</code> constraint at the protocol level — ensuring each link can only ever be redeemed once, regardless of how many times the QR is scanned.',
      arch_card3_title: 'Recipients',
      arch_card3_body: 'Each recipient scans the QR with any Lightning-compatible wallet (Phoenix, Breez, Wallet of Satoshi, etc.). Their wallet fetches the LNURL callback, constructs a payment invoice, and receives sats automatically.',

      flow_section_title: 'Step-by-Step Payment Flow',
      flow_section_sub: 'Click through each step or hit Auto-Play to animate the full flow',
      btn_autoplay: 'Auto-Play',
      btn_pause: 'Pause',
      btn_prev: 'Prev',
      btn_next: 'Next',
      btn_reset: 'Reset',
      speed_label: 'Speed:',
      speed_slow: 'Slow',
      speed_normal: 'Normal',
      speed_fast: 'Fast',

      step0_label: 'Configure',
      step1_label: 'Create Link',
      step2_label: 'Display QR',
      step3_label: 'Recipient Scans',
      step4_label: 'Detect Claim',
      step5_label: 'Auto-Regen',

      s0_actor_you: 'You',
      s0_actor_you_label: 'Sender / Admin',
      s0_actor_lnbits_label: 'Your wallet node',
      s0_actor_app: 'QR Drop App',
      s0_actor_app_label: 'This browser',
      s0_actor_recipient: 'Recipient',
      s0_actor_recipient_label: 'Unknown scanner',
      s0_msg1_title: 'Configure the Drop',
      s0_msg1_body: 'You set: <code>amount = 1000 sats</code>, <code>recipients = 5</code>, <code>expiry = 10 min</code>. Your LNbits Admin key is entered — it stays in your browser and is only sent directly to your LNbits instance.',
      s0_msg2_title: 'API Key Never Leaves Your Control',
      s0_msg2_body: 'The key is stored in <code>localStorage</code> and used only for direct API calls to your LNbits URL. It is never proxied through any third-party server.',
      s0_caption_title: 'Step 1 — Configure & Connect',
      s0_caption_body: 'You set the drop parameters. The app validates your LNbits connection and checks your wallet balance to ensure you have enough sats to fund all rounds.',

      s1_actor_app_label: 'API caller',
      s1_actor_lnbits: 'LNbits API',
      s1_actor_receives: 'Receives LNURL',
      s1_msg1_title: 'POST /withdraw/api/v1/links',
      s1_msg1_body: 'The app calls LNbits to create a new LNURL-withdraw link with the critical parameters that enforce one-time use.',
      s1_msg2_title: 'Request Payload',
      s1_msg2_body: '<code>min_withdrawable: 1000000</code> (msats) · <code>max_withdrawable: 1000000</code> · <code>uses: 1</code> ← one-time only · <code>is_unique: true</code>',
      s1_msg3_title: 'LNbits Returns LNURL String',
      s1_msg3_body: 'A bech32-encoded LNURL is returned: <code>lnurl1dp68gup69uhkcmmrv9kxsmmnwsarxvpsxqcz...</code> — this encodes the callback URL for your LNbits instance.',
      s1_caption_title: 'Step 2 — Create One-Time Withdraw Link',
      s1_caption_body: 'The app sends a single API call to your LNbits instance to create a <strong>LNURL-withdraw link with <code>uses=1</code></strong>. This is the core of the one-time-use guarantee — LNbits enforces this at the protocol level.',

      s2_actor_app_label: 'Renders QR',
      s2_actor_screen: 'Your Screen',
      s2_actor_screen_label: 'QR displayed',
      s2_actor_recipient_label: 'Waiting to scan',
      s2_msg1_title: 'QR Code Rendered On-Screen',
      s2_msg1_body: 'The LNURL string is encoded into a QR code using QRCode.js (client-side, no server needed). A <strong>countdown timer</strong> starts (e.g. 10 minutes).',
      s2_msg2_title: 'Polling Begins (every 3 seconds)',
      s2_msg2_body: 'The app silently polls <code>GET /withdraw/api/v1/links/{id}</code> every 3 seconds, watching for <code>used = true</code> to confirm a claim.',
      s2_msg3_title: 'Expiry Guard is Active',
      s2_msg3_body: 'If no one claims the QR before the countdown reaches 0, the app deletes the unused link and auto-generates a fresh one — no sats are lost.',
      s2_caption_title: 'Step 3 — Display & Monitor QR',
      s2_caption_body: 'The QR is shown on screen with a live countdown. Background polling watches for the first claim. The expiry timer ensures the session never stalls — expired QRs auto-regenerate.',

      s3_actor_screen_label: 'QR displayed',
      s3_actor_recipient_label: 'Scans QR',
      s3_actor_lnbits_label: 'Callback handler',
      s3_msg1_title: 'Recipient Scans QR with LN Wallet',
      s3_msg1_body: 'Their wallet decodes the LNURL, fetches the callback URL from LNbits: <code>GET lnbits.com/withdraw/api/v1/lnurl/{hash}</code> — LNbits returns the withdraw params.',
      s3_msg2_title: 'Wallet Constructs Invoice & Submits',
      s3_msg2_body: 'The recipient\'s wallet generates a Lightning invoice for exactly 1000 sats and calls the LNbits callback URL with it. LNbits verifies and pays it immediately.',
      s3_msg3_title: 'Sats Arrive in Recipient\'s Wallet',
      s3_msg3_body: 'The Lightning payment settles on the network. LNbits marks the link as <code>used = true</code> and decrements remaining uses to <code>0</code>. The link is now permanently exhausted.',
      s3_caption_title: 'Step 4 — Recipient Claims Sats',
      s3_caption_body: 'The recipient\'s wallet handles the entire claim flow automatically. They just scan and receive — no sign-up, no account, no friction. The sats are pushed to their wallet over the Lightning Network.',

      s4_actor_app_label: 'Polling detects claim',
      s4_actor_log: 'Recipient Log',
      s4_actor_log_label: 'Session DB',
      s4_actor_block: 'Block List',
      s4_actor_block_label: 'Fingerprint store',
      s4_msg1_title: 'Poll Returns used = true',
      s4_msg1_body: 'The 3-second poll detects <code>used = true</code> on the link. The app immediately stops polling and records the claim with a pseudonymous recipient ID.',
      s4_msg2_title: 'Recipient ID Generated & Logged',
      s4_msg2_body: 'A fingerprint token is generated from <code>round + timestamp + entropy</code> and stored in the session log. This ID is displayed in the Recipient Log table.',
      s4_msg3_title: 'Round Marked Consumed — Link Destroyed',
      s4_msg3_body: 'The LNURL-withdraw link has <code>uses_left = 0</code> at the LNbits level. Even if someone has a copy of the QR code, any future scan returns an error from LNbits — <strong>it is cryptographically impossible to redeem again.</strong>',
      s4_caption_title: 'Step 5 — Log & Block',
      s4_caption_body: 'The claim is detected, logged with a recipient identifier, and the consumed link is permanently unusable. The block list grows after each round to track who has claimed.',

      s5_actor_app_label: 'Auto-regenerates',
      s5_actor_lnbits_label: 'New link created',
      s5_actor_next: 'Next Recipient',
      s5_actor_next_label: 'Fresh QR waiting',
      s5_msg1_title: '2.5 Second Delay → New Round Starts',
      s5_msg1_body: 'After confirming the claim, the app waits briefly (to show the ✅ confirmed screen), then calls LNbits again to create a brand-new LNURL-withdraw link for the next recipient.',
      s5_msg2_title: 'Completely New Link & New QR',
      s5_msg2_body: 'The new link has a completely different ID, hash, and LNURL string. The old QR is worthless. A new QR is rendered and displayed — ready for the next scanner.',
      s5_msg3_title: 'Round Counter Advances',
      s5_msg3_body: 'The progress bar updates. If <code>currentRound &lt; totalRounds</code>, the cycle repeats. When all rounds are exhausted, the session ends and the summary screen is shown.',
      s5_caption_title: 'Step 6 — Auto-Regenerate for Next Recipient',
      s5_caption_body: 'The cycle repeats automatically — no manual intervention needed. Each new QR is completely independent. You just leave the screen displayed and let recipients scan one by one.',

      anti_section_title: 'How Double-Dipping is Prevented',
      anti_section_sub: 'Three independent layers working together — protocol, link, and session',

      layer1_title: 'Layer 1 — Protocol Level',
      layer1_body: 'The strongest protection. The LNURL-withdraw link is created with <strong>uses=1</strong> and <strong>is_unique=true</strong>. This is enforced by LNbits at the server level.',
      layer1_li1: 'When a wallet calls the callback URL, LNbits checks remaining uses atomically',
      layer1_li2: 'If <code>uses_left = 0</code>, LNbits returns an error and refuses to pay',
      layer1_li3: 'No amount of retrying can bypass this — the link is exhausted at the database level',
      layer1_li4: 'Even if a second person scans the same QR photo, LNbits rejects it',

      layer2_title: 'Layer 2 — One QR Per Round',
      layer2_body: 'Each round generates a completely <strong>new, unique LNURL link</strong>. The previous QR code stops working the moment it\'s been claimed.',
      layer2_li1: 'The app immediately rotates to a new link after each claim',
      layer2_li2: 'Old QR photos shared via messaging apps become invalid',
      layer2_li3: 'Each new link has a unique cryptographic identifier from LNbits',
      layer2_li4: 'Expired links are explicitly deleted via the API to prevent late claims',

      layer3_title: 'Layer 3 — Recipient Fingerprinting',
      layer3_body: 'Each successful claim is logged with a <strong>pseudonymous recipient ID</strong> tied to the round and timestamp. The blocked list provides an audit trail.',
      layer3_li1: 'A unique token is generated per claim: <code>round + timestamp + entropy</code>',
      layer3_li2: 'All claimed IDs are shown in the Recipient Log table in real time',
      layer3_li3: 'The blocked fingerprints panel gives you visibility into who claimed each round',
      layer3_li4: 'Session data is persisted to the database for post-session review',

      layer4_title: 'Layer 4 — Expiry & Cleanup',
      layer4_body: 'QR codes expire after a configurable time window. Expired links are <strong>deleted via the API</strong>, not just ignored — preventing late redemptions.',
      layer4_li1: 'Countdown timer is displayed publicly — recipients know time is limited',
      layer4_li2: 'On expiry: <code>DELETE /withdraw/api/v1/links/{id}</code> is called immediately',
      layer4_li3: 'A fresh link is created for the next attempt — the round count continues',
      layer4_li4: 'Expiry events are logged separately from claims in the session log',

      scenario_box_title: 'Scenario Comparison: Legitimate Claim vs. Attempted Double-Dip',
      scenario_tab_good: '✅ Legitimate Claim',
      scenario_tab_double: '❌ Attempted Double-Dip',
      scenario_tab_share: '❌ Shared QR Attack',

      good_s1_title: 'QR Generated (Round 3, uses=1)',
      good_s1_body: 'New LNURL-withdraw link created. Link ID: <code>abc123</code>, uses_left: 1',
      good_s2_title: 'Alice scans with Phoenix Wallet',
      good_s2_body: 'Wallet calls <code>GET lnbits/lnurl/abc123</code> → LNbits checks: uses_left = 1 ✅',
      good_s3_title: 'Invoice submitted → 1000 sats paid to Alice',
      good_s3_body: 'LNbits sets uses_left = 0. Link permanently exhausted. Alice receives sats. ✅',
      good_s4_title: 'App detects claim → logs Alice → generates Round 4 QR',
      good_s4_body: 'New link ID: <code>def456</code>. Fresh QR displayed. Alice\'s ID added to log.',
      good_outcome: '✅ Alice receives 1000 sats. One clean transaction. Link abc123 is gone forever.',

      double_s1_title: 'Bob scans the QR first — 1000 sats claimed',
      double_s1_body: 'Link <code>abc123</code> → uses_left goes from 1 → 0. Bob receives sats. ✅ for Bob.',
      double_s2_title: 'Bob immediately tries to scan the same QR again',
      double_s2_body: 'Wallet calls <code>GET lnbits/lnurl/abc123</code> again → LNbits checks: uses_left = 0 ❌',
      double_s3_title: 'LNbits returns error: "LNURL link already used"',
      double_s3_body: 'Bob\'s wallet shows an error. No payment is made. The callback refuses to issue a second payment for the exhausted link.',
      double_s4_title: 'App has already rotated to a new QR for Round 4',
      double_s4_body: 'The app detected the claim and generated link <code>def456</code>. Bob cannot access that either.',
      double_outcome: '❌ Bob\'s double-dip attempt fails. LNbits enforces uses=1 at the server level. No sats lost.',

      share_s1_title: 'Carol takes a screenshot of the QR and shares it in a group chat',
      share_s1_body: '10 people in the group now have the QR image for link <code>abc123</code>. Everyone tries to scan simultaneously.',
      share_s2_title: 'The first person to complete the callback wins',
      share_s2_body: 'LNbits processes the first valid invoice submission atomically — uses_left: 1 → 0. Only one payment is made regardless of how many people try at the same time.',
      share_s3_title: 'All other 9 people get "already used" errors from LNbits',
      share_s3_body: 'No matter how fast they are, the link is exhausted after the first claim. Race conditions cannot result in double payments.',
      share_s4_title: 'Old QR is also expired/rotated by the time others try',
      share_s4_body: 'The app detects the claim and rotates to a new QR. The old screenshot is obsolete and cannot be used against future rounds either.',
      share_outcome: '❌ Shared QR attack fails. Only 1-of-10 receives sats (the first to claim). Exactly as intended — first come, first served.',

      lnurl_section_title: 'LNURL-Withdraw Anatomy',
      lnurl_section_sub: 'What\'s inside the QR code and how the protocol enforces one-time use',
      lnurl_intro: 'The QR code encodes a <strong>bech32-encoded LNURL</strong> string. When scanned, the recipient\'s wallet decodes it to a URL and makes an HTTP request to your LNbits instance. The response is a JSON object specifying the withdraw parameters:',
      ann_tag_desc: '<strong>Identifies the type</strong> as a "withdrawRequest" — tells the wallet to present a receive UI, not a payment UI.',
      ann_k1_desc: '<strong>Challenge token</strong> — a random value LNbits generates. Must be echoed back in the callback to prove the wallet fetched the correct link.',
      ann_minmax_desc: '<strong>Both set to the same value</strong> (e.g. 1,000,000 msats = 1000 sats) — forces the exact amount. The wallet cannot request more or less.',
      ann_callback_desc: '<strong>The endpoint to POST the invoice to.</strong> This is your LNbits server — it validates the invoice and executes the Lightning payment.',
      ann_uses_desc: '<strong>Stored in LNbits DB</strong> — not in the LNURL itself. LNbits checks this atomically before processing any callback, preventing race-condition exploits.',
      ann_unique_desc: '<strong>Forces a unique hash</strong> per link so that even if two links have the same parameters, their LNURL strings are different and cannot be confused.',

      seq_section_title: 'Full Sequence Diagram',
      seq_section_sub: 'Message flow between all actors for one complete round',

      api_section_title: 'API Calls Reference',
      api_section_sub: 'Every LNbits endpoint used by the app and when it\'s called',
      api_th_when: 'When',
      api_th_method: 'Method',
      api_th_endpoint: 'Endpoint',
      api_th_purpose: 'Purpose',
      api_th_params: 'Key Params',
      api_r1_when: 'Test Connection',
      api_r1_purpose: 'Verify API key, fetch balance',
      api_r1_params: 'Header: <code>X-Api-Key</code>',
      api_r2_when: 'Each Round Start',
      api_r2_purpose: 'Create one-time withdraw link',
      api_r2_params: '<code>uses=1</code>, <code>is_unique=true</code>, <code>min/max_withdrawable</code>',
      api_r3_when: 'Every 3 seconds',
      api_r3_purpose: 'Poll for claim status',
      api_r3_params: 'Checks <code>used</code> or <code>times_used ≥ 1</code>',
      api_r4_when: 'On QR Expiry',
      api_r4_purpose: 'Delete unused expired link',
      api_r4_params: 'Prevents late redemptions',
      api_r5_when: 'Recipient Scans',
      api_r5_purpose: 'LNbits returns withdraw params',
      api_r5_params: 'Called by recipient\'s wallet, not the app',
      api_r6_when: 'Recipient Claims',
      api_r6_purpose: 'Wallet submits invoice for payment',
      api_r6_params: '<code>k1</code> challenge + <code>pr</code> bolt11 invoice',

      footer_text: '⚡ Lightning QR Drop — Built on <a href="https://lnbits.com" target="_blank">LNbits</a> · LNURL-withdraw RFC · Bitcoin Lightning Network',
    },

    /* ══════════════════════════════════════════════════
       JAPANESE
    ══════════════════════════════════════════════════ */
    ja: {
      // Poll interval
      label_poll_interval: 'ポーリング間隔',
      hint_poll_interval: 'QRがスキャンされたか確認する頻度（デフォルト：3秒）',

      // Claim mode
      label_claim_mode: 'クレームモード',
      mode_auto_label: '自動',
      mode_manual_label: '手動',
      hint_mode_auto: 'クレームが検知されると自動的に次のQRに進みます',
      hint_mode_manual: 'クレームボタンを押したときだけ次のQRに進みます',
      claimed_btn_auto_fallback: '✅ QRが使用されました — クレーム済みにする',
      claimed_btn_manual: '✅ クレーム済みにする — 次のQRへ',

      lang_toggle_label: '言語',
      lang_en: 'EN',
      lang_ja: 'JA',

      nav_brand: '⚡ Lightning QR Drop',
      nav_how_it_works: '仕組みを見る',
      nav_back_to_app: 'アプリに戻る',

      page_title_app: '⚡ Lightning QR Drop',
      page_title_hiw: '⚡ 仕組み — Lightning QR Drop',

      app_headline: 'Lightning QR Drop',
      app_subtitle: '1回のスキャンでランダムな受取人にサットを送ろう',

      section_lnbits: 'LNbits 接続設定',
      section_lnbits_desc: '<a href="https://lnbits.com" target="_blank">LNbits</a> ウォレットを接続して引き出しに資金を提供します。APIキーはローカルに保存され、LNbitsインスタンス以外のサーバーには送信されません。',
      label_lnbits_url: 'LNbits インスタンス URL',
      hint_lnbits_url: '公開デモまたは自分でホストしたインスタンスを使用してください',
      placeholder_lnbits_url: 'https://legend.lnbits.com',
      label_api_key: 'LNbits Admin/Invoice APIキー',
      placeholder_api_key: 'LNbits Adminキーをここに貼り付けてください',
      hint_api_key: 'LNbits → ウォレット → API情報 → Adminキー で確認できます',
      label_wallet_id: 'ウォレットID（任意）',
      placeholder_wallet_id: 'APIキーから自動検出',
      hint_wallet_id: '空欄にするとAPIキーから自動検出されます',
      btn_test_connection: '接続テスト',
      btn_test_withdraw: 'Withdraw拡張テスト',
      btn_testing: 'テスト中...',

      section_drop_settings: 'ドロップ設定',
      label_sats_amount: '1人あたりの金額',
      label_total_rounds: '受取人数',
      hint_total_rounds: 'クレーム成功後にQRコードが自動更新されます',
      label_expiry: 'QR有効期限（1枚あたり）',
      hint_expiry: 'この時間内にスキャンされない場合QRが再生成されます',
      label_session_name: 'セッション名（任意）',
      placeholder_session_name: '例：誕生日パーティードロップ',

      total_cost_label: '合計コスト：',
      total_cost_across: '{n}人への送付',
      total_cost_across_pl: '{n}人への送付',

      btn_launch: 'QRドロップセッションを開始',

      btn_end_session: 'セッション終了',
      progress_label: '{claimed} / {total} 受取済み',
      qr_status_generating: '生成中...',
      qr_status_waiting: 'スキャン待ち...',
      qr_status_claimed: 'ラウンド{n} 受取完了！✅',
      qr_status_expired: 'ラウンド{n} 期限切れ — 再生成中...',
      qr_status_done: '全ラウンド完了！',
      round_badge: 'ラウンド {n}',
      qr_loading_text: 'LNURL-Withdrawリンクを作成中...',
      qr_loading_error: 'エラー：{msg}。LNbits接続を確認してください。',
      qr_scan_label: '⚡ スキャンしてサットを受け取る',
      confirmed_text: 'サット受取完了！',
      confirmed_sub: '次のQRを生成中...',
      expired_text: 'QR期限切れ',
      expired_sub: '再生成中...',
      done_text: '全ラウンド完了！',
      done_sub: '全受取人がサットを受け取りました。',
      expires_in: '有効期限：',
      lnurl_copy_hint: 'QRコードが読み取れない場合はLNURL文字列をコピーしてください',

      log_title: '受取人ログ',
      log_desc: '重複クレームを防ぐため、各受取人が記録されます。',
      stat_claimed: '受取済み',
      stat_remaining: '残り',
      stat_expired: '期限切れ',
      log_th_num: '#',
      log_th_round: 'ラウンド',
      log_th_status: 'ステータス',
      log_th_claimed_at: '受取日時',
      log_th_recipient_id: '受取人ID',
      log_empty: 'まだクレームなし — 最初のスキャンを待っています...',
      blocked_title: 'ブロック済みフィンガープリント',
      blocked_desc: 'すでにサットを受け取ったデバイスは再スキャンがブロックされます。',
      blocked_none: 'まだブロックなし',
      log_status_withdrawn: '受取済み',
      log_status_pending: '待機中',
      log_status_expired: '期限切れ',

      complete_title: 'ドロップ完了！',
      complete_subtitle: '{total}人中{claimed}人が{sats}サットを受け取りました。',
      complete_subtitle_pl: '{total}人中{claimed}人が{sats}サットを受け取りました。',
      stat_total_sent: '合計送付サット',
      stat_recipients: '受取人数',
      complete_log_title: 'セッション全ログ',
      btn_new_session: '新しいセッションを開始',

      toast_connected: 'LNbitsに接続しました！ウォレット：{name}（{balance}サット）',
      toast_connect_fail: '接続に失敗しました。ステータスメッセージを確認してください。',
      toast_launch_no_url: 'LNbits URLを入力してください',
      toast_launch_no_key: 'LNbits APIキーを入力してください',
      toast_launch_bad_amount: '金額は1サット以上である必要があります',
      toast_launch_bad_rounds: 'ラウンド数は1以上である必要があります',
      toast_qr_ready: 'ラウンド{n} QR準備完了！クレーム待ち...',
      toast_qr_fail: 'LNURLリンクの作成に失敗しました：{msg}',
      toast_claimed: '🎉 ラウンド{n} 受取完了！{sats}サット送付。',
      toast_expired: '⏱️ QR期限切れ。新しいQRを生成中...',
      toast_lnurl_copied: 'LNURLをクリップボードにコピーしました！',
      toast_lnurl_copied2: 'LNURLをコピーしました！',
      conn_status_ok: '✅ 接続成功！残高：{balance}サット',
      conn_status_fail: '❌ 接続失敗：{msg}。URL・APIキー・CORS設定を確認してください。',
      conn_status_missing: '⚠️ URLとAPIキーを先に入力してください',
      confirm_end_session: 'このドロップセッションを終了しますか？アクティブなQRコードは削除されます。',

      hiw_title: '仕組み',
      hiw_subtitle: 'QRコード生成からサット受け渡しまでの完全な支払いフローと、受取人が二重取りできない仕組みをビジュアルで解説します。',

      arch_section_title: 'システム構成',
      arch_section_sub: '3つのアクター、1つのプロトコル — 中間業者なし',
      arch_card1_title: 'あなた（送信者）',
      arch_card1_body: 'ドロップを設定します：受取人あたりの金額、ラウンド数、有効期限。LNbitsウォレットが全引き出しに資金を提供します。秘密鍵は共有せず、LNbits AdminのAPIキーのみを使用します。',
      arch_card2_title: 'LNbits（あなたのノード）',
      arch_card2_body: 'LNbitsインスタンスがLNURL-withdrawリンクを管理します。<code>uses: 1</code>制約をプロトコルレベルで強制し、QRが何度スキャンされても各リンクが一度だけ償還されることを保証します。',
      arch_card3_title: '受取人',
      arch_card3_body: '受取人はLightning対応のウォレット（Phoenix、Breez、Wallet of Satoshiなど）でQRをスキャンします。ウォレットがLNURLコールバックを取得し、支払いインボイスを作成して、自動的にサットを受け取ります。',

      flow_section_title: 'ステップ別支払いフロー',
      flow_section_sub: '各ステップをクリックするか、自動再生で全体のフローをアニメーション表示',
      btn_autoplay: '自動再生',
      btn_pause: '一時停止',
      btn_prev: '前へ',
      btn_next: '次へ',
      btn_reset: 'リセット',
      speed_label: 'スピード：',
      speed_slow: '遅い',
      speed_normal: '標準',
      speed_fast: '速い',

      step0_label: '設定',
      step1_label: 'リンク作成',
      step2_label: 'QR表示',
      step3_label: 'スキャン',
      step4_label: 'クレーム検知',
      step5_label: '自動再生成',

      s0_actor_you: 'あなた',
      s0_actor_you_label: '送信者 / 管理者',
      s0_actor_lnbits_label: 'あなたのウォレットノード',
      s0_actor_app: 'QRドロップアプリ',
      s0_actor_app_label: 'このブラウザ',
      s0_actor_recipient: '受取人',
      s0_actor_recipient_label: '未知のスキャナー',
      s0_msg1_title: 'ドロップを設定',
      s0_msg1_body: '設定内容：<code>金額 = 1000 sats</code>、<code>受取人数 = 5</code>、<code>有効期限 = 10分</code>。LNbits Adminキーを入力します — キーはブラウザに保存され、LNbitsインスタンスにのみ直接送信されます。',
      s0_msg2_title: 'APIキーは常にあなたのコントロール下',
      s0_msg2_body: 'キーは<code>localStorage</code>に保存され、LNbits URLへの直接APIコールにのみ使用されます。サードパーティのサーバーを経由することは一切ありません。',
      s0_caption_title: 'ステップ1 — 設定と接続',
      s0_caption_body: 'ドロップパラメータを設定します。アプリがLNbits接続を検証し、全ラウンドを賄うのに十分なサットがあるかウォレット残高を確認します。',

      s1_actor_app_label: 'API呼び出し元',
      s1_actor_lnbits: 'LNbits API',
      s1_actor_receives: 'LNURLを受信',
      s1_msg1_title: 'POST /withdraw/api/v1/links',
      s1_msg1_body: 'アプリがLNbitsを呼び出し、一度だけ使用可能なLNURL-withdrawリンクを作成します。',
      s1_msg2_title: 'リクエストペイロード',
      s1_msg2_body: '<code>min_withdrawable: 1000000</code>（msats）· <code>max_withdrawable: 1000000</code> · <code>uses: 1</code> ← 1回のみ · <code>is_unique: true</code>',
      s1_msg3_title: 'LNbitsがLNURL文字列を返す',
      s1_msg3_body: 'bech32エンコードされたLNURLが返されます：<code>lnurl1dp68gup69uhkcmmrv9kxsmmnwsarxvpsxqcz...</code> — これはLNbitsインスタンスのコールバックURLをエンコードしています。',
      s1_caption_title: 'ステップ2 — 一回限りの引き出しリンクを作成',
      s1_caption_body: 'アプリがLNbitsインスタンスに単一のAPIコールを送り、<strong><code>uses=1</code>のLNURL-withdrawリンク</strong>を作成します。これが一回限り使用保証の核心です — LNbitsがプロトコルレベルでこれを強制します。',

      s2_actor_app_label: 'QRをレンダリング',
      s2_actor_screen: 'あなたの画面',
      s2_actor_screen_label: 'QR表示中',
      s2_actor_recipient_label: 'スキャン待ち',
      s2_msg1_title: 'QRコードを画面に表示',
      s2_msg1_body: 'LNURL文字列がQRCode.jsを使用してQRコードにエンコードされます（クライアントサイド、サーバー不要）。<strong>カウントダウンタイマー</strong>が開始されます（例：10分）。',
      s2_msg2_title: 'ポーリング開始（3秒ごと）',
      s2_msg2_body: 'アプリが<code>GET /withdraw/api/v1/links/{id}</code>を3秒ごとに静かにポーリングし、クレーム確認のために<code>used = true</code>を監視します。',
      s2_msg3_title: '有効期限ガードが有効',
      s2_msg3_body: 'カウントダウンが0になる前に誰もQRをクレームしなければ、アプリは未使用のリンクを削除し、新しいQRを自動生成します — サットは失われません。',
      s2_caption_title: 'ステップ3 — QRの表示と監視',
      s2_caption_body: 'QRがライブカウントダウンと共に画面に表示されます。バックグラウンドポーリングが最初のクレームを監視します。有効期限タイマーによりセッションが止まることはなく、期限切れのQRは自動再生成されます。',

      s3_actor_screen_label: 'QR表示中',
      s3_actor_recipient_label: 'QRをスキャン',
      s3_actor_lnbits_label: 'コールバックハンドラー',
      s3_msg1_title: '受取人がLNウォレットでQRをスキャン',
      s3_msg1_body: 'ウォレットがLNURLをデコードし、LNbitsからコールバックURLを取得します：<code>GET lnbits.com/withdraw/api/v1/lnurl/{hash}</code> — LNbitsが引き出しパラメータを返します。',
      s3_msg2_title: 'ウォレットがインボイスを作成して送信',
      s3_msg2_body: '受取人のウォレットが正確に1000サットのLightningインボイスを生成し、LNbitsのコールバックURLに送信します。LNbitsが検証して即座に支払います。',
      s3_msg3_title: 'サットが受取人のウォレットに届く',
      s3_msg3_body: 'Lightning支払いがネットワーク上で確定します。LNbitsがリンクを<code>used = true</code>としてマークし、残余使用回数を<code>0</code>に減らします。リンクは永久に使い切られます。',
      s3_caption_title: 'ステップ4 — 受取人がサットをクレーム',
      s3_caption_body: '受取人のウォレットがクレームフロー全体を自動的に処理します。スキャンして受け取るだけ — サインアップ、アカウント、摩擦は一切なし。サットはLightningネットワーク経由でウォレットに送られます。',

      s4_actor_app_label: 'ポーリングがクレームを検知',
      s4_actor_log: '受取人ログ',
      s4_actor_log_label: 'セッションDB',
      s4_actor_block: 'ブロックリスト',
      s4_actor_block_label: 'フィンガープリントストア',
      s4_msg1_title: 'ポーリングが used = true を返す',
      s4_msg1_body: '3秒ポーリングがリンクの<code>used = true</code>を検知します。アプリはすぐにポーリングを停止し、仮名の受取人IDとともにクレームを記録します。',
      s4_msg2_title: '受取人IDを生成してログに記録',
      s4_msg2_body: '<code>ラウンド + タイムスタンプ + エントロピー</code>からフィンガープリントトークンが生成され、セッションログに保存されます。このIDが受取人ログテーブルに表示されます。',
      s4_msg3_title: 'ラウンドを消費済みとしてマーク — リンクを破棄',
      s4_msg3_body: 'LNbitsレベルでLNURL-withdrawリンクの<code>uses_left = 0</code>。QRコードのコピーを持っていても、以降のスキャンはLNbitsからエラーが返されます — <strong>再度換金することは暗号学的に不可能です。</strong>',
      s4_caption_title: 'ステップ5 — ログとブロック',
      s4_caption_body: 'クレームが検知され、受取人識別子とともに記録され、消費済みリンクは永続的に使用不可になります。ブロックリストは各ラウンド後に増加し、クレーム者を追跡します。',

      s5_actor_app_label: '自動再生成',
      s5_actor_lnbits_label: '新リンクを作成',
      s5_actor_next: '次の受取人',
      s5_actor_next_label: '新鮮なQRが待機中',
      s5_msg1_title: '2.5秒待機 → 新ラウンド開始',
      s5_msg1_body: 'クレームを確認後、アプリは少し待機（✅確認画面を表示）してから、次の受取人のために新しいLNURL-withdrawリンクを作成するLNbitsを再度呼び出します。',
      s5_msg2_title: '完全に新しいリンクと新しいQR',
      s5_msg2_body: '新しいリンクは完全に異なるID、ハッシュ、LNURL文字列を持ちます。古いQRは無価値になります。新しいQRがレンダリングされて表示され、次のスキャナーの準備が整います。',
      s5_msg3_title: 'ラウンドカウンターが進む',
      s5_msg3_body: 'プログレスバーが更新されます。<code>currentRound &lt; totalRounds</code>であれば、サイクルが繰り返されます。全ラウンドが終了するとセッションが終わり、サマリー画面が表示されます。',
      s5_caption_title: 'ステップ6 — 次の受取人のために自動再生成',
      s5_caption_body: 'サイクルは自動的に繰り返されます — 手動操作は不要。各新QRは完全に独立しています。画面を表示したまま、受取人が1人ずつスキャンするのを待つだけです。',

      anti_section_title: '二重取りを防ぐ方法',
      anti_section_sub: '3つの独立した層が連携 — プロトコル、リンク、セッション',

      layer1_title: 'レイヤー1 — プロトコルレベル',
      layer1_body: '最も強力な保護。LNURL-withdrawリンクは<strong>uses=1</strong>と<strong>is_unique=true</strong>で作成されます。これはLNbitsがサーバーレベルで強制します。',
      layer1_li1: 'ウォレットがコールバックURLを呼び出すと、LNbitsが残余使用回数をアトミックに確認',
      layer1_li2: '<code>uses_left = 0</code>の場合、LNbitsはエラーを返し支払いを拒否',
      layer1_li3: 'どれだけリトライしてもバイパス不可 — リンクはデータベースレベルで消耗',
      layer1_li4: '別の人が同じQR写真をスキャンしても、LNbitsが拒否',

      layer2_title: 'レイヤー2 — 1ラウンド1QR',
      layer2_body: '各ラウンドで完全に<strong>新しい一意のLNURLリンク</strong>が生成されます。クレームされた瞬間に前のQRコードは機能しなくなります。',
      layer2_li1: 'クレームごとにアプリが即座に新しいリンクに切り替え',
      layer2_li2: 'メッセージアプリで共有された古いQR写真は無効になる',
      layer2_li3: '各新リンクにLNbitsからの一意の暗号識別子が付与',
      layer2_li4: '期限切れリンクはAPIを通じて明示的に削除され、遅延クレームを防止',

      layer3_title: 'レイヤー3 — 受取人フィンガープリント',
      layer3_body: '各成功クレームは、ラウンドとタイムスタンプに紐づいた<strong>仮名の受取人ID</strong>とともに記録されます。ブロックリストが監査証跡を提供します。',
      layer3_li1: 'クレームごとに一意のトークンを生成：<code>ラウンド + タイムスタンプ + エントロピー</code>',
      layer3_li2: 'クレームされたIDは全てリアルタイムで受取人ログテーブルに表示',
      layer3_li3: 'ブロック済みフィンガープリントパネルで各ラウンドのクレーム者を把握',
      layer3_li4: 'セッションデータはセッション後レビュー用にデータベースに永続化',

      layer4_title: 'レイヤー4 — 有効期限とクリーンアップ',
      layer4_body: 'QRコードは設定可能な時間ウィンドウ後に期限切れになります。期限切れリンクは無視されるだけでなく<strong>APIを通じて削除</strong>され、遅延換金を防ぎます。',
      layer4_li1: 'カウントダウンタイマーが公開表示 — 受取人は時間が限られていることを把握',
      layer4_li2: '期限切れ時：<code>DELETE /withdraw/api/v1/links/{id}</code>が即座に呼び出される',
      layer4_li3: '次の試みのために新しいリンクが作成 — ラウンドカウントは継続',
      layer4_li4: '期限切れイベントはクレームとは別にセッションログに記録',

      scenario_box_title: 'シナリオ比較：正当なクレーム vs. 二重取り試み',
      scenario_tab_good: '✅ 正当なクレーム',
      scenario_tab_double: '❌ 二重取り試み',
      scenario_tab_share: '❌ QR共有攻撃',

      good_s1_title: 'QR生成（ラウンド3、uses=1）',
      good_s1_body: '新しいLNURL-withdrawリンクを作成。リンクID：<code>abc123</code>、uses_left：1',
      good_s2_title: 'アリスがPhoenixウォレットでスキャン',
      good_s2_body: 'ウォレットが<code>GET lnbits/lnurl/abc123</code>を呼び出す → LNbitsが確認：uses_left = 1 ✅',
      good_s3_title: 'インボイス送信 → アリスに1000サット支払い',
      good_s3_body: 'LNbitsがuses_left = 0に設定。リンクは永久に消耗。アリスがサットを受け取る。✅',
      good_s4_title: 'アプリがクレームを検知 → アリスを記録 → ラウンド4 QR生成',
      good_s4_body: '新しいリンクID：<code>def456</code>。新鮮なQRが表示。アリスのIDがログに追加。',
      good_outcome: '✅ アリスが1000サットを受け取る。クリーンな1回のトランザクション。リンクabc123は永久に消滅。',

      double_s1_title: 'ボブが最初にQRをスキャン — 1000サットをクレーム',
      double_s1_body: 'リンク<code>abc123</code> → uses_leftが1 → 0に。ボブがサットを受け取る。✅ ボブの場合。',
      double_s2_title: 'ボブが同じQRを再度スキャン試行',
      double_s2_body: 'ウォレットが再度<code>GET lnbits/lnurl/abc123</code>を呼び出す → LNbitsが確認：uses_left = 0 ❌',
      double_s3_title: 'LNbitsがエラーを返す：「LNURLリンクは既に使用済み」',
      double_s3_body: 'ボブのウォレットにエラーが表示。支払いは行われない。コールバックが消耗したリンクへの2回目の支払いを拒否。',
      double_s4_title: 'アプリはすでにラウンド4の新しいQRに切り替え済み',
      double_s4_body: 'アプリがクレームを検知してリンク<code>def456</code>を生成。ボブはそちらにもアクセスできない。',
      double_outcome: '❌ ボブの二重取り試みは失敗。LNbitsがサーバーレベルでuses=1を強制。サットの損失なし。',

      share_s1_title: 'キャロルがQRのスクリーンショットを撮ってグループチャットで共有',
      share_s1_body: 'グループの10人全員がリンク<code>abc123</code>のQR画像を持つ。全員が同時にスキャンを試みる。',
      share_s2_title: 'コールバックを最初に完了した人が勝ち',
      share_s2_body: 'LNbitsが最初の有効なインボイス送信をアトミックに処理 — uses_left：1 → 0。何人が同時に試みても支払いは1回のみ。',
      share_s3_title: '残りの9人はLNbitsから「使用済み」エラーを受け取る',
      share_s3_body: 'どれだけ速くても、最初のクレーム後にリンクは消耗します。競合状態が二重支払いをもたらすことはありません。',
      share_s4_title: '他の人が試みる頃には古いQRも期限切れ/切り替え済み',
      share_s4_body: 'アプリがクレームを検知して新しいQRに切り替えます。古いスクリーンショットは無効になり、将来のラウンドにも使用できません。',
      share_outcome: '❌ QR共有攻撃は失敗。10人中1人だけがサットを受け取る（最初にクレームした人）。意図通り — 早い者勝ち。',

      lnurl_section_title: 'LNURL-Withdrawの構造',
      lnurl_section_sub: 'QRコードの中身とプロトコルが一回限り使用を強制する方法',
      lnurl_intro: 'QRコードは<strong>bech32エンコードされたLNURL</strong>文字列をエンコードします。スキャンされると、受取人のウォレットがURLにデコードしてLNbitsインスタンスにHTTPリクエストを送ります。レスポンスは引き出しパラメータを指定するJSONオブジェクトです：',
      ann_tag_desc: '<strong>タイプを識別</strong>して「withdrawRequest」と判定 — ウォレットに支払いUIではなく受取UIを表示するよう指示。',
      ann_k1_desc: '<strong>チャレンジトークン</strong> — LNbitsが生成するランダムな値。ウォレットが正しいリンクを取得したことを証明するためにコールバックで返す必要がある。',
      ann_minmax_desc: '<strong>両方同じ値に設定</strong>（例：1,000,000 msats = 1000 sats）— 正確な金額を強制。ウォレットはそれ以上もそれ以下もリクエストできない。',
      ann_callback_desc: '<strong>インボイスをPOSTするエンドポイント。</strong>これはLNbitsサーバー — インボイスを検証してLightning支払いを実行する。',
      ann_uses_desc: '<strong>LNbits DBに保存</strong> — LNURL自体には含まれない。LNbitsがコールバック処理前にこれをアトミックに確認し、競合状態の悪用を防ぐ。',
      ann_unique_desc: '<strong>リンクごとに一意のハッシュを強制</strong>するため、2つのリンクが同じパラメータを持っていても、LNURL文字列が異なり混同できない。',

      seq_section_title: '完全シーケンス図',
      seq_section_sub: '1回の完全なラウンドにおける全アクター間のメッセージフロー',

      api_section_title: 'APIコールリファレンス',
      api_section_sub: 'アプリが使用する全LNbitsエンドポイントと呼び出しタイミング',
      api_th_when: 'タイミング',
      api_th_method: 'メソッド',
      api_th_endpoint: 'エンドポイント',
      api_th_purpose: '目的',
      api_th_params: '主要パラメータ',
      api_r1_when: '接続テスト時',
      api_r1_purpose: 'APIキー検証、残高取得',
      api_r1_params: 'ヘッダー：<code>X-Api-Key</code>',
      api_r2_when: '各ラウンド開始時',
      api_r2_purpose: '一回限りの引き出しリンク作成',
      api_r2_params: '<code>uses=1</code>、<code>is_unique=true</code>、<code>min/max_withdrawable</code>',
      api_r3_when: '3秒ごと',
      api_r3_purpose: 'クレームステータスをポーリング',
      api_r3_params: '<code>used</code>または<code>times_used ≥ 1</code>を確認',
      api_r4_when: 'QR期限切れ時',
      api_r4_purpose: '未使用の期限切れリンクを削除',
      api_r4_params: '遅延換金を防止',
      api_r5_when: '受取人スキャン時',
      api_r5_purpose: 'LNbitsが引き出しパラメータを返す',
      api_r5_params: 'アプリではなく受取人のウォレットが呼び出す',
      api_r6_when: '受取人クレーム時',
      api_r6_purpose: 'ウォレットが支払い用インボイスを送信',
      api_r6_params: '<code>k1</code>チャレンジ + <code>pr</code> bolt11インボイス',

      footer_text: '⚡ Lightning QR Drop — <a href="https://lnbits.com" target="_blank">LNbits</a> 搭載 · LNURL-withdraw RFC · Bitcoin Lightning Network',
    }
  };

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    getLang() { return lang; },

    setLang(l) {
      lang = l;
      localStorage.setItem('lnqr_lang', l);
      document.documentElement.lang = l;
      this.apply();
      this.applyPlaceholders();
      this.applyTitles();
      this.applyHTML();
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } }));
    },

    t(key, vars) {
      const str = (dict[lang] && dict[lang][key]) || (dict['en'] && dict['en'][key]) || key;
      if (!vars) return str;
      return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
    },

    apply() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = this.t(key);
      });
    },

    applyHTML() {
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = this.t(key);
      });
    },

    applyPlaceholders() {
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = this.t(key);
      });
    },

    applyTitles() {
      const titleKey = document.body.getAttribute('data-page-title');
      if (titleKey) document.title = this.t(titleKey);
    },

    init() {
      document.documentElement.lang = lang;
      this.apply();
      this.applyHTML();
      this.applyPlaceholders();
      this.applyTitles();
    }
  };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   PART 2 — App Logic
═══════════════════════════════════════════════════════════════════════════ */

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
    claimMode: 'auto',   // 'auto' | 'manual'
    pollIntervalSec: 3,  // seconds between claim-check requests
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
    _pendingRecipientId: null,  // manual mode: id generated at detect time, used at advance time
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
  // Refresh mode hint text
  const isManual = document.getElementById('mode-manual-btn') &&
                   document.getElementById('mode-manual-btn').classList.contains('active');
  const modeHint = document.getElementById('mode-hint');
  if (modeHint) modeHint.textContent = i18n.t(isManual ? 'hint_mode_manual' : 'hint_mode_auto');
  // Refresh claimed button label
  const claimedBtnLabel = document.getElementById('claimed-btn-label');
  if (claimedBtnLabel) {
    claimedBtnLabel.textContent = i18n.t(isManual ? 'claimed_btn_manual' : 'claimed_btn_auto_fallback');
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
      if (cfg.expiryMinutes)   $('expiry-minutes').value  = cfg.expiryMinutes;
      if (cfg.sessionName)      $('session-name').value    = cfg.sessionName;
      if (cfg.pollIntervalSec)  $('poll-interval').value   = cfg.pollIntervalSec;
    } catch (e) {}
  }
  // Restore claim mode
  const savedMode = localStorage.getItem('lnqr_claim_mode') || 'auto';
  setClaimMode(savedMode);
}

function saveConfig() {
  localStorage.setItem('lnqr_config', JSON.stringify({
    lnbitsUrl:     $('lnbits-url').value.trim(),
    apiKey:        $('api-key').value.trim(),
    walletId:      $('wallet-id').value.trim(),
    satsAmount:    parseInt($('sats-amount').value),
    totalRounds:   parseInt($('total-rounds').value),
    expiryMinutes: parseInt($('expiry-minutes').value),
    sessionName:      $('session-name').value.trim(),
    pollIntervalSec:  Math.max(1, parseInt($('poll-interval').value) || 3),
  }));
}

function bindSetupListeners() {
  $('sats-amount').addEventListener('input', updateTotalCost);
  $('total-rounds').addEventListener('input', updateTotalCost);
  // Note: mode-auto-btn / mode-manual-btn click listeners are wired in the
  // Boot section below, alongside all other buttons — single source of truth.
}

function setClaimMode(mode) {
  $('mode-auto-btn').classList.toggle('active', mode === 'auto');
  $('mode-manual-btn').classList.toggle('active', mode === 'manual');
  const hintKey = mode === 'manual' ? 'hint_mode_manual' : 'hint_mode_auto';
  $('mode-hint').textContent = i18n.t(hintKey);
  // Persist choice so loadSavedConfig can restore it
  localStorage.setItem('lnqr_claim_mode', mode);
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
    claimMode:        $('mode-manual-btn').classList.contains('active') ? 'manual' : 'auto',
    pollIntervalSec:  Math.max(1, parseInt($('poll-interval').value) || 3),
  };

  if (!cfg.lnbitsUrl)                          { toast(i18n.t('toast_launch_no_url'), 'error'); return; }
  if (!cfg.apiKey)                             { toast(i18n.t('toast_launch_no_key'), 'error'); return; }
  if (!cfg.satsAmount || cfg.satsAmount < 1)   { toast(i18n.t('toast_launch_bad_amount'), 'error'); return; }
  if (!cfg.totalRounds || cfg.totalRounds < 1) { toast(i18n.t('toast_launch_bad_rounds'), 'error'); return; }

  State.config = cfg;
  console.log('[Launch] pollIntervalSec =', cfg.pollIntervalSec, '| claimMode =', cfg.claimMode);
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

  // Show/configure manual mode badge in the drop panel
  const manualBadge = document.getElementById('manual-mode-badge');
  const manualBar   = document.getElementById('manual-claim-bar');
  const claimedBtnLabel = document.getElementById('claimed-btn-label');
  if (cfg.claimMode === 'manual') {
    if (manualBadge) manualBadge.style.display = 'block';
    if (manualBar)   manualBar.style.display   = 'block';
    if (claimedBtnLabel) claimedBtnLabel.textContent = i18n.t('claimed_btn_manual');
  } else {
    if (manualBadge) manualBadge.style.display = 'none';
    if (manualBar)   manualBar.style.display   = 'none';
    if (claimedBtnLabel) claimedBtnLabel.textContent = i18n.t('claimed_btn_auto_fallback');
  }

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
  State.session._lastClaimedRound = -1;
  State.session._lastExpiredRound = -1;

  // Reset claimed button label for the new round
  const claimedBtnLabel = document.getElementById('claimed-btn-label');
  if (claimedBtnLabel) {
    const isManual = State.config.claimMode === 'manual';
    claimedBtnLabel.textContent = i18n.t(isManual ? 'claimed_btn_manual' : 'claimed_btn_auto_fallback');
  }
  // In manual mode keep bar visible; in auto mode hide until first poll
  const manualBar = document.getElementById('manual-claim-bar');
  if (manualBar && State.config.claimMode !== 'manual') {
    manualBar.style.display = 'none';
  }

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
    addLogEntry(round, 'pending', null, '—');
    startCountdown();
    startPolling(linkData.id, round);
    toast(i18n.t('toast_qr_ready', { n: round }), 'info');
  } catch (err) {
    const firstLine = err.message.split('\n')[0];
    toast(`❌ ${firstLine}`, 'error', 8000);
    $('qr-status-text').textContent = `Error — ${firstLine}`;
    setStatusDot('done');
    showQrState('loading');
    const loadingText = $('qr-loading-text');
    loadingText.style.whiteSpace = 'pre-wrap';
    loadingText.style.textAlign  = 'left';
    loadingText.style.fontSize   = '0.75rem';
    loadingText.style.color      = 'var(--error, #ff6b6b)';
    loadingText.textContent      = err.message;
  }
}

// ─── LNbits API ───────────────────────────────────────────────────────────────
const WITHDRAW_BASES = (url) => [
  `${url}/withdraw/api/v1`,
  `${url}/lnurlw/api/v1`,
  `${url}/api/v1/extensions/withdraw/api/v1`,
  `${url}/api/v1/extensions/lnurlw/api/v1`,
];

const WITHDRAW_PAYLOADS = (sats, title) => {
  const msats = sats * 1000;
  return [
    { title, min_withdrawable: sats, max_withdrawable: sats, uses: 1, wait_time: 1, is_unique: true },
    { title, min_withdrawable: sats, max_withdrawable: sats, uses: 1, wait_time: 1 },
    { title, min_withdrawable: sats, max_withdrawable: sats, uses: 1, wait_time: 1, is_unique: true, use_once: true },
    { title, min_withdrawable: msats, max_withdrawable: msats, uses: 1, wait_time: 1, is_unique: true },
    { title, min_withdrawable: msats, max_withdrawable: msats, uses: 1, wait_time: 1 },
  ];
};

async function createLnurlWithdraw(round) {
  const { lnbitsUrl, apiKey, satsAmount, sessionName } = State.config;
  const title    = `${sessionName} — Round ${round}`;
  const bases    = WITHDRAW_BASES(lnbitsUrl);
  const payloads = WITHDRAW_PAYLOADS(satsAmount, title);

  const attempts = [];

  for (const base of bases) {
    const endpoint = `${base}/links`;

    let baseReachable = false;
    try {
      const probe = await fetch(endpoint, { headers: { 'X-Api-Key': apiKey } });
      console.log(`[LNbits] GET ${endpoint} → ${probe.status}`);
      if (probe.status === 404) {
        attempts.push(`GET ${endpoint} → 404 (skipping)`);
        continue;
      }
      if (probe.status === 401 || probe.status === 403) {
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
          if (res.status === 422) continue;
          break;
        }

        let data;
        try { data = JSON.parse(raw); }
        catch (_) { attempts.push(`POST → non-JSON response`); continue; }

        console.log('[LNbits] ✅ Created link, fields:', Object.keys(data));

        let rawLnurl = data.lnurl || data.lnurl_full || data.lnurl_encoded
                    || data.lnurl_url || data.LNURL || null;

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

        State.session.withdrawApiBase = base;
        console.log('[LNbits] ✅ LNURL ready:', finalLnurl.slice(0, 50) + '...');
        return { id: data.id, lnurl: finalLnurl };

      } catch (networkErr) {
        attempts.push(`POST ${endpoint} → network: ${networkErr.message}`);
        console.warn('[LNbits] POST network error:', networkErr);
      }
    }
  }

  const summary = attempts.slice(-8).join('\n');
  console.error('[LNbits] All attempts failed:\n' + summary);

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

function getWithdrawApiBase() {
  return State.session.withdrawApiBase || WITHDRAW_BASES(State.config.lnbitsUrl)[0];
}

async function checkLnurlStatus(linkId) {
  const { apiKey } = State.config;
  const base = getWithdrawApiBase();
  const res = await fetch(`${base}/links/${linkId}`, {
    headers: { 'X-Api-Key': apiKey },
  });

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
  return typeof data.balance === 'number' ? data.balance : null;
}

// ─── Polling ──────────────────────────────────────────────────────────────────
// Behaviour differs by mode:
//   auto   — detected claim → immediately calls onClaimed() → auto-advances round
//   manual — detected claim → updates stats + shows claimed button, but waits
//            for operator to press it before advancing the round
function startPolling(linkId, round) {
  clearInterval(State.pollInterval);

  let claimFired = false;   // prevents duplicate fire
  let claimDetected = false; // manual mode: claim seen but not yet advanced
  let pollCount  = 0;
  const manualBar = document.getElementById('manual-claim-bar');
  const pollDebug = document.getElementById('poll-debug');
  const expectedDrop = State.config.satsAmount * 1000; // msats
  const isManual = State.config.claimMode === 'manual';

  // In manual mode the claim bar is always visible once polling starts
  if (isManual && manualBar) manualBar.style.display = 'block';

  const pollMs = Math.max(1000, (State.config.pollIntervalSec || 3) * 1000);
  console.log('[Poll] interval set to', State.config.pollIntervalSec, 'sec /', pollMs, 'ms');

  State.pollInterval = setInterval(async () => {
    if (!State.session.active || claimFired) {
      clearInterval(State.pollInterval);
      return;
    }
    pollCount++;

    try {
      const currentBalance = await fetchWalletBalance();
      const startBalance   = State.session.balanceAtRoundStart;
      const drop           = (startBalance !== null && currentBalance !== null)
                             ? startBalance - currentBalance : 0;
      const claimedByBalance = drop >= expectedDrop && drop <= expectedDrop * 1.1;

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
        `  mode=${isManual ? 'manual' : 'auto'}  → claimed=${isClaimed}`;

      console.log('[Poll]', debugLine);
      if (pollDebug) pollDebug.textContent = debugLine;

      if (isClaimed && !claimDetected) {
        claimDetected = true;
        claimFired = true;
        clearInterval(State.pollInterval);
        clearInterval(State.countdownInterval);

        if (isManual) {
          // ── MANUAL MODE ────────────────────────────────────────────────────
          // Update stats + log NOW, independently of the button press.
          // Button press only triggers nextRound().
          recordClaimManual(round);
        } else {
          // ── AUTO MODE ──────────────────────────────────────────────────────
          if (manualBar) manualBar.style.display = 'none';
          onClaimed(round);
        }
      }

      // In auto mode show the fallback bar after first poll
      if (!isManual && manualBar) manualBar.style.display = 'block';

    } catch (err) {
      console.warn('[Poll] error:', err.message);
      if (pollDebug) pollDebug.textContent =
        `[${new Date().toLocaleTimeString()}] poll #${pollCount} ERROR: ${err.message}`;
      if (manualBar) manualBar.style.display = 'block';
    }
  }, pollMs);
}

/**
 * Manual mode: claim detected by polling.
 * Immediately updates all stats/log/UI.
 * Does NOT advance the round — that only happens when the button is pressed.
 */
function recordClaimManual(round) {
  // Guard: only fire once per round
  if (State.session._lastClaimedRound === round) return;
  State.session._lastClaimedRound = round;

  // Generate recipient ID and store it so the button press uses the same one
  const recipientId = generateRecipientId(round);
  State.session._pendingRecipientId = recipientId;

  // ── Update stats immediately ───────────────────────────────────────────────
  State.session.claimedCount++;
  updateStats();

  // ── Update recipient log immediately ──────────────────────────────────────
  updateLogEntry(round, 'withdrawn', new Date().toLocaleString(), recipientId);

  // ── Update blocked list immediately ───────────────────────────────────────
  State.blockedFingerprints.add(recipientId);
  updateBlockedList();

  // ── Save to DB (fire and forget) ──────────────────────────────────────────
  fetch('tables/scan_recipients', {
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
  }).catch(() => {});

  // ── Update UI ─────────────────────────────────────────────────────────────
  setStatusDot('done');
  $('qr-status-text').textContent = '✅ Claimed! Press button for next QR';
  const claimedBtnLabel = document.getElementById('claimed-btn-label');
  if (claimedBtnLabel) claimedBtnLabel.textContent = i18n.t('claimed_btn_manual');

  toast(`🎉 Round ${round} claimed! ${State.config.satsAmount} sats sent. Press the button for next QR.`, 'success', 10000);
}

// ─── Manual claim button ──────────────────────────────────────────────────────
function manualMarkClaimed() {
  if (!State.session.active) return;
  const round = State.session.currentRound;

  // Stop polling + countdown in case they are still running (e.g. claim not yet
  // auto-detected — operator pressed early as a manual override)
  clearInterval(State.pollInterval);
  clearInterval(State.countdownInterval);

  const manualBar = document.getElementById('manual-claim-bar');
  if (manualBar) manualBar.style.display = 'none';

  if (State.config.claimMode === 'manual') {
    if (State.session._lastClaimedRound !== round) {
      // Claim was not auto-detected yet — record it now before advancing
      recordClaimManual(round);
    }
    // Advance to next QR
    if (State.session.currentRound >= State.config.totalRounds) {
      finishSession();
    } else {
      nextRound();
    }
  } else {
    // Auto mode fallback — full onClaimed flow
    onClaimed(round);
  }
}

// ─── On claimed (AUTO mode only) ─────────────────────────────────────────────
async function onClaimed(round) {
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
  // Find the most recent entry for this round regardless of current status
  const entry = State.log.slice().reverse().find(e => e.round === round);
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


/* ═══════════════════════════════════════════════════════════════════════════
   PART 3 — Boot wiring
   Script is at end of <body> — DOM is fully parsed, no DOMContentLoaded needed.
   All functions above are already defined — no ordering issues.
═══════════════════════════════════════════════════════════════════════════ */

// ── App init ─────────────────────────────────────────────────────────────────
loadSavedConfig();
bindSetupListeners();
updateTotalCost();

// ── Language init ─────────────────────────────────────────────────────────────
(function () {
  var lang = localStorage.getItem('lnqr_lang') || 'en';
  var enBtn = document.getElementById('lang-en-btn');
  var jaBtn = document.getElementById('lang-ja-btn');
  if (enBtn) enBtn.classList.toggle('active', lang === 'en');
  if (jaBtn) jaBtn.classList.toggle('active', lang === 'ja');
  i18n.init();
})();

// ── Button wiring ─────────────────────────────────────────────────────────────
(function () {
  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', fn);
    } else {
      console.warn('[boot] element not found: #' + id);
    }
  }

  on('lang-en-btn',         function () { setLang('en'); });
  on('lang-ja-btn',         function () { setLang('ja'); });
  on('toggle-api-key',      function () { toggleReveal('api-key'); });
  on('test-connection-btn', function () { testConnection(); });
  on('test-withdraw-btn',   function () { testWithdrawExtension(); });
  on('launch-btn',          function () { handleLaunch(); });
  on('end-session-btn',     function () { endSession(); });
  on('copy-lnurl-btn',      function () { copyLnurl(); });
  on('new-session-btn',     function () { startNewSession(); });
  on('mark-claimed-btn',    function () { manualMarkClaimed(); });
  on('mode-auto-btn',       function () { setClaimMode('auto'); });
  on('mode-manual-btn',     function () { setClaimMode('manual'); });

  // ── Boot diagnostics ───────────────────────────────────────────────────────
  // Logs every button registration result so we can see what the published
  // environment actually found at wire-up time.
  var ids = [
    'lang-en-btn','lang-ja-btn','toggle-api-key','test-connection-btn',
    'test-withdraw-btn','launch-btn','end-session-btn','copy-lnurl-btn',
    'new-session-btn','mark-claimed-btn','mode-auto-btn','mode-manual-btn'
  ];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    console.log('[boot-diag] #' + id + ' → ' + (el ? 'FOUND' : 'MISSING'));
  });
})();
