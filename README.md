# ⚡ Lightning QR Drop

A static web app that generates **one-time LNURL-withdraw QR codes** allowing random recipients to claim a fixed amount of satoshis from your Lightning Network wallet. After each successful claim, a new QR auto-regenerates for the next recipient. You control how many recipients receive sats.

---

## ✅ Completed Features

- **Setup Panel**: Configure LNbits URL, API key, sats amount, number of recipients, and QR expiry time
- **LNbits Connection Test**: Verify your wallet connection and see balance before launching
- **One-Time QR Codes**: Each QR is a unique LNURL-withdraw link with `uses=1` — claimed only once
- **Auto-Regeneration**: After each successful claim (or expiry), a new QR is automatically generated
- **Round Counter**: Specify exactly how many recipients (QR regenerations) you want
- **Countdown Timer**: Each QR expires after a configurable time; visual countdown with urgent color change
- **Recipient Log**: Full table showing each round's status (claimed / expired / pending), timestamp, and pseudonymous recipient ID
- **Blocked Fingerprints**: Ephemeral recipient IDs are logged to prevent re-scanning
- **Session Persistence**: Sessions and scan logs are saved to the table database
- **Complete Panel**: End-of-session summary with total sats sent, recipients, and full log
- **Config Persistence**: LNbits settings saved to `localStorage` for convenience
- **Copy LNURL**: Fallback copy button for the raw LNURL string

---

## 🔧 How It Works

### Technology Stack
| Layer | Tech |
|---|---|
| Lightning Integration | [LNbits](https://lnbits.com) LNURL-withdraw extension REST API |
| QR Rendering | [QRCode.js](https://github.com/davidshimjs/qrcodejs) via jsDelivr CDN |
| Data Persistence | Genspark Table API (session + recipient logs) |
| Styling | Custom CSS with CSS variables, Inter + JetBrains Mono fonts |

### Flow
```
User configures settings
      ↓
POST /withdraw/api/v1/links → creates LNURL-withdraw (1 use, fixed amount)
      ↓
QR Code displayed on screen
      ↓
Recipient scans with Lightning wallet → claims sats
      ↓
Poll GET /withdraw/api/v1/links/{id} every 3s until used=true
      ↓
Log recipient ID → auto-generate next QR
      ↓
Repeat until all rounds complete
```

---

## 🚀 Entry Points

| Path | Description |
|---|---|
| `/index.html` | Main app — setup, active drop, complete screen |
| `/how-it-works.html` | Interactive payment flow illustration — architecture, animated step flow, anti-double-dip deep dive, LNURL anatomy, sequence diagram, API reference |

---

## ⚙️ Setup Requirements

### You Need
1. A **LNbits wallet** — self-hosted or on `legend.lnbits.com`
2. The **LNURL-withdraw extension** enabled in your LNbits wallet
3. Your **LNbits Admin API key** (not Invoice key — Admin key needed to create withdraw links)
4. Enough sats in your wallet to cover: `amount × number_of_recipients`

### Steps
1. Open LNbits → your wallet → Extensions → Enable **LNURL-withdraw**
2. Go to API Info → copy your **Admin key**
3. Paste URL + Admin key into the setup panel
4. Click "Test Connection" to verify
5. Set your sats amount + number of recipients
6. Click **Launch QR Drop Session**

---

## 📦 Data Models

### `withdraw_sessions` table
| Field | Type | Description |
|---|---|---|
| id | text | UUID session identifier |
| sats_amount | number | Sats per withdrawal |
| total_rounds | number | Number of QR regenerations |
| current_round | number | Current progress |
| status | text | active / completed / paused |
| lnbits_url | text | LNbits instance URL |
| created_at_human | text | Human-readable creation time |

### `scan_recipients` table
| Field | Type | Description |
|---|---|---|
| id | text | UUID record ID |
| session_id | text | Parent session reference |
| round_number | number | Which round this was |
| fingerprint_hash | text | Pseudonymous recipient identifier |
| lnurl_withdraw_id | text | LNbits link ID |
| status | text | pending / withdrawn / expired |
| scanned_at | text | ISO timestamp |
| withdrawn_at | text | ISO timestamp |

---

## ⚠️ Known Limitations

- **CORS**: LNbits must have CORS enabled (all public LNbits instances do; self-hosted may need `--allowed-hosts`)
- **Recipient Deduplication**: The current fingerprinting is ephemeral (time-based ID per round). It logs *who claimed each round* but cannot prevent someone with multiple wallets from scanning different rounds. For stronger deduplication, a backend would be needed to hash scanner IPs.
- **Polling**: The app polls the LNbits API every 3 seconds. Webhooks would be more efficient but require a server endpoint.
- **No multi-device sync**: The active QR session only lives in the browser that launched it.

---

## 🔜 Recommended Next Steps

1. **Webhook support**: Add a server-side webhook receiver to get instant payment notifications
2. **IP-based blocking**: Use a proxy/backend to hash scanner IPs for stronger deduplication
3. **Multiple active QRs**: Display N QRs simultaneously, each for a different recipient
4. **Sound effects**: Play a chime when a claim is confirmed
5. **Export log**: CSV download of the full session log
6. **QR Branding**: Overlay a custom logo on the QR code center
