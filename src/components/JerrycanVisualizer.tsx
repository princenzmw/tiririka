'use client';

import React from 'react';
import { Droplets, Sparkles } from 'lucide-react';

interface JerrycanVisualizerProps {
  litresDispensed: number;
  jerrycanPercentage: number;
  isFlowing: boolean;
}

export default function JerrycanVisualizer({
  litresDispensed,
  jerrycanPercentage,
  isFlowing,
}: JerrycanVisualizerProps) {
  const isFull = litresDispensed >= 20.0;

  return (
    <div className="bg-slate-950/90 rounded-2xl p-5 border border-slate-800 mb-5 flex flex-col items-center relative overflow-hidden shadow-inner">
      {/* Visualizer Header */}
      <div className="w-full flex justify-between items-center text-xs mb-4">
        <span className="text-slate-200 font-bold flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-cyan-400" />
          Nairobi 20L Jerrycan Visualizer
        </span>
        <span
          className={`font-mono font-extrabold px-2.5 py-0.5 rounded-lg border transition-colors ${
            isFull
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
              : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
          }`}
        >
          {litresDispensed.toFixed(1)} / 20.0 L ({jerrycanPercentage}%)
        </span>
      </div>

      {/* 20L Full Celebration Tag */}
      {isFull && (
        <div className="mb-3 px-3 py-1 bg-emerald-950/90 border border-emerald-500 rounded-full text-emerald-200 text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Full 20L Jerrycan Reached (KES 3.00)</span>
        </div>
      )}

      {/* Authentic Nairobi Yellow 20L Plastic Jerrycan */}
      <div className="relative w-44 h-56 flex flex-col items-center">
        {/* Top Handle & Red Cap */}
        <div className="w-32 h-6 flex justify-between items-center px-2">
          {/* Left Handle Anchor */}
          <div className="w-7 h-4 bg-amber-600 rounded-t-md border-t-2 border-x-2 border-amber-400 shadow-sm" />
          {/* Ergonomic Molded Top Handle */}
          <div className="w-14 h-4 border-t-4 border-amber-400 rounded-t-xl" />
          {/* Authentic Red Plastic Screw Cap */}
          <div
            className="w-5 h-5 bg-red-600 rounded-md border-2 border-red-400 shadow-sm"
            title="Red 20L Jerrycan Screw Cap"
          />
        </div>

        {/* Main Yellow HDPE Plastic Container Body */}
        <div className="relative w-40 h-48 bg-amber-500/15 border-4 border-amber-400 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-end p-1.5 backdrop-blur-sm">
          {/* Molded Plastic Structural Ribs */}
          <div className="absolute inset-x-3 top-3 h-0.5 bg-amber-400/30 rounded" />
          <div className="absolute inset-x-3 top-6 h-0.5 bg-amber-400/30 rounded" />
          <div className="absolute inset-y-8 left-3 w-0.5 bg-amber-400/30 rounded" />
          <div className="absolute inset-y-8 right-3 w-0.5 bg-amber-400/30 rounded" />

          {/* Calibrated Litre Measurement Lines */}
          <div className="absolute right-2 inset-y-3 flex flex-col justify-between items-end text-[9px] font-mono text-amber-300/80 font-bold pointer-events-none z-10">
            <span>20L —</span>
            <span>15L —</span>
            <span>10L —</span>
            <span>5L —</span>
            <span>0L —</span>
          </div>

          {/* Water Liquid Filling Level */}
          <div
            className="w-full bg-gradient-to-t from-cyan-600 via-sky-500 to-cyan-400 rounded-2xl transition-all duration-300 relative overflow-hidden shadow-inner"
            style={{ height: `${jerrycanPercentage}%` }}
          >
            {/* Animated Flow Bubbles & Liquid Shimmer */}
            {isFlowing && (
              <>
                <div className="absolute inset-0 bg-white/25 animate-pulse" />
                <div className="absolute bottom-1 left-3 w-1.5 h-1.5 bg-white/60 rounded-full animate-ping" />
                <div className="absolute bottom-3 right-4 w-2 h-2 bg-white/50 rounded-full animate-bounce" />
                <div className="absolute bottom-2 left-8 w-1 h-1 bg-white/70 rounded-full animate-pulse" />
              </>
            )}
          </div>

          {/* Percentage & Volume Label in Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono font-black text-white pointer-events-none drop-shadow-md">
            <span className="text-xl font-extrabold">{jerrycanPercentage}%</span>
            <span className="text-[10px] text-cyan-100 font-semibold">{litresDispensed.toFixed(1)} L</span>
          </div>
        </div>
      </div>
    </div>
  );
}
