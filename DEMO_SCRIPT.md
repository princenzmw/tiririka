# Tiririka — 2-Minute Hackathon Demo Script (Word-for-Word)
**Target Recording Time:** Exactly 1 minute 55 seconds (under the 2-minute limit).  
**Tone:** Confident, precise, engineering-focused. No marketing fluff.

---

### Step 1: The Hook (0:00 – 0:15)
* **What's on screen:** Your browser open on Tiririka (`localhost:3000` or live Vercel URL), showing the dual-pane interface.
* **What you say:**
  > *"Hi everyone, I'm Prince, and this is Tiririka for the MLH Solana Hackathon.  
  > In Nairobi's informal settlements like Mathare and Kibera, 20 litres of clean water costs 3 Kenya Shillings—about 0.15 shillings per litre. That is roughly equal to a single Solana transaction fee.  
  > If a customer tried to pay on-chain for each litre drawn from a tap, transaction fees would consume 100% of the cost. Tiririka solves this using Solana Payment Channels."*

---

### Step 2: Open Channel (0:15 – 0:35)
* **What's on screen:** Click "Open Payment Channel (0.01 SOL Deposit)".
* **What you say:**
  > *"Here on the left is the customer's phone. To start drawing water, the customer locks a single deposit cap into an on-chain escrow account on Solana Devnet.  
  > That is exactly one on-chain transaction. Once confirmed, the channel is open, giving the customer up to 1,500 litres of drawing capacity."*

---

### Step 3: Stream Micropayments (0:35 – 0:55)
* **What's on screen:** Click "TAP TO FLOW" (or "+5L" preset). Water flows, the 20L jerrycan fills with live animated wave, litres tick up, and vouchers count up off-chain.
* **What you say:**
  > *"Now watch the meter. When I click Tap to Flow, water starts streaming. For every 0.1 litres dispensed, the customer's phone cryptographically signs a cumulative Ed25519 payment voucher off-chain.  
  > Look at the transaction counter on the right: it stays strictly at 1. We've streamed dozens of micropayments without touching the blockchain or paying gas fees for each tick. We can also use quick presets like plus 5 litres."*

---

### Step 4: The Internet Blackout (0:55 – 1:15)
* **What's on screen:** Click the "Kiosk: Online" button in the top bar. It turns amber: "Kiosk: Offline (Local Mode)". Then click tap or presets again—water keeps flowing!
* **What you say:**
  > *"Now here is the critical breakthrough for African infrastructure: cellular networks frequently drop in informal settlements.  
  > I toggle the kiosk offline. Cellular internet is completely cut. But when I dispense water, it keeps flowing uninterrupted.  
  > The kiosk verifies each voucher's Ed25519 cryptographic signature locally in memory in under one millisecond. The household gets their water even during a total network blackout."*

---

### Step 5: Anti-Cheat Security Defense (1:15 – 1:35)
* **What's on screen:** In the Cryptographic Threat Lab, select "3. Data Tampering" and click "Test Threat Defense". An alert pops up showing attack blocked in plain English.
* **What you say:**
  > *"What stops an attacker or rogue terminal from tampering with vouchers or stealing deposits?  
  > In our Cryptographic Threat Lab, let's launch a payload tampering attack where payment data is altered in transit.  
  > The defense is verified in under a millisecond: the kiosk detects the signature mismatch, keeps the valve shut, and protects 100% of customer funds without needing an internet connection."*

---

### Step 6: Stop & Settle on Solana Devnet (1:35 – 1:55)
* **What's on screen:** Click "Stop & Settle on Solana". Confetti bursts! Show the settlement breakdown and click the Solana Explorer link, then highlight the "Start Next Water Fill" button.
* **What you say:**
  > *"When the customer finishes drawing water, we click Settle.  
  > This broadcasts one final settlement transaction to Solana Devnet.  
  > The operator receives payment for exactly what was drawn, and the unspent deposit is automatically refunded to the customer.  
  > Hundreds of micropayments, zero prepaid card lock-in, and only two on-chain transactions. When ready, the kiosk immediately welcomes the next customer."*

---

### Step 7: Wrap-up & Tracks (1:55 – 2:00)
* **What's on screen:** Back to the top view or GitHub repository (`github.com/princenzmw/tiririka`).
* **What you say:**
  > *"Tiririka is completely open source under MIT. We are submitting for Top 3 Overall, the DeFi Track, and Best Beginner Hack. Thank you!"*
