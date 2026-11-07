# Tiririka (Swahili: *to flow, to trickle*)

> **Pay-per-litre water kiosk protocol on Solana payment channels.**  
> Built for the **MLH Solana Hackathon (November 6–8, 2026)**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Network: Solana Devnet](https://img.shields.io/badge/Solana-Devnet-14F195?logo=solana&logoColor=black)](https://explorer.solana.com/?cluster=devnet)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js: 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tests: 100% Pass](https://img.shields.io/badge/Tests-100%25%20Passing-emerald)](https://github.com/princenzmw/tiririka)

---

## 1. The Real-World Problem

In Nairobi's informal settlements (Mathare, Kibera, Mukuru), clean water is distributed primarily through community kiosks and water ATMs (such as Grundfos AQtap and M-Pesa automated vendors).

* **The Reality:** A standard 20-litre jerrycan costs **KES 3.00** (~$0.023 USD). That equals **KES 0.15** (~$0.00115 USD) per single litre of water.
* **The Blockchain Dilemma:** A typical Solana transaction fee is ~0.000005 SOL (~$0.0013 USD). If a customer attempted to pay on-chain for each individual litre drawn from the tap, **the blockchain transaction fee would equal or exceed the cost of the water itself.**
* **The Connectivity Blackout:** Cellular networks in informal settlements frequently drop. Existing custodial prepaid cards lock customer balances in the vendor's proprietary system, leaving households stranded when servers go down.

---

## 2. The Solution: Solana Payment Channels

**Tiririka** introduces non-custodial streaming micropayments for physical water kiosks using Solana Payment Channels:

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

1. **One On-Chain Deposit:** Customer deposits a small spending cap (e.g. 0.01 SOL ≈ 1,557 litres) into a secure escrow account on Solana Devnet.
2. **Hundreds of Off-Chain Micropayments:** Every 0.1L drawn, the customer's phone signs a cumulative Ed25519 voucher off-chain.
3. **Offline Verification:** The kiosk validates the digital signature and state constraints locally in memory. **Even if the cellular connection is cut, water continues flowing.**
4. **One On-Chain Settlement:** Upon tap release, the kiosk submits the highest signed voucher on-chain. The operator receives payment for exactly what was drawn, and the unspent deposit is automatically refunded to the customer.

---

## 3. The 2-Minute Demo Flow

1. **The Hook (0:00 - 0:15):** In Nairobi, 20L costs KES 3. Per-litre payments on any blockchain would burn 100% of the cost in transaction fees. Tiririka proves how payment channels solve this for physical infrastructure.
2. **Open Channel (0:15 - 0:35):** Customer connects demo wallet, selects a 0.01 SOL deposit cap, and confirms on Solana Devnet (1 on-chain transaction).
3. **The Fluid Stream (0:35 - 0:55):** Hold the tap button: water flows, jerrycan fills, vouchers stream every 0.1L, on-chain transaction count stays strictly at **1**.
4. **The Internet Cut (0:55 - 1:15):** Toggle the kiosk offline. Amber badge activates: water keeps flowing! The kiosk verifies Ed25519 signatures locally without an RPC connection.
5. **Anti-Cheat Defense (1:15 - 1:35):** Click "Test Operator Over-Claim Attack". The operator attempts to settle the full 0.01 SOL deposit without customer vouchers. The smart logic rejects the attempt immediately.
6. **Stop & Settle (1:35 - 2:00):** Settle at 13.7L. One final on-chain transaction distributes 87,954 lamports (KES 2.06) to the kiosk operator and refunds 9,912,046 lamports back to the customer. Confetti burst and live Solana Explorer verification link.

---

## 4. Cryptographic Security Architecture

* **Voucher Canonical Message:**  
  `TIRIRIKA_V1:<channelId>:<nonce>:<cumulativeLitres>:<cumulativeLamports>`
* **Replay Protection:** Nonce must be strictly incrementing (`nonce > lastVerifiedNonce`).
* **Cumulative Monotonicity:** Lamports owed must increase monotonically (`lamports >= lastVerifiedLamports`).
* **Solvency Guard:** Vouchers exceeding `channel.depositLamports` are rejected immediately.
* **Local Speed:** In-memory Ed25519 signature checks execute in **under 1ms per voucher** with zero network overhead.

---

## 5. Quickstart & Local Development

### Prerequisites
* Node.js v20+ or v26+
* npm or pnpm

### Installation
```bash
# Clone the repository
git clone https://github.com/princenzmw/tiririka.git
cd tiririka

# Install dependencies
npm install --ignore-scripts

# Run the automated cryptographic test suite
npm test
```

### Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3300](http://localhost:3300) in your browser.

---

## 6. Hackathon Transparency & Disclosures

* **Event:** MLH Solana Hackathon (November 6–8, 2026).
* **Builder:** Prince NZAMUWE ([@princenzmw](https://github.com/princenzmw)) — 3rd-year BSc Data Science student, Mastercard Foundation Scholar at USIU-Africa, Nairobi, Kenya.
* **AI Tool Disclosure:** In accordance with MLH competition rules, Cursor and Gemini AI coding assistants (Antigravity) were utilized for scaffolding, TypeScript types, and unit test generation. All system design, cryptographic verification flows, and domain research are the original work of the author.

---

## License

MIT License. Open source and free for public community infrastructure.
