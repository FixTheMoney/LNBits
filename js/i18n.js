/**
 * ⚡ Lightning QR Drop — i18n Translation Engine
 * Supports: English (en) | Japanese (ja)
 *
 * Usage:
 *   i18n.setLang('ja')          — switch language
 *   i18n.t('key')               — get translated string
 *   i18n.apply()                — apply translations to DOM via data-i18n attributes
 *   i18n.applyPlaceholders()    — apply translations to input placeholders
 */

const i18n = (() => {

  // ─── Current language ─────────────────────────────────────────────────────
  let lang = localStorage.getItem('lnqr_lang') || 'en';

  // ─── Translation dictionary ───────────────────────────────────────────────
  const dict = {

    /* ══════════════════════════════════════════════════
       SHARED — used on both pages
    ══════════════════════════════════════════════════ */
    en: {
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

      // Section 1 — Architecture
      arch_section_title: 'System Architecture',
      arch_section_sub: 'Three actors, one protocol — no intermediaries',
      arch_card1_title: 'You (The Sender)',
      arch_card1_body: 'You configure the drop: amount per recipient, number of rounds, and expiry time. Your LNbits wallet funds every withdrawal. You never share your private keys — only your LNbits Admin API key is used.',
      arch_card2_title: 'LNbits (Your Node)',
      arch_card2_body: 'Your LNbits instance manages the LNURL-withdraw links. It enforces the <code>uses: 1</code> constraint at the protocol level — ensuring each link can only ever be redeemed once, regardless of how many times the QR is scanned.',
      arch_card3_title: 'Recipients',
      arch_card3_body: 'Each recipient scans the QR with any Lightning-compatible wallet (Phoenix, Breez, Wallet of Satoshi, etc.). Their wallet fetches the LNURL callback, constructs a payment invoice, and receives sats automatically.',

      // Section 2 — Flow
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

      // Scene 0
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

      // Scene 1
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

      // Scene 2
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

      // Scene 3
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

      // Scene 4
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

      // Scene 5
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

      // Section 3 — Anti double dip
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

      // Scenario comparison
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

      // Section 4 — LNURL Anatomy
      lnurl_section_title: 'LNURL-Withdraw Anatomy',
      lnurl_section_sub: 'What\'s inside the QR code and how the protocol enforces one-time use',
      lnurl_intro: 'The QR code encodes a <strong>bech32-encoded LNURL</strong> string. When scanned, the recipient\'s wallet decodes it to a URL and makes an HTTP request to your LNbits instance. The response is a JSON object specifying the withdraw parameters:',
      ann_tag_desc: '<strong>Identifies the type</strong> as a "withdrawRequest" — tells the wallet to present a receive UI, not a payment UI.',
      ann_k1_desc: '<strong>Challenge token</strong> — a random value LNbits generates. Must be echoed back in the callback to prove the wallet fetched the correct link.',
      ann_minmax_desc: '<strong>Both set to the same value</strong> (e.g. 1,000,000 msats = 1000 sats) — forces the exact amount. The wallet cannot request more or less.',
      ann_callback_desc: '<strong>The endpoint to POST the invoice to.</strong> This is your LNbits server — it validates the invoice and executes the Lightning payment.',
      ann_uses_desc: '<strong>Stored in LNbits DB</strong> — not in the LNURL itself. LNbits checks this atomically before processing any callback, preventing race-condition exploits.',
      ann_unique_desc: '<strong>Forces a unique hash</strong> per link so that even if two links have the same parameters, their LNURL strings are different and cannot be confused.',

      // Section 5 — Sequence diagram
      seq_section_title: 'Full Sequence Diagram',
      seq_section_sub: 'Message flow between all actors for one complete round',

      // Section 6 — API Reference
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
      // Fire custom event for JS-driven content
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } }));
    },

    t(key, vars) {
      const str = (dict[lang] && dict[lang][key]) || (dict['en'] && dict['en'][key]) || key;
      if (!vars) return str;
      return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
    },

    // Apply data-i18n text content
    apply() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = this.t(key);
      });
    },

    // Apply data-i18n-html (innerHTML with safe HTML like <code>, <strong>, <a>)
    applyHTML() {
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = this.t(key);
      });
    },

    // Apply data-i18n-placeholder
    applyPlaceholders() {
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = this.t(key);
      });
    },

    // Apply page titles
    applyTitles() {
      const titleKey = document.body.getAttribute('data-page-title');
      if (titleKey) document.title = this.t(titleKey);
    },

    // Full init
    init() {
      document.documentElement.lang = lang;
      this.apply();
      this.applyHTML();
      this.applyPlaceholders();
      this.applyTitles();
    }
  };
})();
