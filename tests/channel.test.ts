/**
 * Tiririka Cryptographic & Offline Payment Channel Test Suite
 * Verifies Ed25519 signatures, anti-replay, solvency caps, and offline verification speed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  signWaterVoucher,
  verifyVoucherLocally,
  simulateReplayAttack,
  simulateSolvencyAttack,
  simulateTamperingAttack,
} from '../src/lib/crypto';
import { simulateOverClaimAttempt } from '../src/lib/solana';
import { PaymentChannel, WaterVoucher } from '../src/lib/types';
import { TIRIRIKA_CONFIG } from '../src/lib/constants';

describe('Tiririka Payment Channel Security & Cryptography', () => {
  // Setup mock keys
  const customerKeypair = nacl.sign.keyPair();
  const customerPubkeyBase58 = bs58.encode(customerKeypair.publicKey);

  const operatorKeypair = nacl.sign.keyPair();
  const operatorPubkeyBase58 = bs58.encode(operatorKeypair.publicKey);

  const mockChannel: PaymentChannel = {
    id: 'TiririkaMockChannel_Mathare107',
    customerPublicKey: customerPubkeyBase58,
    kioskOperatorPublicKey: operatorPubkeyBase58,
    depositLamports: 10_000_000, // 0.01 SOL cap
    depositTxSignature: '5MockTxSignatureDevnetDepositConfirmation11111111111111',
    createdAt: Date.now(),
    status: 'OPEN',
    pricePerLitreLamports: TIRIRIKA_CONFIG.LAMPORTS_PER_LITRE,
  };

  it('generates a valid Ed25519 signed voucher that passes local verification', () => {
    const voucher = signWaterVoucher(
      mockChannel.id,
      1,
      0.1,
      642,
      customerKeypair.secretKey,
      customerPubkeyBase58
    );

    const result = verifyVoucherLocally(voucher, mockChannel, 0, 0);

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.verifiedLitres, 0.1);
    assert.strictEqual(result.verifiedLamports, 642);
    assert.strictEqual(result.nonce, 1);
  });

  it('rejects tampered voucher payloads immediately', () => {
    const originalVoucher = signWaterVoucher(
      mockChannel.id,
      2,
      0.2,
      1284,
      customerKeypair.secretKey,
      customerPubkeyBase58
    );

    // Attacker tries to alter litres without valid signature
    const tamperedVoucher: WaterVoucher = {
      ...originalVoucher,
      cumulativeLitres: 50.0, // Inflated volume
    };

    const result = verifyVoucherLocally(tamperedVoucher, mockChannel, 1, 642);
    assert.strictEqual(result.isValid, false);
    assert.match(result.reason || '', /Tampered Voucher Blocked|Digital signature/i);
  });

  it('rejects replayed or stale nonces (Replay Attack Defense)', () => {
    const voucher = signWaterVoucher(
      mockChannel.id,
      5,
      0.5,
      3210,
      customerKeypair.secretKey,
      customerPubkeyBase58
    );

    // Kiosk has already seen up to nonce 5
    const result = verifyVoucherLocally(voucher, mockChannel, 5, 3210);
    assert.strictEqual(result.isValid, false);
    assert.match(result.reason || '', /Stale Voucher Rejected|Replay Blocked/i);
  });

  it('rejects vouchers that exceed the channel deposit ceiling (Solvency Guard)', () => {
    const excessiveLamports = mockChannel.depositLamports + 1000;
    const voucher = signWaterVoucher(
      mockChannel.id,
      10,
      2000.0,
      excessiveLamports,
      customerKeypair.secretKey,
      customerPubkeyBase58
    );

    const result = verifyVoucherLocally(voucher, mockChannel, 9, 500000);
    assert.strictEqual(result.isValid, false);
    assert.match(result.reason || '', /Deposit Cap Exceeded|Solvency Guard/i);
  });

  it('verifies 100 consecutive vouchers in memory at high throughput (Offline Kiosk Speed)', () => {
    const startTime = performance.now();
    let lastNonce = 0;
    let lastLamports = 0;

    for (let i = 1; i <= 100; i++) {
      const litres = Number((i * 0.1).toFixed(2));
      const lamports = i * 642;

      const voucher = signWaterVoucher(
        mockChannel.id,
        i,
        litres,
        lamports,
        customerKeypair.secretKey,
        customerPubkeyBase58
      );

      const verification = verifyVoucherLocally(
        voucher,
        mockChannel,
        lastNonce,
        lastLamports
      );

      assert.strictEqual(verification.isValid, true);
      lastNonce = voucher.nonce;
      lastLamports = voucher.cumulativeLamports;
    }

    const elapsedMs = performance.now() - startTime;
    console.log(`Signed & verified 100 off-chain vouchers locally in ${elapsedMs.toFixed(2)} ms (${(elapsedMs / 100).toFixed(3)} ms/voucher)`);
    assert.ok(elapsedMs < 3000, `Expected 100 vouchers in <3000ms, took ${elapsedMs}ms`);
  });

  it('correctly catches and rejects operator over-claim attempts', () => {
    const validVoucher = signWaterVoucher(
      mockChannel.id,
      137,
      13.7,
      87954,
      customerKeypair.secretKey,
      customerPubkeyBase58
    );

    // Operator attempts to settle for full deposit (10,000,000) when voucher authorizes only 87,954
    const cheatResult = simulateOverClaimAttempt(mockChannel, validVoucher, 10_000_000);
    assert.strictEqual(cheatResult.rejected, true);
    assert.match(cheatResult.error, /SECURITY ENFORCEMENT/);

    // Within limit check
    const honestResult = simulateOverClaimAttempt(mockChannel, validVoucher, 87954);
    assert.strictEqual(honestResult.rejected, false);
  });

  it('validates 3-vector security lab attacks (replay, solvency, tampering)', () => {
    const voucher = signWaterVoucher(
      mockChannel.id,
      10,
      1.0,
      6420,
      customerKeypair.secretKey,
      customerPubkeyBase58
    );

    // 1. Replay attack
    const replay = simulateReplayAttack(mockChannel, voucher, 15);
    assert.strictEqual(replay.rejected, true);
    assert.match(replay.error, /Stale Voucher Rejected|Replay Blocked/i);

    // 2. Solvency attack
    const solvency = simulateSolvencyAttack(mockChannel, voucher);
    assert.strictEqual(solvency.rejected, true);
    assert.match(solvency.error, /Deposit Cap Exceeded|Solvency Guard/i);

    // 3. Tampering attack
    const tampering = simulateTamperingAttack(mockChannel, voucher);
    assert.strictEqual(tampering.rejected, true);
    assert.match(tampering.error, /Tampered Voucher Blocked|Digital signature/i);
  });
});
