/**
 * Tiririka Constants & Nairobi Kiosk Real-World Economic Model
 * Grounded in Nuvoni Research & Kenya Informal Settlement Water Data
 */

export const TIRIRIKA_CONFIG = {
  // Economic & Currency Metrics
  KES_PER_20L_JERRYCAN: 3.0, // Standard Nairobi water ATM / kiosk price (Mathare & Kibera)
  KES_PER_LITRE: 0.15, // KES 3 / 20 litres
  USD_PER_KES: 0.0077, // Current KES exchange rate (~130 KES / USD)
  SOL_PRICE_USD: 180.0, // Benchmark SOL/USD reference

  // Derived Solana Micropayment Rate
  // 1 Litre = KES 0.15 ≈ $0.001155 ≈ 0.00000642 SOL = 6,420 Lamports
  // Per 0.1 Litre dispense tick = 642 Lamports
  LAMPORTS_PER_LITRE: 6420,
  LAMPORTS_PER_TICK: 642, // Owed per 0.1L voucher tick
  LITRES_PER_TICK: 0.1,

  // Channel Configuration
  DEFAULT_DEPOSIT_SOL: 0.01, // 0.01 SOL deposit cap (~1,557 Litres capability)
  DEFAULT_DEPOSIT_LAMPORTS: 10_000_000, // 0.01 SOL in lamports

  // Solana Network Parameters
  DEVNET_RPC_URL: 'https://api.devnet.solana.com',
  COMMITMENT: 'confirmed' as const,
  EXPLORER_BASE_URL: 'https://explorer.solana.com',

  // Kiosk Default Demo Operator
  DEFAULT_OPERATOR_NAME: 'Mathare 4A Smart Kiosk #107',
  DEFAULT_LOCATION: 'Mathare Valley, Nairobi, Kenya',
};
