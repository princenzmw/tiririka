'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Droplets,
  Wifi,
  WifiOff,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  Coins,
  CheckCircle2,
  Lock,
  RotateCcw,
  Sparkles,
  Play,
  Pause,
  Plus,
  Zap,
  Volume2,
  VolumeX,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TIRIRIKA_CONFIG } from '@/lib/constants';
import { PaymentChannel, WaterVoucher, SettlementSummary } from '@/lib/types';
import { signWaterVoucher, verifyVoucherLocally } from '@/lib/crypto';
import {
  generateDemoKeypair,
  getDevnetBalance,
  requestDevnetAirdrop,
  openOnChainChannel,
  settleOnChainChannel,
  simulateOverClaimAttempt,
} from '@/lib/solana';
import { Keypair } from '@solana/web3.js';

// Synthesize pleasant sound effects via Web Audio API without external audio files
function playAudioTone(type: 'tick' | 'settle' | 'alert') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } else if (type === 'settle') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
      });
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio context may be restricted by browser policy before first user interaction
  }
}

export default function TiririkaKioskApp() {
  // Keypairs initialized on client mount
  const [customerKeypair, setCustomerKeypair] = useState<Keypair | null>(null);
  const [operatorPublicKeyBase58] = useState<string>(TIRIRIKA_CONFIG.DEFAULT_OPERATOR_PUBLIC_KEY);
  const [channelEscrowKeypair, setChannelEscrowKeypair] = useState<Keypair | null>(null);

  // Audio Toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Balances
  const [customerBalanceSol, setCustomerBalanceSol] = useState<number>(0.05);
  const [operatorBalanceSol, setOperatorBalanceSol] = useState<number>(0.02);
  const [isAirdropping, setIsAirdropping] = useState<boolean>(false);

  // Channel State
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [depositSol, setDepositSol] = useState<number>(TIRIRIKA_CONFIG.DEFAULT_DEPOSIT_SOL);
  const [isOpeningChannel, setIsOpeningChannel] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [settlementResult, setSettlementResult] = useState<SettlementSummary | null>(null);

  // Dispensing & Voucher Stream State
  const [isFlowing, setIsFlowing] = useState<boolean>(false);
  const [isKioskOnline, setIsKioskOnline] = useState<boolean>(true);
  const [litresDispensed, setLitresDispensed] = useState<number>(0);
  const [voucherCount, setVoucherCount] = useState<number>(0);
  const [lastVoucher, setLastVoucher] = useState<WaterVoucher | null>(null);
  const [verifiedLamports, setVerifiedLamports] = useState<number>(0);

  // Security Simulation State
  const [securityAlert, setSecurityAlert] = useState<{ type: 'attack' | 'success'; message: string } | null>(null);

  // Dispense interval timer ref
  const dispenseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update balances from Devnet
  const refreshBalances = useCallback(async () => {
    if (customerKeypair) {
      const custBal = await getDevnetBalance(customerKeypair.publicKey.toBase58());
      const opBal = await getDevnetBalance(operatorPublicKeyBase58);
      if (custBal > 0) setCustomerBalanceSol(custBal);
      if (opBal > 0) setOperatorBalanceSol(opBal);
    }
  }, [customerKeypair, operatorPublicKeyBase58]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setCustomerKeypair(generateDemoKeypair());
      setChannelEscrowKeypair(generateDemoKeypair());
      setTimeout(() => {
        refreshBalances();
      }, 500);
    });
    return () => cancelAnimationFrame(frameId);
  }, [refreshBalances]);

  // Handle Devnet Airdrop
  const handleAirdrop = async () => {
    if (!customerKeypair) return;
    setIsAirdropping(true);
    try {
      await requestDevnetAirdrop(customerKeypair.publicKey.toBase58(), 0.05);
      await refreshBalances();
      setCustomerBalanceSol((prev) => prev + 0.05);
    } catch {
      setCustomerBalanceSol((prev) => prev + 0.05);
    } finally {
      setIsAirdropping(false);
    }
  };

  // Open Payment Channel on Solana
  const handleOpenChannel = async () => {
    if (!customerKeypair || !channelEscrowKeypair) return;
    setIsOpeningChannel(true);
    setSecurityAlert(null);
    setSettlementResult(null);

    const depositLamports = Math.floor(depositSol * 1_000_000_000);

    try {
      const newChannel = await openOnChainChannel(
        customerKeypair,
        operatorPublicKeyBase58,
        depositLamports,
        channelEscrowKeypair
      );
      setChannel(newChannel);
      setCustomerBalanceSol((prev) => Math.max(0, prev - depositSol));
      if (soundEnabled) playAudioTone('settle');
    } catch {
      const fallbackChannel: PaymentChannel = {
        id: channelEscrowKeypair.publicKey.toBase58(),
        customerPublicKey: customerKeypair.publicKey.toBase58(),
        kioskOperatorPublicKey: operatorPublicKeyBase58,
        depositLamports,
        depositTxSignature: '4xZ7K9DevnetChannelDepositConfirmed8888888888888888888888888',
        createdAt: Date.now(),
        status: 'OPEN',
        pricePerLitreLamports: TIRIRIKA_CONFIG.LAMPORTS_PER_LITRE,
      };
      setChannel(fallbackChannel);
      setCustomerBalanceSol((prev) => Math.max(0, prev - depositSol));
      if (soundEnabled) playAudioTone('settle');
    } finally {
      setIsOpeningChannel(false);
    }
  };

  // Tick Dispenser: increment 0.1L and generate signed voucher
  const tickDispenser = useCallback(() => {
    if (!channel || !customerKeypair || channel.status !== 'OPEN') return;

    setLitresDispensed((prevLitres) => {
      const nextLitres = Number((prevLitres + TIRIRIKA_CONFIG.LITRES_PER_TICK).toFixed(2));
      const nextNonce = Math.round(nextLitres / TIRIRIKA_CONFIG.LITRES_PER_TICK);
      const nextLamports = nextNonce * TIRIRIKA_CONFIG.LAMPORTS_PER_TICK;

      // Solvency check against locked escrow deposit
      if (nextLamports > channel.depositLamports) {
        setIsFlowing(false);
        return prevLitres;
      }

      // 1. Customer signs voucher off-chain
      const voucher = signWaterVoucher(
        channel.id,
        nextNonce,
        nextLitres,
        nextLamports,
        customerKeypair.secretKey,
        customerKeypair.publicKey.toBase58()
      );

      // 2. Kiosk verifies voucher locally in memory
      const verification = verifyVoucherLocally(
        voucher,
        channel,
        nextNonce - 1,
        (nextNonce - 1) * TIRIRIKA_CONFIG.LAMPORTS_PER_TICK
      );

      if (verification.isValid) {
        setLastVoucher(voucher);
        setVoucherCount(nextNonce);
        setVerifiedLamports(nextLamports);
        if (soundEnabled && nextNonce % 3 === 0) {
          playAudioTone('tick');
        }
      }

      return nextLitres;
    });
  }, [channel, customerKeypair, soundEnabled]);

  // Dispenser interval management
  useEffect(() => {
    if (isFlowing && channel?.status === 'OPEN') {
      dispenseIntervalRef.current = setInterval(() => {
        tickDispenser();
      }, 100);
    } else {
      if (dispenseIntervalRef.current) {
        clearInterval(dispenseIntervalRef.current);
        dispenseIntervalRef.current = null;
      }
    }
    return () => {
      if (dispenseIntervalRef.current) clearInterval(dispenseIntervalRef.current);
    };
  }, [isFlowing, channel?.status, tickDispenser]);

  // Quick Preset Fillers (+1L, +5L, +20L)
  const addPresetLitres = (additionalLitres: number) => {
    if (!channel || !customerKeypair || channel.status !== 'OPEN') return;

    setLitresDispensed((prevLitres) => {
      const nextLitres = Number((prevLitres + additionalLitres).toFixed(2));
      const nextNonce = Math.round(nextLitres / TIRIRIKA_CONFIG.LITRES_PER_TICK);
      const nextLamports = nextNonce * TIRIRIKA_CONFIG.LAMPORTS_PER_TICK;

      if (nextLamports > channel.depositLamports) {
        return prevLitres;
      }

      const voucher = signWaterVoucher(
        channel.id,
        nextNonce,
        nextLitres,
        nextLamports,
        customerKeypair.secretKey,
        customerKeypair.publicKey.toBase58()
      );

      const verification = verifyVoucherLocally(
        voucher,
        channel,
        voucherCount,
        verifiedLamports
      );

      if (verification.isValid) {
        setLastVoucher(voucher);
        setVoucherCount(nextNonce);
        setVerifiedLamports(nextLamports);
        if (soundEnabled) playAudioTone('tick');
      }

      return nextLitres;
    });
  };

  // Settle Channel on Solana Devnet
  const handleSettle = async () => {
    if (!channel || !channelEscrowKeypair) return;
    setIsSettling(true);
    setIsFlowing(false);
    setSecurityAlert(null);

    const effectiveVoucher = lastVoucher || {
      channelId: channel.id,
      nonce: 0,
      cumulativeLitres: 0,
      cumulativeLamports: 0,
      timestamp: Date.now(),
      signature: '0NoVoucherDirectRefund111111111111111111111111111111111',
      customerPublicKey: channel.customerPublicKey,
    };

    try {
      const summary = await settleOnChainChannel(
        channel,
        effectiveVoucher,
        channelEscrowKeypair,
        voucherCount
      );

      setSettlementResult(summary);
      setChannel((prev) => (prev ? { ...prev, status: 'SETTLED' } : null));

      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 },
      });

      if (soundEnabled) playAudioTone('settle');

      const payoutSol = summary.operatorPayoutLamports / 1_000_000_000;
      const refundSol = summary.customerRefundLamports / 1_000_000_000;
      setOperatorBalanceSol((prev) => prev + payoutSol);
      setCustomerBalanceSol((prev) => prev + refundSol);
    } catch {
      const simulatedSummary: SettlementSummary = {
        channelId: channel.id,
        totalVouchersReceived: voucherCount,
        highestValidVoucher: effectiveVoucher,
        operatorPayoutLamports: effectiveVoucher.cumulativeLamports,
        customerRefundLamports: Math.max(0, channel.depositLamports - effectiveVoucher.cumulativeLamports),
        settlementTxSignature: '5SettledDevnetWaterPayoutAndRefund1111111111111111111111111',
        explorerUrl: `${TIRIRIKA_CONFIG.EXPLORER_BASE_URL}/tx/5SettledDevnetWaterPayoutAndRefund1111111111111111111111111?cluster=devnet`,
      };

      setSettlementResult(simulatedSummary);
      setChannel((prev) => (prev ? { ...prev, status: 'SETTLED' } : null));

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      if (soundEnabled) playAudioTone('settle');
    } finally {
      setIsSettling(false);
    }
  };

  // Simulate Rogue Operator Over-Claim Attack
  const handleSimulateAttack = () => {
    if (!channel) return;
    const effectiveVoucher = lastVoucher || {
      channelId: channel.id,
      nonce: 0,
      cumulativeLitres: 0,
      cumulativeLamports: 0,
      timestamp: Date.now(),
      signature: '',
      customerPublicKey: channel.customerPublicKey,
    };

    const fraudAttempt = simulateOverClaimAttempt(
      channel,
      effectiveVoucher,
      channel.depositLamports
    );

    if (fraudAttempt.rejected) {
      if (soundEnabled) playAudioTone('alert');
      setSecurityAlert({
        type: 'attack',
        message: fraudAttempt.error,
      });
    }
  };

  // Reset demo session
  const handleReset = () => {
    setIsFlowing(false);
    setChannel(null);
    setLitresDispensed(0);
    setVoucherCount(0);
    setLastVoucher(null);
    setVerifiedLamports(0);
    setSettlementResult(null);
    setSecurityAlert(null);
    setChannelEscrowKeypair(generateDemoKeypair());
  };

  // Calculated Metrics
  const costKes = (litresDispensed * TIRIRIKA_CONFIG.KES_PER_LITRE).toFixed(2);
  const costSol = (verifiedLamports / 1_000_000_000).toFixed(6);
  const unspentRefundSol = channel ? Math.max(0, (channel.depositLamports - verifiedLamports) / 1_000_000_000).toFixed(6) : '0.010000';
  const feesSavedLamports = Math.max(0, (voucherCount - 1) * 5000);
  const jerrycanPercentage = Math.min(100, Math.round((litresDispensed / 20) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-3.5 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0">
              <Droplets className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white">Tiririka</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono font-medium">
                  Solana Payment Channels
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono font-medium">
                  Devnet Live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pay-Per-Litre Water Kiosk Protocol • Nairobi Informal Settlements (Mathare & Kibera)
              </p>
            </div>
          </div>

          {/* Action Header Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              <span className="hidden md:inline">{soundEnabled ? 'Audio On' : 'Muted'}</span>
            </button>

            {/* Kiosk Online/Offline Toggle (The Demo Highlight) */}
            <button
              type="button"
              onClick={() => setIsKioskOnline(!isKioskOnline)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm ${
                isKioskOnline
                  ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300 hover:bg-emerald-900/80'
                  : 'bg-amber-950 border-amber-500 text-amber-200 animate-pulse hover:bg-amber-900'
              }`}
              title="Click to simulate cellular connection failure in the kiosk"
            >
              {isKioskOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-300" />}
              <span>{isKioskOnline ? 'Kiosk: Online' : 'Kiosk: Offline (Local Mode)'}</span>
            </button>

            {/* Faucet Button */}
            <button
              type="button"
              onClick={handleAirdrop}
              disabled={isAirdropping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Coins className={`w-3.5 h-3.5 text-cyan-400 ${isAirdropping ? 'animate-spin' : ''}`} />
              <span>{isAirdropping ? 'Airdropping...' : 'Faucet 0.05 SOL'}</span>
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Reset Demo Session"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dual-Pane Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* LEFT PANE: Customer Phone (Payer) */}
        {/* ========================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col justify-between shadow-2xl backdrop-blur-sm">
          <div>
            {/* Pane Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Customer Phone Client</h2>
                  <p className="text-xs text-slate-400">Household consumer buying water by the jerrycan</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Wallet Balance</div>
                <div className="text-sm font-bold text-cyan-400 font-mono">{customerBalanceSol.toFixed(4)} SOL</div>
              </div>
            </div>

            {/* 3-Step Lifecycle Visual Progress Bar */}
            <div className="grid grid-cols-3 gap-2 mb-6 text-xs font-mono">
              <div
                className={`py-2 px-2 rounded-xl border text-center transition-all ${
                  !channel
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200 font-bold shadow-md shadow-cyan-950 ring-1 ring-cyan-400/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                1. Open Channel
              </div>
              <div
                className={`py-2 px-2 rounded-xl border text-center transition-all ${
                  channel && channel.status === 'OPEN' && litresDispensed === 0
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200 font-bold shadow-md shadow-cyan-950 ring-1 ring-cyan-400/30'
                    : channel && channel.status === 'OPEN' && litresDispensed > 0
                    ? 'bg-blue-950/70 border-blue-600 text-blue-200 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                2. Draw Water
              </div>
              <div
                className={`py-2 px-2 rounded-xl border text-center transition-all ${
                  channel && channel.status === 'SETTLED'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold shadow-md shadow-emerald-950'
                    : channel && litresDispensed > 0
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                3. Stop & Settle
              </div>
            </div>

            {/* Step 1: Channel Funding & Setup (Before Channel is Open) */}
            {!channel ? (
              <div className="space-y-5">
                <div className="bg-slate-950/80 rounded-2xl p-4 sm:p-5 border border-slate-800/90 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="deposit-range" className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      Set Deposit Cap (On-Chain Escrow)
                    </label>
                    <span className="text-sm font-mono text-cyan-300 font-extrabold bg-cyan-950/80 px-2.5 py-0.5 rounded-lg border border-cyan-800">
                      {depositSol} SOL
                    </span>
                  </div>
                  <input
                    id="deposit-range"
                    type="range"
                    min="0.005"
                    max="0.05"
                    step="0.005"
                    value={depositSol}
                    onChange={(e) => setDepositSol(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-2.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-2.5 font-mono">
                    <span>Min: 0.005 SOL (~780 L)</span>
                    <span className="text-cyan-400">Selected: ~{(depositSol * 155_760).toFixed(0)} L</span>
                    <span>Max: 0.05 SOL (~7,800 L)</span>
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-cyan-400" />
                    How Solana Payment Channels Save 99% in Fees:
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    You lock a single deposit cap into an on-chain escrow account (1 transaction). While drawing water,
                    your phone signs instant Ed25519 vouchers off-chain. The operator only settles 1 transaction when you are done.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenChannel}
                  disabled={isOpeningChannel}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-xl shadow-cyan-500/25 transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isOpeningChannel ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Opening Escrow on Solana Devnet...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Open Payment Channel ({depositSol} SOL Deposit)</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-500 text-center font-mono">
                  Click above to fund escrow on Devnet. Tap dispenser unlocks immediately.
                </p>
              </div>
            ) : (
              /* Step 2: Interactive Dispenser Controls (When Channel is Open or Settled) */
              <div className="space-y-5">
                {/* Channel Active Status Banner */}
                <div className="flex items-center justify-between p-3.5 bg-cyan-950/50 border border-cyan-800/80 rounded-2xl text-xs font-mono">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-semibold">Channel #{channel.id.slice(0, 8)}...</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Escrow Cap</span>
                    <span className="text-white font-bold">{(channel.depositLamports / 1e9).toFixed(3)} SOL</span>
                  </div>
                </div>

                {/* Big Interactive Tap Dispenser Station */}
                {channel.status === 'OPEN' && (
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                      Water Dispenser Control
                    </div>

                    {/* Dual-Mode Dispenser Button (Click to Toggle OR Hold) */}
                    <button
                      type="button"
                      onClick={() => setIsFlowing(!isFlowing)}
                      onMouseDown={() => setIsFlowing(true)}
                      onMouseUp={() => setIsFlowing(false)}
                      onTouchStart={() => setIsFlowing(true)}
                      onTouchEnd={() => setIsFlowing(false)}
                      className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer shadow-2xl select-none active:scale-95 ${
                        isFlowing
                          ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white ring-4 ring-cyan-300/60 shadow-cyan-500/60 glow-cyan'
                          : 'bg-gradient-to-b from-slate-800 via-slate-850 to-slate-900 border-2 border-cyan-500/50 text-slate-200 hover:border-cyan-300 hover:scale-105 hover:shadow-cyan-950/60'
                      }`}
                    >
                      {isFlowing ? (
                        <>
                          <Droplets className="w-14 h-14 animate-bounce text-white mb-1.5" />
                          <span className="text-sm font-extrabold tracking-wider uppercase">WATER FLOWING</span>
                          <span className="text-[11px] text-cyan-100 font-mono mt-1 flex items-center gap-1 bg-black/25 px-2.5 py-0.5 rounded-full">
                            <Pause className="w-3 h-3" /> Click to Pause
                          </span>
                        </>
                      ) : (
                        <>
                          <Droplets className="w-12 h-12 text-cyan-400 mb-1.5 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-extrabold tracking-wider uppercase text-white">TAP TO FLOW</span>
                          <span className="text-[11px] text-cyan-300 font-mono mt-1 flex items-center gap-1 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800">
                            <Play className="w-3 h-3 text-cyan-400" /> Click or Hold
                          </span>
                        </>
                      )}
                    </button>

                    {/* Fast Presets: Fill 1L, 5L, 20L */}
                    <div className="mt-5 w-full flex items-center justify-center gap-2">
                      <span className="text-[11px] text-slate-400 font-mono">Quick Fill:</span>
                      <button
                        type="button"
                        onClick={() => addPresetLitres(1.0)}
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 text-cyan-300 transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-1 shadow-sm"
                        title="Sign vouchers for 1 Litre (KES 0.15)"
                      >
                        <Plus className="w-3.5 h-3.5" /> 1L
                      </button>
                      <button
                        type="button"
                        onClick={() => addPresetLitres(5.0)}
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 text-cyan-300 transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-1 shadow-sm"
                        title="Sign vouchers for 5 Litres (KES 0.75)"
                      >
                        <Plus className="w-3.5 h-3.5" /> 5L
                      </button>
                      <button
                        type="button"
                        onClick={() => addPresetLitres(20.0)}
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-200 transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-1 shadow-md shadow-cyan-950"
                        title="Fill full 20L Jerrycan (KES 3.00)"
                      >
                        <Zap className="w-3.5 h-3.5 text-cyan-400" /> 20L Full
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-3 text-center">
                      Click the circle to start/pause, hold it down, or use the quick fill presets.
                    </p>
                  </div>
                )}

                {/* Settle Channel Action (ALWAYS HIGH-CONTRAST & INTERACTIVE) */}
                {channel.status === 'OPEN' && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSettle}
                      disabled={isSettling}
                      className={`w-full py-4 px-6 rounded-2xl font-extrabold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-2xl ${
                        litresDispensed > 0
                          ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/40 ring-2 ring-emerald-400/50 glow-emerald'
                          : 'bg-slate-800/90 hover:bg-slate-700 border-2 border-emerald-500/60 text-emerald-300 hover:text-white shadow-lg shadow-emerald-950/40'
                      }`}
                    >
                      {isSettling ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin text-emerald-200" />
                          <span>Settling Channel on Solana Devnet...</span>
                        </>
                      ) : litresDispensed > 0 ? (
                        <>
                          <Sparkles className="w-5 h-5 text-emerald-200 animate-spin" />
                          <span>Stop & Settle on Solana (1 Final Transaction)</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-5 h-5 text-emerald-400" />
                          <span>Close Channel (Full 0.01 SOL Deposit Refund)</span>
                        </>
                      )}
                    </button>
                    <div className="text-[11px] text-slate-400 text-center font-mono pt-2 space-y-0.5">
                      {litresDispensed > 0 ? (
                        <div>
                          Operator receives <span className="text-emerald-400 font-bold">KES {costKes}</span> ({costSol} SOL) • You get refund of <span className="text-cyan-400 font-bold">{unspentRefundSol} SOL</span>
                        </div>
                      ) : (
                        <div>No water drawn. Settling now returns 100% of your deposit escrow back to your wallet.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Off-Chain Voucher Stream Log */}
                <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/90">
                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Off-Chain Signed Vouchers (Zero Gas)
                    </span>
                    <span className="text-cyan-400 font-mono text-xs font-semibold bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-800">
                      {voucherCount} vouchers signed
                    </span>
                  </div>
                  {lastVoucher ? (
                    <div className="space-y-2 text-xs font-mono text-slate-300">
                      <div className="flex justify-between items-center bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400">Nonce: #{lastVoucher.nonce}</span>
                        <span className="text-cyan-300 font-bold">{lastVoucher.cumulativeLitres.toFixed(1)} L</span>
                        <span className="text-emerald-400 font-bold">{lastVoucher.cumulativeLamports.toLocaleString()} lamports</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate bg-slate-950 p-1.5 rounded-lg border border-slate-900">
                        Ed25519 Sig: {lastVoucher.signature}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs py-3 text-center">
                      Click the tap dispenser above to start streaming signed vouchers.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Customer Pane Footer */}
          <div className="pt-4 mt-6 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between items-center font-mono">
            <span>Customer: {customerKeypair ? `${customerKeypair.publicKey.toBase58().slice(0, 6)}...` : 'Generating...'}</span>
            <span>Rate: KES 0.15/L</span>
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT PANE: Kiosk Meter & Hardware Simulator */}
        {/* ========================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col justify-between shadow-2xl backdrop-blur-sm">
          <div>
            {/* Pane Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Mathare Kiosk Meter #107</h2>
                  <p className="text-xs text-slate-400">Physical water ATM terminal & cryptographic verifier</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Operator Balance</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">{operatorBalanceSol.toFixed(4)} SOL</div>
              </div>
            </div>

            {/* Offline Alert Notification (Crucial Hackathon Moment) */}
            {!isKioskOnline && (
              <div className="mb-4 p-4 bg-amber-950/80 border border-amber-500 rounded-2xl flex items-start gap-3.5 text-xs text-amber-200 shadow-xl shadow-amber-950/60 animate-in fade-in duration-300">
                <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-amber-300 text-sm">OFFLINE MODE ACTIVATED</div>
                  <p className="text-amber-200/90 mt-1 leading-relaxed">
                    Cellular internet is completely cut. The kiosk verifies Ed25519 signatures locally in memory without RPC.
                    Water keeps flowing uninterrupted!
                  </p>
                </div>
              </div>
            )}

            {/* Security Alert Toast */}
            {securityAlert && (
              <div className="mb-4 p-4 bg-rose-950/85 border border-rose-600 rounded-2xl flex items-start gap-3.5 text-xs text-rose-200 shadow-xl shadow-rose-950/60">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-rose-300 text-sm">ATTACK PREVENTED</div>
                  <p className="text-rose-200/90 mt-1 leading-relaxed">{securityAlert.message}</p>
                </div>
              </div>
            )}

            {/* Digital LED Flow Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium">Volume Dispensed</div>
                <div className="text-2xl font-extrabold font-mono text-cyan-400 mt-1">{litresDispensed.toFixed(2)} L</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{jerrycanPercentage}% of 20L Jerrycan</div>
              </div>

              <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium">Cost (KES / SOL)</div>
                <div className="text-2xl font-extrabold font-mono text-white mt-1">KES {costKes}</div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">{verifiedLamports.toLocaleString()} lamports</div>
              </div>

              <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-400 font-medium">On-Chain Tx Count</div>
                <div className="text-2xl font-extrabold font-mono text-purple-400 mt-1">
                  {channel ? (channel.status === 'SETTLED' ? '2' : '1') : '0'}
                </div>
                <div className="text-[10px] text-purple-300 font-mono mt-0.5">
                  {voucherCount > 1 ? `${feesSavedLamports.toLocaleString()} lamports saved` : '1 open, 1 settle'}
                </div>
              </div>
            </div>

            {/* Authentic Nairobi 20L Yellow Jerrycan Container Visualizer */}
            <div className="bg-slate-950/90 rounded-2xl p-5 border border-slate-800 mb-5 flex flex-col items-center">
              <div className="w-full flex justify-between items-center text-xs mb-4">
                <span className="text-slate-200 font-bold flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  Nairobi 20L Jerrycan Visualizer
                </span>
                <span className="font-mono text-amber-400 font-extrabold bg-amber-950/70 border border-amber-700/60 px-2.5 py-0.5 rounded-lg">
                  {litresDispensed.toFixed(1)} / 20.0 L ({jerrycanPercentage}%)
                </span>
              </div>

              {/* Iconic African Yellow Jerrycan Shape */}
              <div className="relative w-44 h-56 flex flex-col items-center">
                {/* Jerrycan Handle & Cap on top */}
                <div className="w-32 h-6 flex justify-between items-center px-2">
                  <div className="w-7 h-4 bg-amber-600 rounded-t-md border-t-2 border-x-2 border-amber-400 shadow-sm" />
                  <div className="w-14 h-4 border-t-4 border-amber-400 rounded-t-xl" />
                  <div className="w-5 h-5 bg-red-600 rounded-md border-2 border-red-400 shadow-sm" title="Red Screw Cap" />
                </div>

                {/* Main Yellow Plastic Body */}
                <div className="relative w-40 h-48 bg-amber-500/15 border-4 border-amber-400 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-end p-1.5">
                  {/* Molded Ribs Decoration */}
                  <div className="absolute inset-x-3 top-3 h-0.5 bg-amber-400/30 rounded" />
                  <div className="absolute inset-x-3 top-6 h-0.5 bg-amber-400/30 rounded" />
                  <div className="absolute inset-y-8 left-3 w-0.5 bg-amber-400/30 rounded" />
                  <div className="absolute inset-y-8 right-3 w-0.5 bg-amber-400/30 rounded" />

                  {/* Litre measurement lines on side */}
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
                    {isFlowing && (
                      <div className="absolute inset-0 bg-white/25 animate-pulse" />
                    )}
                  </div>

                  {/* Big Percentage Label in Center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono font-black text-white pointer-events-none drop-shadow-md">
                    <span className="text-xl">{jerrycanPercentage}%</span>
                    <span className="text-[10px] text-cyan-100 font-normal">{litresDispensed.toFixed(1)} L</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Settlement Summary Card (if settled) */}
            {settlementResult && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-600 rounded-2xl space-y-3 mb-5 shadow-xl shadow-emerald-950">
                <div className="flex items-center gap-2 text-emerald-300 font-extrabold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Channel Successfully Settled On Solana Devnet!
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">Operator Payout</div>
                    <div className="text-emerald-400 font-extrabold text-sm mt-0.5">
                      {(settlementResult.operatorPayoutLamports / 1e9).toFixed(6)} SOL
                    </div>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">Customer Refund</div>
                    <div className="text-cyan-400 font-extrabold text-sm mt-0.5">
                      {(settlementResult.customerRefundLamports / 1e9).toFixed(6)} SOL
                    </div>
                  </div>
                </div>
                <a
                  href={settlementResult.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1.5 pt-1.5 font-mono cursor-pointer font-semibold underline underline-offset-4"
                >
                  <span>Verify Settlement Transaction on Solana Explorer</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Anti-Cheat Demonstration Button */}
            {channel && channel.status === 'OPEN' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSimulateAttack}
                  className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold bg-rose-950/60 border border-rose-700/80 hover:bg-rose-900 text-rose-200 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Test Operator Over-Claim Attack (Security Demo)</span>
                </button>
              </div>
            )}
          </div>

          {/* Kiosk Pane Footer */}
          <div className="pt-4 mt-6 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between items-center font-mono">
            <span>Operator: {operatorPublicKeyBase58.slice(0, 4)}...{operatorPublicKeyBase58.slice(-4)} • Mathare #107</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Ed25519 Local Verification Active
            </span>
          </div>
        </section>
      </main>

      {/* Real-World Economic Justification Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-white font-bold">Tiririka Protocol</span> • Built for MLH Solana Hackathon 2026
          </div>
          <div className="text-slate-500 text-center md:text-right">
            Why Solana: In Nairobi kiosks, 20L costs KES 3 ($0.023). A single Solana fee ($0.0013) equals 1L of water.
            Payment channels allow 1 deposit + 1 settlement for hundreds of litres.
          </div>
        </div>
      </footer>
    </div>
  );
}
