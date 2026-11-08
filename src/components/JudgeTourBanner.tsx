'use client';

import React from 'react';
import { Zap, Play, X, CheckCircle, ArrowRight } from 'lucide-react';

interface JudgeTourBannerProps {
  currentStep: number;
  onAutoDemo: () => void;
  isAutoDemoRunning: boolean;
  onDismiss: () => void;
}

export default function JudgeTourBanner({
  currentStep,
  onAutoDemo,
  isAutoDemoRunning,
  onDismiss,
}: JudgeTourBannerProps) {
  const steps = [
    { num: 1, title: 'Open Escrow Channel' },
    { num: 2, title: 'Stream Vouchers' },
    { num: 3, title: 'Sever Internet' },
    { num: 4, title: 'Test Security Attack' },
    { num: 5, title: 'Settle On-Chain' },
  ];

  return (
    <div className="bg-gradient-to-r from-cyan-950/90 via-slate-900 to-blue-950/90 border-b border-cyan-800/60 px-4 py-2.5 text-xs shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-cyan-500/20 border border-cyan-400/40 rounded-lg text-cyan-300">
            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-white">Judge 60-Second Walkthrough:</span>{' '}
            <span className="text-slate-300 hidden sm:inline">
              Follow the 5-step lifecycle below to evaluate Tiririka in under 1 minute.
            </span>
          </div>
        </div>

        {/* Steps Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono overflow-x-auto max-w-full">
          {steps.map((s, idx) => (
            <React.Fragment key={s.num}>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border whitespace-nowrap ${
                  currentStep >= s.num
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold'
                    : 'bg-slate-950/60 text-slate-500 border-slate-800'
                }`}
              >
                {currentStep > s.num ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span>{s.num}.</span>
                )}
                <span>{s.title}</span>
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onAutoDemo}
            disabled={isAutoDemoRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm shadow-cyan-500/30 disabled:opacity-50"
            title="Automatically run the entire 5-step demo walkthrough"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isAutoDemoRunning ? 'Running Tour...' : 'Auto-Run Demo'}</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss Judge Tour Banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
