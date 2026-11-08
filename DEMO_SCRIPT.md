# Tiririka — 2-Minute Hackathon Demo Script (Word-for-Word)

> **Target Recording Time:** Exactly 1 minute 50 seconds to 1 minute 55 seconds (strictly $\le$ 2:00 minutes).  
> **Production URL:** [https://tiririka.vercel.app/](https://tiririka.vercel.app/)  
> **Camera / Audio:** Screen recording with Prince's microphone audio. Show browser tab maximized.  
> **Tone:** Confident, energetic, engineering-focused.

---

### Step 1: The Hook & Real-World Problem (0:00 – 0:18)
* **On Screen:** Browser open at [https://tiririka.vercel.app/](https://tiririka.vercel.app/). Dual-pane interface visible (Customer Client on left, Mathare Kiosk Meter on right).
* **What you say:**
  > *"Hi everyone, I'm Prince Nzamuwe, and this is Tiririka for the MLH Solana Hackathon.  
  > In Nairobi informal settlements like Mathare and Kibera, 20 litres of clean water costs 3 Kenya Shillings—that's just 0.15 shillings per single litre.  
  > But a standard Solana transaction fee is about 0.20 shillings. If a household tried to pay on-chain for each litre drawn from a community tap, blockchain transaction fees would exceed 100% of the cost of the water itself.  
  > Tiririka solves this dilemma using high-frequency Solana Payment Channels with local offline verification."*

---

### Step 2: Open Channel Escrow (0:18 – 0:35)
* **On Screen:** Click the cyan button: **`Open Payment Channel (0.01 SOL Deposit)`**.
* **What you say:**
  > *"Here on the left is the customer's mobile client. To start, the consumer opens a payment channel by locking a small 0.01 SOL deposit into an on-chain escrow vault on Solana Devnet.  
  > That is exactly one on-chain transaction. Once confirmed in under 200 milliseconds, the channel opens, granting the customer up to 1,500 litres of drawing capacity."*

---

### Step 3: Stream Micropayments Live (0:35 – 0:55)
* **On Screen:** Click the big circular button **`TAP TO FLOW`**. Notice the wave animation, audio flow, pulse counter ticking, and vouchers signing. Then click **`5L`** quick fill, then click **`TAP TO FLOW`** to pause.
* **What you say:**
  > *"Now watch the water meter. When I click Tap to Flow, water starts streaming into the 20-litre jerrycan.  
  > For every 0.1 litres dispensed, the customer's phone cryptographically signs a cumulative Ed25519 payment voucher off-chain.  
  > Look at the on-chain transaction counter on the right: it stays strictly at 1. We have streamed dozens of micropayments without touching the blockchain or paying gas fees for each tick. We can also click quick presets like 5 litres, and the container automatically clamps at 20 litres."*

---

### Step 4: The Cellular Internet Blackout (0:55 – 1:15)
* **On Screen:** Click the green top badge: **`Kiosk: Online`**. It turns amber: **`Kiosk: Offline (Local Mode)`**. Then click **`TAP TO FLOW`** again—water keeps flowing smoothly!
* **What you say:**
  > *"Now here is the critical breakthrough for African community infrastructure: cellular connectivity in informal settlements frequently blacks out.  
  > I toggle the kiosk offline. Cellular internet is completely severed. But when I tap to dispense water, it keeps flowing uninterrupted.  
  > The kiosk validates each digital Ed25519 signature and state constraint locally in memory in under one millisecond. The family gets clean water even during total cellular network blackouts."*

---

### Step 5: Cryptographic Threat Lab Defense (1:15 – 1:35)
* **On Screen:** Scroll down slightly to the **`CRYPTOGRAPHIC THREAT LAB`**. Click tab **`3. Data Tampering`**, then click **`Test Threat Defense: Data Tampering Attack`**. Green alert appears: `ATTACK PREVENTED`.
* **What you say:**
  > *"What prevents a bad actor from altering vouchers or stealing deposits?  
  > In our Cryptographic Threat Lab, let's launch a payload tampering attack where payment data is manipulated in transit.  
  > The attack is thwarted instantly in zero milliseconds: the kiosk detects the signature mismatch, keeps the physical valve shut, and protects 100% of customer funds without contacting an RPC server."*

---

### Step 6: Stop & Settle on Solana Devnet (1:35 – 1:52)
* **On Screen:** Click **`Stop & Settle on Solana (1 Final Transaction)`**. Confetti bursts! Settlement receipt shows earned lamports, customer refund, and gas savings. Then hover over **`Start Next Water Fill (New Customer Session)`**.
* **What you say:**
  > *"When the customer finishes drawing water, we click Stop & Settle.  
  > The kiosk submits the highest signed voucher to Solana Devnet in a single final transaction.  
  > The operator receives payment for exactly what was drawn, and the unspent deposit is automatically refunded back to the consumer.  
  > We saved 99.8% in fees, avoided proprietary prepaid cards, and in one click, the terminal is ready for the next customer in line."*

---

### Step 7: Wrap-up & Track Eligibility (1:52 – 1:55)
* **On Screen:** Show the GitHub repo or top of page showing the verified Devnet operator address and MIT license.
* **What you say:**
  > *"Tiririka is completely open source under MIT. We are submitting for Top 3 Overall Hacks, the DeFi Track, and Best Beginner Hack. Thank you!"*

---

### Pre-Recording Checklist for Prince:
1. Open [https://tiririka.vercel.app/](https://tiririka.vercel.app/) in Chrome or Brave.
2. Press `F11` (or maximize window) to hide bookmark clutter.
3. Make sure sound is unmuted (you'll hear the gentle water audio effect when tapping flow).
4. Run 1 dry run test following the steps above before pressing record.
5. Use OBS, Loom, or Windows Game Bar (`Win + Alt + R`) to record.
6. Check final video length: must be **under 2 minutes (120 seconds)**.
