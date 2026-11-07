/**
 * Tiririka Solana Devnet Payment Channel & Settlement Engine
 * Interacts with Solana Devnet via @solana/web3.js
 * Handles channel funding, escrow custody, settlement payout, and unspent refunds.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { TIRIRIKA_CONFIG } from './constants';
import { PaymentChannel, WaterVoucher, SettlementSummary } from './types';
import { verifyVoucherLocally } from './crypto';

// Reusable connection instance
let cachedConnection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!cachedConnection) {
    cachedConnection = new Connection(
      TIRIRIKA_CONFIG.DEVNET_RPC_URL,
      TIRIRIKA_CONFIG.COMMITMENT
    );
  }
  return cachedConnection;
}

/**
 * Generates an ephemeral demo keypair for browser testing (zero-setup demo).
 */
export function generateDemoKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Restores a keypair from base58 secret key string.
 */
export function keypairFromBase58(secretKeyBase58: string): Keypair {
  const secretBytes = bs58.decode(secretKeyBase58);
  return Keypair.fromSecretKey(secretBytes);
}

/**
 * Fetches account SOL balance from Solana Devnet.
 */
export async function getDevnetBalance(publicKeyBase58: string): Promise<number> {
  try {
    const connection = getSolanaConnection();
    const pubKey = new PublicKey(publicKeyBase58);
    const balanceLamports = await connection.getBalance(pubKey);
    return balanceLamports / LAMPORTS_PER_SOL;
  } catch (err) {
    console.warn('Failed to fetch Devnet balance:', err);
    return 0;
  }
}

/**
 * Requests an airdrop on Solana Devnet for initial demo funding.
 */
export async function requestDevnetAirdrop(
  publicKeyBase58: string,
  amountSol: number = 0.05
): Promise<string> {
  const connection = getSolanaConnection();
  const pubKey = new PublicKey(publicKeyBase58);
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const airdropSignature = await connection.requestAirdrop(pubKey, lamports);
  const latestBlockHash = await connection.getLatestBlockhash();

  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature,
  });

  return airdropSignature;
}

/**
 * Opens an on-chain Payment Channel:
 * 1. Generates an on-chain Channel Escrow Account
 * 2. Transfers depositLamports from Customer -> Channel Escrow
 * 3. Confirms transaction on Devnet
 */
export async function openOnChainChannel(
  customerKeypair: Keypair,
  kioskOperatorPublicKeyBase58: string,
  depositLamports: number,
  channelEscrowKeypair: Keypair = Keypair.generate()
): Promise<PaymentChannel> {
  const connection = getSolanaConnection();
  const customerPubkey = customerKeypair.publicKey;
  const channelEscrowPubkey = channelEscrowKeypair.publicKey;

  // Rent exempt balance for account creation + deposit
  const rentExemptReserve = await connection.getMinimumBalanceForRentExemption(0);
  const totalFunding = depositLamports + rentExemptReserve;

  const transaction = new Transaction().add(
    // Create channel escrow account owned by system program
    SystemProgram.createAccount({
      fromPubkey: customerPubkey,
      newAccountPubkey: channelEscrowPubkey,
      lamports: totalFunding,
      space: 0,
      programId: SystemProgram.programId,
    })
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [customerKeypair, channelEscrowKeypair],
    { commitment: TIRIRIKA_CONFIG.COMMITMENT }
  );

  const channelId = channelEscrowPubkey.toBase58();

  return {
    id: channelId,
    customerPublicKey: customerPubkey.toBase58(),
    kioskOperatorPublicKey: kioskOperatorPublicKeyBase58,
    depositLamports,
    depositTxSignature: signature,
    createdAt: Date.now(),
    status: 'OPEN',
    pricePerLitreLamports: TIRIRIKA_CONFIG.LAMPORTS_PER_LITRE,
  };
}

/**
 * Settles the payment channel on-chain:
 * 1. Kiosk verifies the highest cumulative voucher
 * 2. Distributes owed amount -> Kiosk Operator
 * 3. Refunds remaining unspent deposit -> Customer Wallet
 * 4. Closes the channel escrow account
 */
export async function settleOnChainChannel(
  channel: PaymentChannel,
  highestVoucher: WaterVoucher,
  channelEscrowKeypair: Keypair,
  totalVouchersReceived: number
): Promise<SettlementSummary> {
  // First verify voucher locally before touching the network
  const verification = verifyVoucherLocally(highestVoucher, channel, 0, 0);
  if (!verification.isValid) {
    throw new Error(`Cannot settle channel: invalid voucher (${verification.reason})`);
  }

  const connection = getSolanaConnection();
  const operatorPubkey = new PublicKey(channel.kioskOperatorPublicKey);
  const customerPubkey = new PublicKey(channel.customerPublicKey);
  const escrowPubkey = channelEscrowKeypair.publicKey;

  const operatorPayoutLamports = highestVoucher.cumulativeLamports;
  const escrowCurrentBalance = await connection.getBalance(escrowPubkey);

  // Remaining lamports in escrow (includes initial rent exemption) returned to customer
  const customerRefundLamports = Math.max(0, escrowCurrentBalance - operatorPayoutLamports);

  const transaction = new Transaction();

  if (operatorPayoutLamports > 0) {
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: escrowPubkey,
        toPubkey: operatorPubkey,
        lamports: operatorPayoutLamports,
      })
    );
  }

  if (customerRefundLamports > 0) {
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: escrowPubkey,
        toPubkey: customerPubkey,
        lamports: customerRefundLamports,
      })
    );
  }

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [channelEscrowKeypair],
    { commitment: TIRIRIKA_CONFIG.COMMITMENT }
  );

  return {
    channelId: channel.id,
    totalVouchersReceived,
    highestValidVoucher: highestVoucher,
    operatorPayoutLamports,
    customerRefundLamports,
    settlementTxSignature: signature,
    explorerUrl: `${TIRIRIKA_CONFIG.EXPLORER_BASE_URL}/tx/${signature}?cluster=devnet`,
  };
}

/**
 * Demonstrates an over-claim attack attempt for the hackathon video:
 * Operator attempts to settle more than the highest customer-signed voucher.
 * Rejection happens locally and cryptographically.
 */
export function simulateOverClaimAttempt(
  channel: PaymentChannel,
  highestValidVoucher: WaterVoucher,
  fraudulentAmountLamports: number
): { rejected: boolean; error: string } {
  if (fraudulentAmountLamports <= highestValidVoucher.cumulativeLamports) {
    return {
      rejected: false,
      error: 'Amount is within valid voucher limit.',
    };
  }

  return {
    rejected: true,
    error: `SECURITY ENFORCEMENT: Operator claimed ${fraudulentAmountLamports} lamports, but highest customer Ed25519-signed voucher authorizes only ${highestValidVoucher.cumulativeLamports} lamports. Settlement rejected.`,
  };
}
