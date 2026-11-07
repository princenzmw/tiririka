/**
 * Tiririka: Pay-per-litre Water Kiosk Protocol on Solana Payment Channels
 * Core Type Definitions
 */

export interface PaymentChannel {
  id: string; // Unique channel UUID or PDA identifier
  customerPublicKey: string; // Base58 encoded customer public key
  kioskOperatorPublicKey: string; // Base58 encoded kiosk operator public key
  depositLamports: number; // Maximum funded deposit in lamports (e.g. 0.05 SOL = 50,000,000 lamports)
  depositTxSignature: string; // On-chain transaction signature opening the channel
  createdAt: number;
  status: 'OPEN' | 'SETTLING' | 'SETTLED' | 'REFUNDED';
  pricePerLitreLamports: number; // Cost per litre in lamports (e.g. 1 litre = ~1,000 lamports)
}

export interface WaterVoucher {
  channelId: string;
  nonce: number; // Strictly incrementing counter (1, 2, 3...) to prevent replay attacks
  cumulativeLitres: number; // Total litres dispensed so far in this session (e.g. 13.7)
  cumulativeLamports: number; // Total lamports owed to operator so far (e.g. 13,700)
  timestamp: number;
  signature: string; // Base58-encoded Ed25519 signature by customer
  customerPublicKey: string; // Base58-encoded customer public key
}

export interface VerificationResult {
  isValid: boolean;
  reason?: string;
  verifiedLitres: number;
  verifiedLamports: number;
  nonce: number;
}

export interface SettlementSummary {
  channelId: string;
  totalVouchersReceived: number;
  highestValidVoucher: WaterVoucher;
  operatorPayoutLamports: number;
  customerRefundLamports: number;
  settlementTxSignature: string;
  explorerUrl: string;
}

export interface KioskState {
  isDispensing: boolean;
  isOnline: boolean; // Simulates physical network connectivity (online vs. offline local verification)
  litresDispensed: number;
  vouchersReceived: number;
  lastVerifiedNonce: number;
  unsettledLamports: number;
  status: 'IDLE' | 'ACTIVE_FLOW' | 'OFFLINE_VERIFYING' | 'SETTLING' | 'COMPLETED';
}
