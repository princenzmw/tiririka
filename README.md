# Tiririka (Swahili: *to flow, to trickle*)

Pay-per-litre water kiosk protocol on Solana payment channels, built for the MLH Solana Hackathon (November 6 to 8, 2026).

- **Live App:** [https://tiririka.vercel.app](https://tiririka.vercel.app)
- **Video Walkthrough (2:02):** [https://youtu.be/ncVHReBpwXA](https://youtu.be/ncVHReBpwXA)
- **Verified Devnet Operator:** [`2wYHsuCApQqVwxKv6Hi8YcueqF8pMVTRrweSAAQ3FVy2`](https://explorer.solana.com/address/2wYHsuCApQqVwxKv6Hi8YcueqF8pMVTRrweSAAQ3FVy2?cluster=devnet)

---

## 1. Problem

In Nairobi's informal settlements (Mathare, Kibera, Mukuru), clean water is sold primarily through community kiosks and water ATMs (such as Grundfos AQtap and M-Pesa automated vendors).

- A standard 20-litre jerrycan costs KES 3.00 (~$0.023 USD), or KES 0.15 (~$0.00115 USD) per litre.
- A Solana base transaction fee (~0.000005 SOL, ~$0.0013 USD) costs as much as or more than a single litre of water, making per-litre on-chain payments unworkable.
- Cellular connectivity drops frequently in informal settlements, and existing custodial prepaid cards lock customer balances in vendor servers when networks fail.

---

## 2. Solution: Solana Payment Channels

Tiririka implements non-custodial streaming micropayments for physical water kiosks using Solana payment channels:

```
[ Customer Phone ]                   [ Mathare Kiosk #107 ]                    [ Solana Devnet ]
        │                                      │                                       │
        │ 1. Open Channel (Deposit 0.01 SOL)   │                                       │
        ├─────────────────────────────────────────────────────────────────────────────►│ (On-Chain Tx #1)
        │                                      │                                       │
        │ 2. Tap Open: Dispense 0.1L ticks     │                                       │
        │    Signed Voucher #1 (0.1L, 642 lam) │                                       │
        ├─────────────────────────────────────►│ Local Ed25519 Check (0 network latency)
        │    Signed Voucher #2 (0.2L, 1284 lam)│                                       │
        ├─────────────────────────────────────►│ Local Ed25519 Check (Internet CUT: OK) │
        │    ... [Hundreds of Vouchers] ...    │                                       │
        │    Signed Voucher #137 (13.7L, 87954)│                                       │
        ├─────────────────────────────────────►│ Local Ed25519 Check                   │
        │                                      │                                       │
        │ 3. Tap Closed: Broadcast Settlement  │                                       │
        │                                      │ 4. Settle Highest Voucher             │
        │                                      ├──────────────────────────────────────►│ (On-Chain Tx #2)
        │                                      │    - Payout 87,954 lamports -> Kiosk  │
        │                                      │    - Refund 9,912,046 lam -> Customer │
```

1. **One on-chain deposit:** The customer deposits a small spending cap (e.g., 0.01 SOL, roughly 1,557 litres) into an escrow PDA on Solana Devnet.
2. **Off-chain micropayments:** Every 0.1L drawn, the customer's phone signs a cumulative Ed25519 voucher off-chain.
3. **Offline verification:** The kiosk checks signatures and balance constraints locally in memory, so water keeps flowing even if cellular data drops.
4. **One on-chain settlement:** When the tap closes, the kiosk submits the highest signed voucher on-chain. The operator receives payment for the litres drawn and the unspent deposit returns to the customer.

---

## 3. Video Walkthrough

[![Watch Tiririka Video Demo](https://img.youtube.com/vi/ncVHReBpwXA/hqdefault.jpg)](https://youtu.be/ncVHReBpwXA)

[Watch the walkthrough on YouTube (2:02)](https://youtu.be/ncVHReBpwXA): covers on-chain escrow funding, off-chain Ed25519 voucher streaming, cellular blackout cutover, local threat checks, and single-transaction settlement on Solana Devnet.

---

## 4. Protocol Lifecycle

1. **Escrow initialization (On-Chain Tx #1):** The customer opens a payment channel by locking a spending cap deposit (e.g., 0.01 SOL) into an isolated PDA escrow vault on Solana Devnet.
2. **Off-chain voucher streaming:** As water dispenses in 0.1L ticks, the client signs cumulative Ed25519 vouchers with strictly increasing nonces and lamport totals at zero gas cost.
3. **Offline cutover:** If cellular connectivity drops, the kiosk terminal falls back to local in-memory verification (< 1ms) so dispensing continues across sessions.
4. **In-memory threat guard:** The terminal checks every incoming voucher for stale nonce replays, escrow solvency breaches, and payload signature tampering, halting the valve immediately if any check fails.
5. **On-chain settlement and refund (On-Chain Tx #2):** When the tap closes, the kiosk broadcasts the highest signed voucher to Solana Devnet. The operator receives the exact payout and unspent lamports return to the customer.
6. **Unilateral timelock exit:** If kiosk hardware loses power or connectivity for more than 24 hours, an on-chain timelock lets the customer reclaim 100% of remaining escrow collateral without operator sign-off.

---

## 5. Cryptographic Security Rules

- **Canonical message:** `TIRIRIKA_V1:<channelId>:<nonce>:<cumulativeLitres>:<cumulativeLamports>`
- **Replay protection:** Nonce must strictly increase (`nonce > lastVerifiedNonce`).
- **Cumulative monotonicity:** Lamports owed must not decrease (`lamports >= lastVerifiedLamports`).
- **Solvency guard:** Any voucher exceeding `channel.depositLamports` is rejected immediately.
- **Verification speed:** In-memory Ed25519 signature checks run in under 1ms per voucher with no network round trip.
- **Timelock exit:** 24-hour on-chain timeout allows unilateral refund if the kiosk goes offline permanently.

---

## 6. Anchor Smart Contract Specification

The Solana Anchor v0.30 smart contract blueprint lives in `/contracts/tiririka`:

- `initialize_channel`: Creates the `PaymentChannel` PDA and locks deposit lamports in an isolated escrow vault PDA.
- `settle_channel`: Introspects Solana's native Ed25519 precompile instruction to verify customer signatures, pays earned lamports to the operator, and refunds the remainder.
- `dispute_timeout_refund`: Lets the customer reclaim unspent deposit after the 24-hour timelock elapses.

See [contracts/tiririka/src/lib.rs](contracts/tiririka/src/lib.rs) and [contracts/tiririka/idl.json](contracts/tiririka/idl.json) for full source and IDL.

---

## 7. Running Locally

Prerequisites: Node.js v20+ (or v26+) and npm or pnpm.

```bash
git clone https://github.com/princenzmw/tiririka.git
cd tiririka
npm install --ignore-scripts
npm test
npm run dev
```

`npm test` runs the 7 cryptographic verification tests. `npm run dev` serves the app at `http://localhost:3300`.

---

## 8. Hackathon Disclosures

- **Event:** MLH Solana Hackathon (November 6 to 8, 2026).
- **Builder:** Prince Nzamuwe ([@princenzmw](https://github.com/princenzmw)), 3rd-year BSc Data Science student and Mastercard Foundation Scholar at USIU-Africa, Nairobi, Kenya.
- **AI tool disclosure:** Per MLH competition rules, Cursor and Gemini coding assistants (Antigravity) were used for scaffolding, TypeScript types, and unit test generation. System design, cryptographic verification flows, and domain research are the author's own work.

## License

MIT License.
