# Tiririka On-Chain Anchor Program

The on-chain Anchor smart contract specification for **Tiririka Protocol**: Pay-Per-Litre Water Kiosk Payment Channels on Solana.

## Architecture

```
+-----------------------------------------------------------------------------------+
|                              Solana Global Ledger                                 |
|                                                                                   |
|   +-----------------------+     CPI Transfer      +---------------------------+   |
|   |  Customer Wallet      | --------------------> | Escrow Vault PDA          |   |
|   |  (Payer Signer)       |                       | [vault, cust, op, id]     |   |
|   +-----------------------+                       +---------------------------+   |
|               |                                                 |                 |
|               | Off-Chain                                       | On-Chain        |
|               | Signed Vouchers                                 | Settlement      |
|               v                                                 v                 |
|   +-----------------------+                       +---------------------------+   |
|   |  Kiosk Hardware       | -- settle_channel --> | Operator Wallet           |   |
|   |  (Mathare #107)       |    (Ed25519 verify)   | + Customer Refund         |   |
|   +-----------------------+                       +---------------------------+   |
+-----------------------------------------------------------------------------------+
```

### Instructions

1. **`initialize_channel`**
   - Creates `PaymentChannel` PDA.
   - Locks consumer deposit into `Escrow Vault PDA`.
   - Sets `timelock_refund_ts` (default: 24 hours).

2. **`settle_channel`**
   - Kiosk submits final highest voucher.
   - Verifies Ed25519 signature of canonical voucher string against customer public key.
   - Verifies nonce is strictly monotonic.
   - Verifies cumulative lamports does not exceed deposit solvency.
   - Releases earned lamports to kiosk operator.
   - Automatically refunds unspent deposit back to consumer.
   - Marks channel as `Settled`.

3. **`dispute_timeout_refund`**
   - Unilateral consumer emergency exit.
   - If operator hardware dies or fails to settle, customer invokes this after `timelock_refund_ts` to reclaim 100% of remaining escrow.
