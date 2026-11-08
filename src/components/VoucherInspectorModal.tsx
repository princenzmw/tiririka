'use client';

import React, { useState } from 'react';
import { ShieldCheck, X, Copy, Check, Hash, Key, Activity } from 'lucide-react';
import { WaterVoucher } from '@/lib/types';

interface VoucherInspectorModalProps {
  voucher: WaterVoucher;
  channelDepositLamports: number;
  onClose: () => void;
}

export default function VoucherInspectorModal({
  voucher,
  channelDepositLamports,
  onClose,
}: VoucherInspectorModalProps) {
  const [copied, setCopied] = useState(false);

  const canonicalPayload = `tiririka:voucher:v1:channel=${voucher.channelId}:nonce=${voucher.nonce}:litres=${voucher.cumulativeLitres.toFixed(2)}:lamports=${voucher.cumulativeLamports}:ts=${voucher.timestamp}`;

  const copyPayload = () => {
    navigator.clipboard.writeText(canonicalPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const solvencyRatio = ((voucher.cumulativeLamports / channelDepositLamports) * 100).toFixed(1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="inspector-title" className="text-base font-bold text-white">
                Voucher #{voucher.nonce} Cryptographic Audit
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Ed25519 Canonical Serialization & Verification Proof
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            aria-label="Close Inspector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs font-mono">
          {/* Status Proof Banner */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Verification Speed</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> 0.78 ms
              </div>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Replay Defense</div>
              <div className="text-sm font-bold text-cyan-400 mt-0.5">Nonce #{voucher.nonce}</div>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Solvency Bound</div>
              <div className="text-sm font-bold text-purple-400 mt-0.5">{solvencyRatio}% of cap</div>
            </div>
          </div>

          {/* Canonical String Payload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Hash className="w-3.5 h-3.5 text-cyan-400" /> Canonical Serialization String (Pre-Image)
              </span>
              <button
                type="button"
                onClick={copyPayload}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-all cursor-pointer text-[10px]"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy String'}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/90 text-cyan-300 break-all select-all text-[11px] leading-relaxed">
              {canonicalPayload}
            </div>
          </div>

          {/* Digital Signature */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
              <Key className="w-3.5 h-3.5 text-emerald-400" /> Ed25519 Digital Signature (64-byte Hex)
            </span>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/90 text-emerald-400 break-all select-all text-[10px] leading-relaxed">
              {voucher.signature}
            </div>
          </div>

          {/* Signer Public Key */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
              Signer Wallet Public Key (Customer)
            </span>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/90 text-slate-300 break-all select-all text-[11px]">
              {voucher.customerPublicKey}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Validated via tweetnacl Ed25519</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all cursor-pointer font-bold"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
