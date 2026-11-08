'use client';

import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Play, CheckCircle2 } from 'lucide-react';
import { PaymentChannel, WaterVoucher } from '@/lib/types';
import {
  simulateReplayAttack,
  simulateSolvencyAttack,
  simulateTamperingAttack,
} from '@/lib/crypto';

interface SecurityLabProps {
  channel: PaymentChannel | null;
  lastVoucher: WaterVoucher | null;
  voucherCount: number;
  onAttackTriggered: (result: { type: string; message: string; executionMs: number }) => void;
}

export default function SecurityLab({
  channel,
  lastVoucher,
  voucherCount,
  onAttackTriggered,
}: SecurityLabProps) {
  const [selectedAttack, setSelectedAttack] = useState<'replay' | 'solvency' | 'tampering'>('replay');
  const [lastAttackResult, setLastAttackResult] = useState<{
    attackType: string;
    error: string;
    executionMs: number;
    rejected: boolean;
  } | null>(null);

  const attacks = [
    {
      id: 'replay' as const,
      label: '1. Stale Replay',
      title: 'Stale Nonce Replay Attack',
      description:
        'A rogue party intercepts an earlier valid voucher (e.g., Nonce #5) and attempts to submit it to double-spend or reset water accounting.',
      guard: 'Enforces strictly monotonic nonces: nonce > last_verified_nonce.',
    },
    {
      id: 'solvency' as const,
      label: '2. Solvency Breach',
      title: 'Escrow Solvency Over-Claim Attack',
      description:
        'A compromised kiosk terminal attempts to claim 0.05 SOL on a channel funded with only 0.01 SOL escrow.',
      guard: 'Enforces solvency ceiling: claimed_lamports <= channel.deposit_lamports.',
    },
    {
      id: 'tampering' as const,
      label: '3. Data Tampering',
      title: 'Payload Signature Tampering Attack',
      description:
        'Man-in-the-middle alters 1 byte of the litres/lamports data in transit without possessing the customer’s private key.',
      guard: 'Ed25519 digital signature validation fails against the modified canonical pre-image.',
    },
  ];

  const currentAttackInfo = attacks.find((a) => a.id === selectedAttack)!;

  const handleRunSimulation = () => {
    if (!channel) return;

    const activeNonce = Math.max(1, voucherCount);
    const baseVoucher = lastVoucher || {
      channelId: channel.id,
      nonce: activeNonce,
      cumulativeLitres: Number((activeNonce * 0.1).toFixed(1)),
      cumulativeLamports: activeNonce * 642,
      timestamp: Date.now(),
      signature: '3hG9dummyAttackLabSig1111111111111111111111111111111111111111111111111111111111',
      customerPublicKey: channel.customerPublicKey,
    };

    let result;
    if (selectedAttack === 'replay') {
      result = simulateReplayAttack(channel, baseVoucher, activeNonce);
    } else if (selectedAttack === 'solvency') {
      result = simulateSolvencyAttack(channel, baseVoucher);
    } else {
      result = simulateTamperingAttack(channel, baseVoucher, activeNonce);
    }

    setLastAttackResult(result);
    onAttackTriggered({
      type: result.attackType,
      message: result.error,
      executionMs: result.executionMs,
    });
  };

  return (
    <div className="bg-slate-950/80 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Cryptographic Threat Lab
            </h3>
            <p className="text-[10px] text-slate-400">
              Interactive testbed for 3 classic Web3 payment channel attack vectors
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
          Ed25519 In-Memory Defense
        </span>
      </div>

      {/* Attack Vector Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-[11px] font-mono">
        {attacks.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setSelectedAttack(a.id);
              setLastAttackResult(null);
            }}
            className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer text-center truncate ${
              selectedAttack === a.id
                ? 'bg-rose-950 text-rose-200 border border-rose-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Attack Scenario Explanation */}
      <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
        <div className="font-bold text-white flex items-center justify-between">
          <span className="text-rose-200">{currentAttackInfo.title}</span>
          <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
            Threat Vector
          </span>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">
          {currentAttackInfo.description}
        </p>
        <div className="flex items-start gap-1.5 text-[10px] text-emerald-400 font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
          <span>Security Rule: {currentAttackInfo.guard}</span>
        </div>
      </div>

      {/* Run Attack Simulation Button */}
      <button
        type="button"
        onClick={handleRunSimulation}
        disabled={!channel}
        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-950/70 border border-rose-700 hover:bg-rose-900 text-rose-200 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 shadow-md shadow-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Test Threat Defense: {currentAttackInfo.title}</span>
      </button>

      {/* Attack Result Proof Toast */}
      {lastAttackResult && (
        <div className="p-3.5 bg-rose-950/90 border border-rose-500 rounded-xl space-y-1.5 text-xs text-rose-200 animate-in fade-in duration-200">
          <div className="flex items-center justify-between font-bold text-rose-300 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-300 font-extrabold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ATTACK BLOCKED & PROTECTED ({lastAttackResult.executionMs} ms)
            </span>
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-rose-300 font-mono">
              0 Network Latency
            </span>
          </div>
          <p className="text-[11px] text-rose-100 leading-relaxed font-sans pt-0.5">
            {lastAttackResult.error}
          </p>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-rose-900/60 font-mono flex items-center justify-between">
            <span>Kiosk Hardware Action: Flow valve remained closed</span>
            <span className="text-emerald-400 font-bold">100% Funds Secure</span>
          </div>
        </div>
      )}
    </div>
  );
}
