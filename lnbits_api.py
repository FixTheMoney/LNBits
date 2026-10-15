#!/usr/bin/env python3
"""
lnbits_api.py
=============
Standalone script for common LNbits API operations.

Usage:
    python lnbits_api.py

Edit the CONFIG section at the top before running.

Requirements:
    pip install requests
"""

import requests
import json
import sys

# ══════════════════════════════════════════════════════════════
#  CONFIG — edit these before running
# ══════════════════════════════════════════════════════════════

LNBITS_URL = "https://legend.lnbits.com"   # your LNbits instance (no trailing slash)
ADMIN_KEY   = "your_admin_key_here"         # LNbits → Wallet → API Info → Admin key

# ══════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════

def headers():
    return {
        "X-Api-Key": ADMIN_KEY,
        "Content-Type": "application/json",
    }


def print_section(title):
    print()
    print("═" * 60)
    print(f"  {title}")
    print("═" * 60)


def print_response(res):
    print(f"  HTTP {res.status_code}")
    try:
        data = res.json()
        print(json.dumps(data, indent=2))
    except Exception:
        print(res.text[:500])


# ══════════════════════════════════════════════════════════════
#  1. TEST CONNECTION  —  GET /api/v1/wallet
# ══════════════════════════════════════════════════════════════

def test_connection():
    """
    Verifies the API key and URL are correct.
    Returns wallet name, ID, and balance.
    """
    print_section("1. Test Connection  —  GET /api/v1/wallet")
    url = f"{LNBITS_URL}/api/v1/wallet"
    print(f"  → {url}")
    try:
        res = requests.get(url, headers=headers(), timeout=10)
        print_response(res)
        if res.ok:
            data = res.json()
            sats = data.get("balance", 0) // 1000
            print(f"\n  ✅ Connected!  Wallet: {data.get('name')}  |  Balance: {sats:,} sats")
            return True
        else:
            print("\n  ❌ Connection failed.")
            return False
    except requests.exceptions.ConnectionError as e:
        print(f"  ❌ Network error: {e}")
        return False


# ══════════════════════════════════════════════════════════════
#  2. CHECK BALANCE  —  GET /api/v1/wallet
# ══════════════════════════════════════════════════════════════

def check_balance():
    """
    Fetches the current wallet balance in sats.
    (Same endpoint as test_connection, shown separately for clarity.)
    """
    print_section("2. Check Balance  —  GET /api/v1/wallet")
    url = f"{LNBITS_URL}/api/v1/wallet"
    print(f"  → {url}")
    res = requests.get(url, headers=headers(), timeout=10)
    print_response(res)
    if res.ok:
        msats = res.json().get("balance", 0)
        sats  = msats // 1000
        print(f"\n  ✅ Balance: {msats:,} msats  =  {sats:,} sats")
        return sats
    return None


# ══════════════════════════════════════════════════════════════
#  3. DISCOVER WITHDRAW EXTENSION BASE PATH
# ══════════════════════════════════════════════════════════════

# LNbits has moved the withdraw extension path across versions.
# This list covers all known locations.
WITHDRAW_BASES = [
    "{url}/withdraw/api/v1",
    "{url}/lnurlw/api/v1",
    "{url}/api/v1/extensions/withdraw/api/v1",
    "{url}/api/v1/extensions/lnurlw/api/v1",
]


def discover_withdraw_base():
    """
    Probes all known withdraw extension paths and returns the first
    one that responds with HTTP 200.  Raises RuntimeError if none found.
    """
    print_section("3. Discover Withdraw Extension Base Path")
    for template in WITHDRAW_BASES:
        base = template.format(url=LNBITS_URL)
        endpoint = f"{base}/links"
        print(f"  Trying: GET {endpoint}")
        try:
            res = requests.get(endpoint, headers=headers(), timeout=8)
            print(f"          HTTP {res.status_code}")
            if res.status_code == 200:
                print(f"\n  ✅ Found at: {base}")
                return base
            if res.status_code in (401, 403):
                print("  ❌ Auth error — use Admin key, not Invoice key.")
                raise RuntimeError("Auth error")
        except requests.exceptions.ConnectionError:
            print("          (connection error — skipping)")
    raise RuntimeError(
        "Withdraw extension not found at any path.\n"
        "→ In LNbits go to Extensions and enable 'Withdraw' (or 'LNURLw')."
    )


# ══════════════════════════════════════════════════════════════
#  4. CREATE LNURL-WITHDRAW LINK
#     POST /withdraw/api/v1/links
# ══════════════════════════════════════════════════════════════

def create_withdraw_link(
    base,
    sats,
    title="Python API Test",
    uses=1,
    no_expiry=True,
):
    """
    Creates a single LNURL-withdraw link.

    Parameters
    ----------
    base      : str   — withdraw API base path (from discover_withdraw_base)
    sats      : int   — amount in satoshis
    title     : str   — label shown in LNbits
    uses      : int   — number of times the link can be claimed (default 1)
    no_expiry : bool  — links have no expiry by default in LNbits;
                        this parameter is here for documentation clarity only

    Notes
    -----
    LNbits does NOT have an expires_at field for withdraw links.
    "No expiry" is the default and only option at the protocol level.
    To invalidate a link manually, call delete_withdraw_link().

    The script tries both sats and msats variants of the payload
    because different LNbits versions expect different units.
    """
    print_section(f"4. Create LNURL-Withdraw Link  —  POST {base}/links")

    endpoint = f"{base}/links"
    msats    = sats * 1000

    # Try sats first, then msats — LNbits version determines which is correct
    payloads = [
        {
            "title":            title,
            "min_withdrawable": sats,
            "max_withdrawable": sats,
            "uses":             uses,
            "wait_time":        1,
            "is_unique":        True,
        },
        {
            "title":            title,
            "min_withdrawable": sats,
            "max_withdrawable": sats,
            "uses":             uses,
            "wait_time":        1,
        },
        {
            "title":            title,
            "min_withdrawable": msats,
            "max_withdrawable": msats,
            "uses":             uses,
            "wait_time":        1,
            "is_unique":        True,
        },
        {
            "title":            title,
            "min_withdrawable": msats,
            "max_withdrawable": msats,
            "uses":             uses,
            "wait_time":        1,
        },
    ]

    for i, payload in enumerate(payloads, 1):
        print(f"  Attempt {i} → POST {endpoint}")
        print(f"  Body: {json.dumps(payload)}")
        res = requests.post(endpoint, headers=headers(), json=payload, timeout=10)
        print(f"  HTTP {res.status_code}")

        if res.ok:
            data = res.json()
            link_id = data.get("id")
            lnurl   = (
                data.get("lnurl")
                or data.get("lnurl_full")
                or data.get("lnurl_encoded")
                or data.get("LNURL")
                or "(not in response — call get_withdraw_link to retrieve)"
            )
            print(f"\n  ✅ Link created!")
            print(f"     ID    : {link_id}")
            print(f"     LNURL : {lnurl}")
            print(f"     Sats  : {sats:,}")
            print(f"     Uses  : {uses}")
            print(f"     Expiry: none (permanent until voided)")
            return data

        body_preview = res.text[:200]
        print(f"  Response: {body_preview}")

    print("\n  ❌ All payload variants failed.")
    return None


# ══════════════════════════════════════════════════════════════
#  5. LIST ALL WITHDRAW LINKS
#     GET /withdraw/api/v1/links
# ══════════════════════════════════════════════════════════════

def list_withdraw_links(base):
    """
    Fetches all LNURL-withdraw links on the wallet.
    Prints a summary table of id, title, amount, and used status.
    """
    print_section(f"5. List All Withdraw Links  —  GET {base}/links")
    endpoint = f"{base}/links"
    print(f"  → {endpoint}")
    res = requests.get(endpoint, headers=headers(), timeout=10)
    print(f"  HTTP {res.status_code}")

    if not res.ok:
        print(f"  ❌ {res.text[:200]}")
        return []

    links = res.json()
    print(f"\n  Found {len(links)} link(s):\n")
    print(f"  {'#':<4} {'ID':<26} {'Title':<30} {'Sats':>8}  {'Used'}")
    print(f"  {'-'*4} {'-'*26} {'-'*30} {'-'*8}  {'-'*6}")

    for i, link in enumerate(links, 1):
        is_used = bool(link.get("used") or (link.get("times_used", 0) >= 1))
        raw_amt = link.get("max_withdrawable") or link.get("min_withdrawable") or 0
        # LNbits returns msats in some versions, sats in others
        # If the number is suspiciously large, treat as msats
        sats    = raw_amt // 1000 if raw_amt > 100_000 else raw_amt
        print(
            f"  {i:<4} {str(link.get('id','')):<26} "
            f"{str(link.get('title',''))[:30]:<30} {sats:>8,}  "
            f"{'✅ yes' if is_used else '— no'}"
        )

    return links


# ══════════════════════════════════════════════════════════════
#  6. GET A SINGLE WITHDRAW LINK  (check status)
#     GET /withdraw/api/v1/links/{id}
# ══════════════════════════════════════════════════════════════

def get_withdraw_link(base, link_id):
    """
    Fetches a single withdraw link by ID.
    Shows whether it has been claimed (used) or is still available.
    """
    print_section(f"6. Get Withdraw Link  —  GET {base}/links/{link_id}")
    endpoint = f"{base}/links/{link_id}"
    print(f"  → {endpoint}")
    res = requests.get(endpoint, headers=headers(), timeout=10)
    print_response(res)

    if res.ok:
        data    = res.json()
        is_used = bool(data.get("used") or (data.get("times_used", 0) >= 1))
        lnurl   = (
            data.get("lnurl")
            or data.get("lnurl_full")
            or data.get("lnurl_encoded")
            or data.get("LNURL")
            or "(not available)"
        )
        print(f"\n  ID    : {data.get('id')}")
        print(f"  Title : {data.get('title')}")
        print(f"  LNURL : {lnurl}")
        print(f"  Status: {'⚡ CLAIMED (exhausted)' if is_used else '✓ UNUSED (still active)'}")
        return data

    return None


# ══════════════════════════════════════════════════════════════
#  7. DELETE / VOID A WITHDRAW LINK
#     DELETE /withdraw/api/v1/links/{id}
# ══════════════════════════════════════════════════════════════

def delete_withdraw_link(base, link_id):
    """
    Permanently deletes a withdraw link from LNbits.

    Effect:
      - Any QR code pointing to this link will return an error when scanned.
      - The sats are NOT sent — they stay in your wallet.
      - This is the only way to 'expire' a non-expiring link.
      - Cannot be undone.

    Use this to void unused links you no longer want to distribute.
    """
    print_section(f"7. Delete Withdraw Link  —  DELETE {base}/links/{link_id}")
    endpoint = f"{base}/links/{link_id}"
    print(f"  → {endpoint}")
    res = requests.delete(endpoint, headers=headers(), timeout=10)
    print(f"  HTTP {res.status_code}")

    if res.status_code in (200, 204):
        print(f"\n  ✅ Link {link_id} deleted.")
        print("     Any QR codes pointing to this link are now permanently invalid.")
        print("     Sats have NOT been sent — they remain in your wallet.")
        return True
    elif res.status_code == 404:
        print(f"\n  ⚠️  Link {link_id} not found (already deleted?).")
        return False
    else:
        print(f"\n  ❌ Delete failed: {res.text[:200]}")
        return False


# ══════════════════════════════════════════════════════════════
#  MAIN — runs all functions in sequence as a demo
# ══════════════════════════════════════════════════════════════

def main():
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║          LNbits API Demo — lnbits_api.py                 ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"  URL : {LNBITS_URL}")
    print(f"  Key : {ADMIN_KEY[:8]}…{ADMIN_KEY[-4:] if len(ADMIN_KEY) > 12 else '****'}")

    # ── 1. Test connection ─────────────────────────────────────
    ok = test_connection()
    if not ok:
        print("\n  Cannot continue — fix the URL / API key and retry.")
        sys.exit(1)

    # ── 2. Check balance ───────────────────────────────────────
    check_balance()

    # ── 3. Discover withdraw extension ────────────────────────
    try:
        base = discover_withdraw_base()
    except RuntimeError as e:
        print(f"\n  ❌ {e}")
        print("  Skipping withdraw link tests.")
        sys.exit(1)

    # ── 4. Create a test withdraw link ─────────────────────────
    print()
    print("  (Creating a test link for 100 sats — feel free to change this.)")
    link_data = create_withdraw_link(
        base=base,
        sats=100,
        title="Python API Test Link",
        uses=1,
    )

    if not link_data:
        print("  Could not create link. Stopping here.")
        sys.exit(1)

    link_id = link_data.get("id")

    # ── 5. List all links ──────────────────────────────────────
    list_withdraw_links(base)

    # ── 6. Get the link we just created (check status) ────────
    get_withdraw_link(base, link_id)

    # ── 7. Delete / void the test link ────────────────────────
    print()
    answer = input("  Delete the test link now? (y/N): ").strip().lower()
    if answer == "y":
        delete_withdraw_link(base, link_id)
    else:
        print(f"\n  Skipped delete.  Link ID to delete manually: {link_id}")
        print(f"  Command: python lnbits_api.py  (or call delete_withdraw_link directly)")

    print()
    print("═" * 60)
    print("  Done!")
    print("═" * 60)
    print()
    print("  You can also import and call individual functions:")
    print("    from lnbits_api import check_balance, create_withdraw_link, ...")
    print()


if __name__ == "__main__":
    main()
