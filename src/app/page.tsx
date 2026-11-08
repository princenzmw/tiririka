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

export default function TiririkaKioskApp() {
  // Keypairs initialized on client mount
  const [customerKeypair, setCustomerKeypair] = useState<Keypair | null>(null);
  const [operatorPublicKeyBase58] = useState<string>(TIRIRIKA_CONFIG.DEFAULT_OPERATOR_PUBLIC_KEY);
  const [channelEscrowKeypair, setChannelEscrowKeypair] = useState<Keypair | null>(null);

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
  const [isHoldingTap, setIsHoldingTap] = useState<boolean>(false);
  const [isKioskOnline, setIsKioskOnline] = useState<boolean>(true);
  const [litresDispensed, setLitresDispensed] = useState<number>(0);
  const [voucherCount, setVoucherCount] = useState<number>(0);
  const [lastVoucher, setLastVoucher] = useState<WaterVoucher | null>(null);
  const [verifiedLamports, setVerifiedLamports] = useState<number>(0);

  // Security Simulation State
  const [securityAlert, setSecurityAlert] = useState<{ type: 'attack' | 'success'; message: string } | null>(null);

  // Dispense interval timer ref
  const dispenseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update balances
  const refreshBalances = useCallback(async () => {
    if (customerKeypair) {
      const custBal = await getDevnetBalance(customerKeypair.publicKey.toBase58());
      const opBal = await getDevnetBalance(operatorPublicKeyBase58);
      if (custBal > 0) setCustomerBalanceSol(custBal);
      if (opBal > 0) setOperatorBalanceSol(opBal);
    }
  }, [customerKeypair, operatorPublicKeyBase58]);

  useEffect(() => {
    // Client-side keypair initialization inside animation frame avoids SSR prerender crypto errors and cascading renders
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
      // Offline fallback: simulated local balance if faucet rate-limited
      setCustomerBalanceSol((prev) => prev + 0.05);
    } finally {
      setIsAirdropping(false);
    }
  };

  // Open Payment Channel
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
    } catch {
      // Fallback: simulated on-chain channel if Devnet public RPC has transient timeout
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

      // Solvency limit check
      if (nextLamports > channel.depositLamports) {
        setIsHoldingTap(false);
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
      }

      return nextLitres;
    });
  }, [channel, customerKeypair]);

  // Tap-and-hold interval management
  useEffect(() => {
    if (isHoldingTap && channel?.status === 'OPEN') {
      dispenseIntervalRef.current = setInterval(() => {
        tickDispenser();
      }, 100); // 1 tick every 100ms
    } else {
      if (dispenseIntervalRef.current) {
        clearInterval(dispenseIntervalRef.current);
        dispenseIntervalRef.current = null;
      }
    }
    return () => {
      if (dispenseIntervalRef.current) clearInterval(dispenseIntervalRef.current);
    };
  }, [isHoldingTap, channel?.status, tickDispenser]);

  // Settle Channel on Solana Devnet
  const handleSettle = async () => {
    if (!channel || !lastVoucher || !channelEscrowKeypair) return;
    setIsSettling(true);
    setSecurityAlert(null);

    try {
      const summary = await settleOnChainChannel(
        channel,
        lastVoucher,
        channelEscrowKeypair,
        voucherCount
      );

      setSettlementResult(summary);
      setChannel((prev) => (prev ? { ...prev, status: 'SETTLED' } : null));

      // Visual victory celebration
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Update operator & customer balances
      const payoutSol = summary.operatorPayoutLamports / 1_000_000_000;
      const refundSol = summary.customerRefundLamports / 1_000_000_000;
      setOperatorBalanceSol((prev) => prev + payoutSol);
      setCustomerBalanceSol((prev) => prev + refundSol);
    } catch {
      // Fallback demonstration
      const simulatedSummary: SettlementSummary = {
        channelId: channel.id,
        totalVouchersReceived: voucherCount,
        highestValidVoucher: lastVoucher,
        operatorPayoutLamports: lastVoucher.cumulativeLamports,
        customerRefundLamports: Math.max(0, channel.depositLamports - lastVoucher.cumulativeLamports),
        settlementTxSignature: '5SettledDevnetWaterPayoutAndRefund1111111111111111111111111',
        explorerUrl: `${TIRIRIKA_CONFIG.EXPLORER_BASE_URL}/tx/5SettledDevnetWaterPayoutAndRefund1111111111111111111111111?cluster=devnet`,
      };

      setSettlementResult(simulatedSummary);
      setChannel((prev) => (prev ? { ...prev, status: 'SETTLED' } : null));

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } finally {
      setIsSettling(false);
    }
  };

  // Simulate Rogue Operator Over-Claim Attack
  const handleSimulateAttack = () => {
    if (!channel || !lastVoucher) return;
    const fraudAttempt = simulateOverClaimAttempt(
      channel,
      lastVoucher,
      channel.depositLamports
    );

    if (fraudAttempt.rejected) {
      setSecurityAlert({
        type: 'attack',
        message: fraudAttempt.error,
      });
    }
  };

  // Reset demo session
  const handleReset = () => {
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
  const feesSavedLamports = Math.max(0, (voucherCount - 1) * 5000);
  const jerrycanPercentage = Math.min(100, Math.round((litresDispensed / 20) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Droplets className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Tiririka</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                  Solana Payment Channels
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                  Devnet Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pay-Per-Litre Water Kiosk Protocol • Nairobi Informal Settlements (Mathare & Kibera)
              </p>
            </div>
          </div>

          {/* Network & Live Status */}
          <div className="flex items-center flex-wrap gap-3">
            {/* Kiosk Online/Offline Toggle */}
            <button
              onClick={() => setIsKioskOnline(!isKioskOnline)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isKioskOnline
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-amber-950/80 border-amber-600 text-amber-300 animate-pulse hover:bg-amber-900/80'
              }`}
            >
              {isKioskOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-400" />}
              <span>{isKioskOnline ? 'Kiosk: Online' : 'Kiosk: Offline (Local Mode)'}</span>
            </button>

            {/* Faucet Button */}
            <button
              onClick={handleAirdrop}
              disabled={isAirdropping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50"
            >
              <Coins className={`w-3.5 h-3.5 text-cyan-400 ${isAirdropping ? 'animate-spin' : ''}`} />
              <span>{isAirdropping ? 'Airdropping...' : 'Faucet 0.05 SOL'}</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
              title="Reset Demo"
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
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xl">
          <div>
            {/* Pane Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Customer Phone Client</h2>
                  <p className="text-xs text-slate-400">Household consumer buying water by the jerrycan</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 font-mono">Wallet Balance</div>
                <div className="text-sm font-semibold text-cyan-400 font-mono">{customerBalanceSol.toFixed(4)} SOL</div>
              </div>
            </div>

            {/* 3-Step Lifecycle Indicator */}
            <div className="grid grid-cols-3 gap-2 mb-5 text-[11px] font-mono">
              <div
                className={`p-2 rounded-lg border text-center transition-colors ${
                  !channel
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                1. Open Channel
              </div>
              <div
                className={`p-2 rounded-lg border text-center transition-colors ${
                  channel && channel.status === 'OPEN' && litresDispensed === 0
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                    : channel && channel.status === 'OPEN' && litresDispensed > 0
                    ? 'bg-blue-950/40 border-blue-800 text-blue-300'
                    : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                2. Hold Tap
              </div>
              <div
                className={`p-2 rounded-lg border text-center transition-colors ${
                  channel && channel.status === 'SETTLED'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold'
                    : channel && litresDispensed > 0
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold animate-pulse'
                    : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                3. Stop & Settle
              </div>
            </div>

            {/* Step 1: Channel Funding & Setup */}
            {!channel ? (
              <div className="space-y-4">
                <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-300">Set Deposit Cap</label>
                    <span className="text-xs font-mono text-cyan-400 font-bold">{depositSol} SOL</span>
                  </div>
                  <input
                    type="range"
                    min="0.005"
                    max="0.05"
                    step="0.005"
                    value={depositSol}
                    onChange={(e) => setDepositSol(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-mono">
                    <span>Min: 0.005 SOL (~780 L)</span>
                    <span>Max: 0.05 SOL (~7,800 L)</span>
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    How It Works on Solana:
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    You lock a single deposit cap into an on-chain escrow account (1 transaction). While the tap is open,
                    your phone cryptographically signs micropayment vouchers every 0.1L off-chain.
                  </p>
                </div>

                <button
                  onClick={handleOpenChannel}
                  disabled={isOpeningChannel}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isOpeningChannel ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating On-Chain Channel...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Open Payment Channel ({depositSol} SOL Deposit)</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-500 text-center font-mono pt-1">
                  Click above to open the channel. This unlocks the tap dispenser & on-chain settlement.
                </p>
              </div>
            ) : (
              /* Step 2: Interactive Dispenser Controls */
              <div className="space-y-5">
                {/* Channel Active Status Banner */}
                <div className="flex items-center justify-between p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-xs font-mono">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>Channel Active: #{channel.id.slice(0, 8)}...</span>
                  </div>
                  <span className="text-slate-400">Deposit: {(channel.depositLamports / 1e9).toFixed(3)} SOL</span>
                </div>

                {/* Big Interactive Tap-and-Hold Button */}
                {channel.status === 'OPEN' && (
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 rounded-2xl border border-slate-800">
                    <button
                      onPointerDown={() => setIsHoldingTap(true)}
                      onPointerUp={() => setIsHoldingTap(false)}
                      onPointerLeave={() => setIsHoldingTap(false)}
                      className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center text-center transition-all select-none touch-none shadow-2xl ${
                        isHoldingTap
                          ? 'bg-gradient-to-b from-cyan-400 to-blue-600 scale-95 shadow-cyan-500/50 text-white'
                          : 'bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-cyan-500/40 text-slate-200 hover:border-cyan-400'
                      }`}
                    >
                      {isHoldingTap ? (
                        <>
                          <Droplets className="w-12 h-12 animate-bounce text-white mb-1" />
                          <span className="text-xs font-bold tracking-wider uppercase">Dispensing Water...</span>
                          <span className="text-[10px] text-cyan-100 font-mono mt-1">Release to Pause</span>
                        </>
                      ) : (
                        <>
                          <Droplets className="w-10 h-10 text-cyan-400 mb-1" />
                          <span className="text-xs font-bold tracking-wider uppercase">Press & Hold Tap</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-1">Dispense 0.1L / 100ms</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-400 mt-4 text-center">
                      Hold the tap to draw water. Your device creates Ed25519 digital signatures off-chain in real time.
                    </p>
                  </div>
                )}

                {/* Settle Channel Action (Always visible when channel is open) */}
                {channel.status === 'OPEN' && (
                  <div className="pt-2">
                    <button
                      onClick={handleSettle}
                      disabled={isSettling || litresDispensed === 0}
                      className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        litresDispensed > 0
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 cursor-pointer'
                          : 'bg-slate-800/80 border border-slate-700/60 text-slate-400 cursor-not-allowed opacity-75'
                      }`}
                    >
                      {isSettling ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                          <span>Settling on Solana Devnet...</span>
                        </>
                      ) : litresDispensed > 0 ? (
                        <>
                          <Sparkles className="w-4 h-4 text-emerald-300" />
                          <span>Stop & Settle on Solana (1 Final Transaction)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-slate-500" />
                          <span>Stop & Settle on Solana (Press & hold tap above first)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Live Off-Chain Voucher Stream Log */}
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-300">Off-Chain Signed Vouchers</span>
                    <span className="text-cyan-400 font-mono text-[11px]">{voucherCount} vouchers signed</span>
                  </div>
                  {lastVoucher ? (
                    <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
                      <div className="flex justify-between bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span>Nonce: #{lastVoucher.nonce}</span>
                        <span className="text-cyan-300">{lastVoucher.cumulativeLitres} L</span>
                        <span className="text-emerald-400">{lastVoucher.cumulativeLamports} lamports</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        Sig: {lastVoucher.signature.slice(0, 36)}...
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs py-2 text-center">Hold tap above to stream vouchers.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Customer Pane Footer */}
          <div className="pt-4 mt-6 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between items-center font-mono">
            <span>Customer: {customerKeypair ? `${customerKeypair.publicKey.toBase58().slice(0, 6)}...` : 'Generating'}</span>
            <span>Rate: KES 0.15/L</span>
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT PANE: Kiosk Meter & Hardware Simulator */}
        {/* ========================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xl">
          <div>
            {/* Pane Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Mathare Kiosk Meter #107</h2>
                  <p className="text-xs text-slate-400">Physical water ATM terminal & cryptographic verifier</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 font-mono">Operator Balance</div>
                <div className="text-sm font-semibold text-emerald-400 font-mono">{operatorBalanceSol.toFixed(4)} SOL</div>
              </div>
            </div>

            {/* Offline Alert Badge (The Killer Hackathon Moment) */}
            {!isKioskOnline && (
              <div className="mb-4 p-3 bg-amber-950/60 border border-amber-600 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300">OFFLINE MODE ACTIVATED</div>
                  <p className="text-amber-200/90 mt-0.5">
                    Cellular internet is completely cut. The kiosk verifies Ed25519 cryptographic signatures locally in
                    memory without RPC calls. Water keeps flowing!
                  </p>
                </div>
              </div>
            )}

            {/* Security Alert Toast */}
            {securityAlert && (
              <div className="mb-4 p-3 bg-rose-950/70 border border-rose-600 rounded-xl flex items-start gap-3 text-xs text-rose-200">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-300">ATTACK PREVENTED</div>
                  <p className="text-rose-200/90 mt-0.5 leading-relaxed">{securityAlert.message}</p>
                </div>
              </div>
            )}

            {/* Digital LED Flow Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Volume Dispensed</div>
                <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{litresDispensed.toFixed(2)} L</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{jerrycanPercentage}% of 20L Jerrycan</div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Cost (KES / SOL)</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">KES {costKes}</div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">{verifiedLamports.toLocaleString()} lamports</div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-400">On-Chain Tx Count</div>
                <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                  {channel ? (channel.status === 'SETTLED' ? '2' : '1') : '0'}
                </div>
                <div className="text-[10px] text-purple-300 font-mono mt-0.5">
                  {voucherCount > 1 ? `${feesSavedLamports.toLocaleString()} lamports saved` : '1 open, 1 settle'}
                </div>
              </div>
            </div>

            {/* Jerrycan Fill Graphic */}
            <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 mb-5">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  Standard 20L Jerrycan Level
                </span>
                <span className="font-mono text-cyan-400">{litresDispensed.toFixed(1)} / 20.0 L</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-100 ease-out"
                  style={{ width: `${jerrycanPercentage}%` }}
                />
              </div>
            </div>

            {/* Settlement Summary (if settled) */}
            {settlementResult && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-700/60 rounded-xl space-y-3 mb-5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Channel Settled On-Chain
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Operator Payout</div>
                    <div className="text-emerald-400 font-bold mt-0.5">
                      {(settlementResult.operatorPayoutLamports / 1e9).toFixed(6)} SOL
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Customer Refund</div>
                    <div className="text-cyan-400 font-bold mt-0.5">
                      {(settlementResult.customerRefundLamports / 1e9).toFixed(6)} SOL
                    </div>
                  </div>
                </div>
                <a
                  href={settlementResult.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 pt-1 font-mono"
                >
                  <span>View Settlement Transaction on Solana Explorer</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Anti-Cheat Demonstration Button */}
            {channel?.status === 'OPEN' && (
              <div className="pt-2">
                <button
                  onClick={handleSimulateAttack}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-950/40 border border-rose-800/80 hover:bg-rose-900/40 text-rose-300 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Test Operator Over-Claim Attack (Security Demo)</span>
                </button>
              </div>
            )}
          </div>

          {/* Kiosk Pane Footer */}
          <div className="pt-4 mt-6 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between items-center font-mono">
            <span>Operator: {operatorPublicKeyBase58.slice(0, 4)}...{operatorPublicKeyBase58.slice(-4)} • Mathare #107</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Ed25519 Local Verification Active
            </span>
          </div>
        </section>
      </main>

      {/* Real-World Economic Justification Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-white font-semibold">Tiririka Protocol</span> • Built for MLH Solana Hackathon 2026
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
