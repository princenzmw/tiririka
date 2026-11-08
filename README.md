# Tiririka (Swahili: *to flow, to trickle*)

> **Pay-per-litre water kiosk protocol on Solana payment channels.**  
> Built for the **MLH Solana Hackathon (November 6–8, 2026)**.

[![Demo: Live on Vercel](https://img.shields.io/badge/Demo-Live%20on%20Vercel-000000?logo=vercel&logoColor=white)](https://tiririka.vercel.app)
[![Demo: Video Walkthrough](https://img.shields.io/badge/YouTube-Video%20Demo-FF0000?logo=youtube&logoColor=white)](https://youtu.be/ncVHReBpwXA)
[![Network: Solana Devnet](https://img.shields.io/badge/Solana-Devnet-14F195?logo=solana&logoColor=black)](https://explorer.solana.com/?cluster=devnet)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js: 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tests: 100% Pass](https://img.shields.io/badge/Tests-7%2F7%20Passing-emerald)](https://github.com/princenzmw/tiririka)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Live Production App:** [https://tiririka.vercel.app](https://tiririka.vercel.app)  
**2-Minute Video Walkthrough:** [https://youtu.be/ncVHReBpwXA](https://youtu.be/ncVHReBpwXA)  
**Public Repository:** [https://github.com/princenzmw/tiririka](https://github.com/princenzmw/tiririka)  
**Verified Devnet Operator:** [`2wYHsuCApQqVwxKv6Hi8YcueqF8pMVTRrweSAAQ3FVy2`](https://explorer.solana.com/address/2wYHsuCApQqVwxKv6Hi8YcueqF8pMVTRrweSAAQ3FVy2?cluster=devnet)

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

## 3. Video Demonstration (2 Minutes)

[![Watch Tiririka Video Demo](https://img.youtube.com/vi/ncVHReBpwXA/hqdefault.jpg)](https://youtu.be/ncVHReBpwXA)

> **[▶ Watch the Live Video Walkthrough on YouTube (2:02)](https://youtu.be/ncVHReBpwXA)**  
> *Narrated by Prince Nzamuwe demonstrating on-chain escrow funding, off-chain Ed25519 voucher streaming, live cellular blackout cutover, 0ms threat lab defense, and single-transaction settlement on Solana Devnet.*

---

## 4. Protocol Lifecycle & Operational Architecture

Tiririka operates across six deterministic phases designed for physical IoT micro-utilities:

1. **Escrow Collateral Initialization (On-Chain Tx #1):** The consumer opens a payment channel by locking a spending cap deposit (e.g., 0.01 SOL ≈ 1,557 litres) into an isolated PDA escrow vault on Solana Devnet.
2. **High-Frequency Off-Chain Micropayment Streaming:** As water flows from the nozzle (0.1L ticks), the consumer's client cryptographically signs cumulative Ed25519 vouchers off-chain. Monotonically incrementing nonces and lamports accumulate with zero gas fees.
3. **Cellular Blackout Fault Tolerance:** When cellular connectivity drops in informal settlements, the physical kiosk terminal switches seamlessly to local in-memory verification (< 1ms). Water continues dispensing without interruption across consecutive customer sessions.
4. **Cryptographic Threat Defense (In-Memory Guard):** The terminal inspects every incoming voucher against three threat vectors—stale nonce replays, escrow solvency breaches, and payload signature tampering—halting the solenoid valve instantly if any check fails.
5. **On-Chain Settlement & Instant Collateral Refund (On-Chain Tx #2):** When the tap closes, the kiosk broadcasts the single highest signed voucher to Solana Devnet. The operator receives payout for the exact litres dispensed, and all unspent deposit lamports are automatically refunded back to the consumer.
6. **Unilateral Consumer Timelock Exit:** If the kiosk hardware suffers power failure or network loss exceeding 24 hours, an on-chain timelock guarantees the consumer can reclaim 100% of remaining escrow collateral unilaterally without operator permission.

---

## 5. Cryptographic Security Architecture

* **Voucher Canonical Message:**  
  `TIRIRIKA_V1:<channelId>:<nonce>:<cumulativeLitres>:<cumulativeLamports>`
* **Replay Protection:** Nonce must be strictly incrementing (`nonce > lastVerifiedNonce`).
* **Cumulative Monotonicity:** Lamports owed must increase monotonically (`lamports >= lastVerifiedLamports`).
* **Solvency Guard:** Vouchers exceeding `channel.depositLamports` are rejected immediately.
* **Local Speed:** In-memory Ed25519 signature checks execute in **under 1ms per voucher** with zero network overhead.
* **Unilateral Timelock Exit:** 24-hour timelock guarantees the consumer can unilaterally reclaim unspent escrow deposit if kiosk hardware fails.

---

## 6. On-Chain Anchor Smart Contract Specification

The project includes a complete Solana Anchor v0.30 smart contract blueprint located under `/contracts/tiririka`:

* **`initialize_channel`**: Creates the `PaymentChannel` PDA and locks deposit lamports in an isolated `Escrow Vault PDA`.
* **`settle_channel`**: Introspects Solana's native Ed25519 precompile instruction to verify customer digital signatures, pays earned lamports to the operator, and refunds unspent balance.
* **`dispute_timeout_refund`**: Protects the customer against operator downtime or abandonment by allowing unilateral deposit reclamation after the timelock elapses.

See [contracts/tiririka/src/lib.rs](contracts/tiririka/src/lib.rs) and [contracts/tiririka/idl.json](contracts/tiririka/idl.json) for the full source and IDL.

---

## 7. Live App & Local Development

### Live Production Deployment
Experience the live protocol instantly without installation:  
👉 **[https://tiririka.vercel.app](https://tiririka.vercel.app)**

### Prerequisites for Local Run
* Node.js v20+ or v26+
* npm or pnpm

### Local Installation & Automated Tests
```bash
# Clone the repository
git clone https://github.com/princenzmw/tiririka.git
cd tiririka

# Install dependencies
npm install --ignore-scripts

# Run the automated cryptographic test suite (7/7 passing)
npm test
```

### Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3300](http://localhost:3300) in your browser.

---

## 8. Hackathon Transparency & Disclosures

* **Event:** MLH Solana Hackathon (November 6–8, 2026).
* **Builder:** Prince NZAMUWE ([@princenzmw](https://github.com/princenzmw)) — 3rd-year BSc Data Science student, Mastercard Foundation Scholar at USIU-Africa, Nairobi, Kenya.
* **AI Tool Disclosure:** In accordance with MLH competition rules, Cursor and Gemini AI coding assistants (Antigravity) were utilized for scaffolding, TypeScript types, and unit test generation. All system design, cryptographic verification flows, and domain research are the original work of the author.

---

## License

MIT License. Open source and free for public community infrastructure.
