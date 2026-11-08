'use client';

import React from 'react';
import { Cpu, Gauge, Zap, Database, Activity, SunMedium } from 'lucide-react';

interface HardwareTelemetryProps {
  isFlowing: boolean;
  voucherCount: number;
  litresDispensed: number;
}

export default function HardwareTelemetry({
  isFlowing,
  voucherCount,
  litresDispensed,
}: HardwareTelemetryProps) {
  const pulsesEstimated = Math.round(litresDispensed * 450);
  const flashBytesUsed = voucherCount * 144; // approx 144 bytes per canonical voucher

  return (
    <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 shadow-inner space-y-3 font-mono text-[11px]">
      {/* Telemetry Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          IoT DePIN Controller Status
        </span>
        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-700/60 px-2 py-0.5 rounded-md flex items-center gap-1">
          <Activity className="w-3 h-3 animate-pulse" /> 10Hz Meter Active
        </span>
      </div>

      {/* Grid of Microcontroller Specs */}
      <div className="grid grid-cols-2 gap-2 text-slate-400">
        {/* Solenoid Valve State */}
        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400" /> Solenoid Valve (12V)
          </div>
          <div className="font-bold text-xs mt-1">
            {isFlowing ? (
              <span className="text-emerald-400 flex items-center gap-1 animate-pulse">
                OPEN (Dispensing)
              </span>
            ) : (
              <span className="text-slate-400">CLOSED (Idle)</span>
            )}
          </div>
        </div>

        {/* Hall Effect Sensor */}
        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Gauge className="w-3 h-3 text-cyan-400" /> Flowmeter Pulses
          </div>
          <div className="font-bold text-xs text-white mt-1">
            {pulsesEstimated.toLocaleString()} pulses <span className="text-[9px] text-slate-500">(450/L)</span>
          </div>
        </div>

        {/* Offline NVRAM Buffer */}
        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Database className="w-3 h-3 text-cyan-400" /> Flash Buffer (128KB)
          </div>
          <div className="font-bold text-xs text-purple-300 mt-1">
            {flashBytesUsed} B used <span className="text-[9px] text-slate-500">({voucherCount} cached)</span>
          </div>
        </div>

        {/* Power / Node ID */}
        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <SunMedium className="w-3 h-3 text-amber-400" /> Power / Node
          </div>
          <div className="font-bold text-xs text-amber-300 mt-1 truncate">
            Solar 12V • ESP32 #107
          </div>
        </div>
      </div>
    </div>
  );
}
