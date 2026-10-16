# Lightning Gift

A static web app for issuing LNURL-withdraw links and funded prepaid wallet URLs with LNbits, displaying sequential withdrawal QR codes, and sending payments to Lightning addresses. Issuance and payment recovery are handled on the issuer's side; recipients still use their QR/LNURL or wallet URL as before.

A [Japanese change summary](IMPROVEMENTS-ja.md) is also available.

## Pages

| Path | Purpose |
| --- | --- |
| `/generate-links.html` | Create up to 3,000 LNURL-withdraw links and export a verified batch to CSV |
| `/prepaid-card.html` | Create and fund up to 30,000 prepaid-card wallet URLs and export a verified batch to CSV |
| `/index.html` | Display one-time LNURL withdrawal QR codes in sequence |
| `/bulk-send.html` | Send payments to multiple Lightning addresses |
| `/how-it-works.html` | Original interactive explanation of the payment flow |

Email delivery and writing URLs to physical cards are outside this app's scope.

## Run locally

No Node package installation is required. From the project directory, run:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. This server only serves static files; LNbits must run separately. The original `lnbits_api.py` is an API example that can perform real operations, not the server used to launch this app.

## Connect to LNbits

- Enter your LNbits HTTPS URL and the source wallet's Admin API key. HTTP is permitted only for localhost.
- Enable the Withdraw extension to create withdrawal links.
- Configure LNbits to allow CORS requests from the app's origin.
- Enter the management key each time you open a page. The key is sent directly to the configured LNbits instance.
- Prepaid cards currently create wallets belonging to the same LNbits user. **This repository does not guarantee authorization isolation between cards. Verify that isolation on the actual LNbits deployment before distributing cards in production.**

The public withdrawal page is served by the LNbits Withdraw extension. Its language support is controlled by that deployment, independently of this app's language settings.

## Batch issuance and recovery

The app checks the LNbits instance and source wallet, then stores batch and item IDs in browser IndexedDB before wallet creation, link creation, or payment. Tables display 100 records per page rather than rendering 30,000 rows at once.

The pause control stops after the current item finishes. To resume, reopen the same page URL in the same browser, enter the original connection and management key, select the batch, and use the resume control (`未完了分を再開`). Creating a new batch creates separate records.

After an ambiguous payment response, recovery checks the original payment without resubmitting it. Ambiguous wallet or link creation is not automatically repeated either; reconcile the saved IDs and names with LNbits before proceeding.

Storage failures stop processing. The Web Locks API prevents simultaneous wallet operations across tabs. A browser supporting both Web Locks and IndexedDB is required.

## Bulk payment recovery

Before sending, the app saves the invoice and its payment hash in IndexedDB. It reports success only after LNbits confirms the payment. An ambiguous result stops the remaining payments in the batch.

Reopening the same page URL in the same browser restores unresolved payments. Enter the original server and wallet's Admin key, then click **Send to All** to check them. Unresolved payments are checked using their original hashes; the app does not request replacement invoices or send them again. If another tab's unresolved payment is discovered during submission, that click only reconciles existing payments.

Completed rows are not sent again after another click or **Reset Statuses**. For an intentional new payment, remove a completed row and add the recipient again. Unresolved rows cannot be removed until reconciliation succeeds. If the page closed after saving but before submitting a payment, or LNbits reports failure, the app still does not automatically resubmit; inspect the original payment in LNbits.

Card top-ups, balance checks, and CSV exports reload the latest stored card record before acting. A stale tab cannot overwrite another tab's unresolved top-up or reactivate a card recorded as deactivated.

## CSV exports

The app rechecks every record in the selected batch before exporting. If any record is invalid, the whole export stops instead of silently reducing the row count. CSVs use a UTF-8 BOM and escape quotes, newlines, and values that spreadsheet software could interpret as formulas.

- LNURL: `batch_id, distribution_id, link_id, title, claim_url, lnurl, sats, status`
- Prepaid cards: `batch_id, card_id, name, wallet_id, access_url, amount_sats, status, verified_at`

For LNURL records, `claim_url` is the distribution URL returned by LNbits. Verify its browser behavior and how your email or distribution system handles LNURLs on the actual deployment. For prepaid cards, `access_url` is the corresponding wallet URL.

CSV files do not include Admin or Invoice keys. Prepaid CSV exports require the full intended funded balance to remain. Spent cards can still be managed but cannot be exported again as newly funded cards.

## Browser storage

The source wallet's Admin key stays in memory, and legacy copies in localStorage are removed at startup. Created card wallet IDs, access URLs, per-card keys, and payment reconciliation IDs are stored in IndexedDB for recovery and management. Bulk payment records store invoice and reconciliation data without API keys. This is browser storage, not a server backup.

Storage is separate for `localhost`, `127.0.0.1`, different ports, and different browsers. Recovery after browser-data deletion or device loss is not implemented. Keep exported CSVs separately and treat them as sensitive: possession of an access URL may allow spending funds.

Legacy `prepaid_cards` records are migrated without deleting their original copy and are excluded from CSV exports until reverified.

## Verification

Run the Node.js standard-library tests:

```sh
node --test tests/*.test.cjs
```

The 34 tests use synthetic APIs and no real funds. They cover storage failures, recovery, duplicate-payment prevention, amount checks, malformed shared data, connection and wallet mismatches, CSV validation, and simulated batches of 30,000 cards and 3,000 links. Simulated throughput does not establish real-server performance or authorization isolation.

Chrome checks with mocked APIs and real browser IndexedDB also covered bulk-payment response loss, reload recovery, reconciliation and repeated submission; stale-tab top-up reconciliation and completion feedback; deactivation protection; and cross-tab Web Locks. These checks do not replace real LNbits compatibility tests or comprehensive testing across all pages and browsers.

QR and ZIP libraries are bundled locally; see their [sources, licenses, and SHA-256 hashes](js/vendor/README.md).

Before production use, verify real LNbits compatibility, small-value transactions, card-to-card authorization isolation, server load, and recovery/backup procedures.

## API references

These official sources informed the implementation. Validate differences against the LNbits and Withdraw versions deployed on your server.

- [LNbits payments API](https://github.com/lnbits/lnbits/blob/main/lnbits/core/views/payment_api.py)
- [Withdraw API](https://github.com/lnbits/withdraw/blob/main/views_api.py)
- [Withdraw data models](https://github.com/lnbits/withdraw/blob/main/models.py)
- [BOLT11 invoice encoding](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md)
- [LNURL payRequest specification](https://github.com/lnurl/luds/blob/luds/06.md)
