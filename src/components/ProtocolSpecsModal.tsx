'use client';

import React, { useState } from 'react';
import { BookOpen, X, Scale, Layers, FileCode, Sparkles } from 'lucide-react';

interface ProtocolSpecsModalProps {
  onClose: () => void;
}

export default function ProtocolSpecsModal({ onClose }: ProtocolSpecsModalProps) {
  const [specsTab, setSpecsTab] = useState<'economics' | 'statemachine' | 'anchor'>('economics');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="specs-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 id="specs-title" className="text-base font-bold text-white">
                Tiririka Protocol Specifications & Economics
              </h3>
              <p className="text-xs text-slate-400">
                Formal Architecture, Cryptographic Guarantees & On-Chain Anchor Model
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setSpecsTab('economics')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              specsTab === 'economics'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Economic Model & Gas Savings</span>
          </button>
          <button
            type="button"
            onClick={() => setSpecsTab('statemachine')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              specsTab === 'statemachine'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>State Machine & Security</span>
          </button>
          <button
            type="button"
            onClick={() => setSpecsTab('anchor')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              specsTab === 'anchor'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Anchor Rust Program</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* TAB 1: Economics */}
          {specsTab === 'economics' && (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-950/40 border border-cyan-800/60 rounded-2xl space-y-2">
                <div className="font-bold text-cyan-200 text-sm">The Micro-Water Fee Dilemma in Nairobi:</div>
                <p className="text-slate-300 leading-relaxed">
                  In Nairobi informal settlements like Mathare and Kibera, clean water is sold at regulated community
                  kiosks for <strong>KES 3.00 per 20L Jerrycan</strong> (approx. <strong>$0.023 USD</strong>, or{' '}
                  <strong>$0.00115 per Litre</strong>).
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border border-slate-800 rounded-xl overflow-hidden">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Architecture</th>
                      <th className="p-2.5">Fee per Litre</th>
                      <th className="p-2.5">Fee for 20L (100 Ticks)</th>
                      <th className="p-2.5">Feasibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-slate-300">
                    <tr>
                      <td className="p-2.5 font-bold text-rose-400">Ethereum L1</td>
                      <td className="p-2.5">~$0.85</td>
                      <td className="p-2.5">~$85.00</td>
                      <td className="p-2.5 text-rose-400">Impossible (3,695% of water cost)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-amber-400">Direct Solana L1</td>
                      <td className="p-2.5">~$0.0013</td>
                      <td className="p-2.5">~$0.13</td>
                      <td className="p-2.5 text-amber-300">Unviable (560% overhead on 20L)</td>
                    </tr>
                    <tr className="bg-emerald-950/40 font-bold text-emerald-300">
                      <td className="p-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Tiririka Protocol
                      </td>
                      <td className="p-2.5">$0.000026</td>
                      <td className="p-2.5">$0.0026 (2 txs total)</td>
                      <td className="p-2.5 text-emerald-400">99.8% Gas Fee Savings</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-slate-400 leading-relaxed text-[11px]">
                By using an on-chain escrow deposit combined with off-chain Ed25519 digital vouchers, customers draw water
                continuously at sub-millisecond speeds. The kiosk terminal settles only one single transaction on Solana when
                finished.
              </p>
            </div>
          )}

          {/* TAB 2: State Machine & Security */}
          {specsTab === 'statemachine' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 font-mono text-[11px]">
                <div className="text-cyan-400 font-bold text-xs uppercase">Cryptographic Lifecycle:</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">1. UNFUNDED</div>
                  <div className="p-2 rounded-lg bg-blue-950 border border-blue-700 text-blue-200">2. ESCROW OPEN</div>
                  <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-700 text-cyan-200">
                    3. OFFLINE VOUCHERS
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-700 text-emerald-200">
                    4. SETTLED
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="font-bold text-white text-xs">Four Cryptographic Security Guarantees:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-cyan-300">1. Replay Attack Defense</div>
                    <p className="text-slate-400 text-[11px]">
                      Each voucher has a strictly monotonic nonce. The terminal rejects any nonce $\le$ previous highest.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-cyan-300">2. Solvency Ceiling</div>
                    <p className="text-slate-400 text-[11px]">
                      Cumulative lamports can never mathematically exceed the initial deposit locked in the on-chain vault.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-cyan-300">3. Anti-Theft Protection</div>
                    <p className="text-slate-400 text-[11px]">
                      A rogue kiosk operator cannot claim more lamports than authorized by the customer&apos;s Ed25519 signature.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-cyan-300">4. 24h Timelock Exit</div>
                    <p className="text-slate-400 text-[11px]">
                      If the kiosk hardware suffers a catastrophic failure, unspent escrow is unilaterally reclaimable by the customer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Anchor Program */}
          {specsTab === 'anchor' && (
            <div className="space-y-3 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>contracts/tiririka/src/lib.rs (Anchor v0.30)</span>
                <span className="text-emerald-400">Mainnet-Ready Architecture</span>
              </div>
              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-slate-300 overflow-x-auto text-[10px] leading-relaxed">
{`#[program]
pub mod tiririka_program {
    use super::*;

    // 1. Locks deposit into Escrow Vault PDA
    pub fn initialize_channel(
        ctx: Context<InitializeChannel>,
        channel_id: String,
        deposit_lamports: u64,
        price_per_litre_lamports: u64,
        timelock_seconds: i64,
    ) -> Result<()> { ... }

    // 2. Settles payout to operator & refunds customer
    pub fn settle_channel(
        ctx: Context<SettleChannel>,
        nonce: u64,
        cumulative_litres: u64,
        cumulative_lamports: u64,
        voucher_timestamp: i64,
        signature: [u8; 64],
    ) -> Result<()> { ... }

    // 3. Unilateral emergency exit after 24h timelock
    pub fn dispute_timeout_refund(ctx: Context<DisputeRefund>) -> Result<()> { ... }
}`}
              </pre>
              <p className="text-slate-400 text-[11px]">
                Full Anchor source code, automated test suite, and IDL specification are published in the project repository
                under <code className="text-cyan-300">/contracts/tiririka</code>.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Program ID: Tirir1kaPayPerL1treWaterK1oskProtoco11111111</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all cursor-pointer font-bold"
          >
            Close Specs
          </button>
        </div>
      </div>
    </div>
  );
}
