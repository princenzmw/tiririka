/**
 * Tiririka Cryptographic Engine
 * Ed25519 Off-chain Payment Channel Voucher Generation & Local Kiosk Verification
 * Uses tweetnacl and bs58 for sub-millisecond offline verification with zero RPC dependency.
 */

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PaymentChannel, WaterVoucher, VerificationResult } from './types';

/**
 * Deterministic canonical serialization of a water payment voucher.
 * Format: TIRIRIKA_V1:<channelId>:<nonce>:<cumulativeLitres>:<cumulativeLamports>
 */
export function serializeVoucherPayload(
  channelId: string,
  nonce: number,
  cumulativeLitres: number,
  cumulativeLamports: number
): Uint8Array {
  const canonicalString = `TIRIRIKA_V1:${channelId}:${nonce}:${cumulativeLitres.toFixed(2)}:${cumulativeLamports}`;
  return new TextEncoder().encode(canonicalString);
}

/**
 * Customer creates and cryptographically signs an incremental voucher off-chain.
 * Generated every 0.1 litres without incurring on-chain transaction fees.
 */
export function signWaterVoucher(
  channelId: string,
  nonce: number,
  cumulativeLitres: number,
  cumulativeLamports: number,
  customerSecretKey: Uint8Array,
  customerPublicKeyBase58: string
): WaterVoucher {
  const messageBytes = serializeVoucherPayload(
    channelId,
    nonce,
    cumulativeLitres,
    cumulativeLamports
  );

  const signatureBytes = nacl.sign.detached(messageBytes, customerSecretKey);
  const signatureBase58 = bs58.encode(signatureBytes);

  return {
    channelId,
    nonce,
    cumulativeLitres: Number(cumulativeLitres.toFixed(2)),
    cumulativeLamports,
    timestamp: Date.now(),
    signature: signatureBase58,
    customerPublicKey: customerPublicKeyBase58,
  };
}

/**
 * Kiosk locally verifies the voucher signature and state constraints.
 * Runs 100% locally in memory (0 network latency, 0 RPC calls, works completely offline).
 */
export function verifyVoucherLocally(
  voucher: WaterVoucher,
  channel: PaymentChannel,
  lastVerifiedNonce: number,
  lastVerifiedLamports: number
): VerificationResult {
  // 1. Channel association check
  if (voucher.channelId !== channel.id) {
    return {
      isValid: false,
      reason: 'Invalid Channel ID: Voucher was issued for a different payment channel.',
      verifiedLitres: 0,
      verifiedLamports: 0,
      nonce: voucher.nonce,
    };
  }

  // 2. Customer identity check
  if (voucher.customerPublicKey !== channel.customerPublicKey) {
    return {
      isValid: false,
      reason: 'Unauthorized Signature: Voucher was not signed by the customer who opened this channel.',
      verifiedLitres: 0,
      verifiedLamports: 0,
      nonce: voucher.nonce,
    };
  }

  // 3. Monotonic nonce check (Replay Protection)
  if (voucher.nonce <= lastVerifiedNonce) {
    return {
      isValid: false,
      reason: `Stale Voucher Rejected (Replay Blocked): Voucher #${voucher.nonce} has already been recorded. Current confirmed voucher is #${lastVerifiedNonce}.`,
      verifiedLitres: 0,
      verifiedLamports: 0,
      nonce: voucher.nonce,
    };
  }

  // 4. Monotonic cumulative payment check
  if (voucher.cumulativeLamports < lastVerifiedLamports) {
    return {
      isValid: false,
      reason: `Invalid Payment: Cumulative amount (${voucher.cumulativeLamports} lamports) cannot be lower than previously confirmed amount (${lastVerifiedLamports} lamports).`,
      verifiedLitres: 0,
      verifiedLamports: 0,
      nonce: voucher.nonce,
    };
  }

  // 5. Deposit ceiling check (Solvency Protection)
  if (voucher.cumulativeLamports > channel.depositLamports) {
    return {
      isValid: false,
      reason: `Deposit Cap Exceeded (Solvency Guard): Claimed ${(voucher.cumulativeLamports / 1e9).toFixed(4)} SOL, which exceeds the customer's ${(channel.depositLamports / 1e9).toFixed(4)} SOL escrow deposit.`,
      verifiedLitres: 0,
      verifiedLamports: 0,
      nonce: voucher.nonce,
    };
  }

  // 6. Cryptographic Ed25519 signature verification
  try {
    const messageBytes = serializeVoucherPayload(
      voucher.channelId,
      voucher.nonce,
      voucher.cumulativeLitres,
      voucher.cumulativeLamports
    );

    const signatureBytes = bs58.decode(voucher.signature);
    const pubKeyBytes = bs58.decode(voucher.customerPublicKey);

    const isSignatureValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubKeyBytes
    );

    if (!isSignatureValid) {
      return {
        isValid: false,
        reason: 'Tampered Voucher Blocked: Digital signature does not match payload. Volume or payment data was altered in transit.',
        verifiedLitres: 0,
        verifiedLamports: 0,
        nonce: voucher.nonce,
      };
    }

    return {
      isValid: true,
      verifiedLitres: voucher.cumulativeLitres,
      verifiedLamports: voucher.cumulativeLamports,
      nonce: voucher.nonce,
    };
  } catch (err) {
    return {
      isValid: false,
      reason: `Signature Verification Failed: Invalid signature encoding (${err instanceof Error ? err.message : String(err)}).`,
      verifiedLitres: 0,
      verifiedLamports: 0,
      nonce: voucher.nonce,
    };
  }
}

/**
 * Simulates a Stale Nonce Replay Attack (Security Lab Test 1)
 */
export function simulateReplayAttack(
  channel: PaymentChannel,
  currentVoucher: WaterVoucher,
  currentNonce: number
): { rejected: boolean; attackType: string; error: string; executionMs: number } {
  const start = performance.now();
  const staleNonce = Math.max(1, currentNonce - 3);
  const replayVoucher: WaterVoucher = {
    ...currentVoucher,
    nonce: staleNonce,
  };

  const result = verifyVoucherLocally(replayVoucher, channel, currentNonce, currentVoucher.cumulativeLamports);
  const executionMs = Number((performance.now() - start).toFixed(2));

  return {
    rejected: !result.isValid,
    attackType: 'Replay Attack (Stale Nonce)',
    error: result.reason || 'Replay rejected',
    executionMs,
  };
}

/**
 * Simulates an Escrow Solvency Breach Attack (Security Lab Test 2)
 */
export function simulateSolvencyAttack(
  channel: PaymentChannel,
  currentVoucher: WaterVoucher
): { rejected: boolean; attackType: string; error: string; executionMs: number } {
  const start = performance.now();
  const excessiveLamports = channel.depositLamports * 5; // 5x deposit
  const breachVoucher: WaterVoucher = {
    ...currentVoucher,
    nonce: currentVoucher.nonce + 1,
    cumulativeLamports: excessiveLamports,
  };

  const result = verifyVoucherLocally(breachVoucher, channel, currentVoucher.nonce, currentVoucher.cumulativeLamports);
  const executionMs = Number((performance.now() - start).toFixed(2));

  return {
    rejected: !result.isValid,
    attackType: 'Solvency Breach (Over-Claim)',
    error: result.reason || 'Solvency guard breached',
    executionMs,
  };
}

/**
 * Simulates a Payload Tampering Attack (Security Lab Test 3)
 */
export function simulateTamperingAttack(
  channel: PaymentChannel,
  currentVoucher: WaterVoucher,
  currentNonce: number = currentVoucher.nonce
): { rejected: boolean; attackType: string; error: string; executionMs: number } {
  const start = performance.now();
  // Ensure the tampered voucher passes nonce & solvency checks so that it strictly
  // tests the Ed25519 digital signature guard against payload alteration.
  const targetNonce = Math.max(currentNonce, currentVoucher.nonce) + 1;
  const solventLamports = Math.min(
    channel.depositLamports - 1000,
    Math.max(currentVoucher.cumulativeLamports + 642, 642)
  );

  const tamperedVoucher: WaterVoucher = {
    ...currentVoucher,
    nonce: targetNonce,
    cumulativeLitres: Number((currentVoucher.cumulativeLitres + 0.1).toFixed(2)),
    cumulativeLamports: solventLamports,
    // Original signature is now invalid because nonce, litres, and lamports changed
  };

  const result = verifyVoucherLocally(
    tamperedVoucher,
    channel,
    currentNonce,
    currentVoucher.cumulativeLamports
  );
  const executionMs = Number((performance.now() - start).toFixed(2));

  return {
    rejected: !result.isValid,
    attackType: 'Payload Signature Tampering',
    error: result.reason || 'Tampering rejected: Ed25519 signature mismatch.',
    executionMs,
  };
}
