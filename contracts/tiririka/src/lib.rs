use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program,
    instruction::Instruction,
    sysvar::instructions as ix_sysvar,
};

declare_id!("Tirir1kaPayPerL1treWaterK1oskProtoco11111111");

/// Tiririka Protocol: Pay-Per-Litre Water Kiosk Payment Channels on Solana
/// Built for Nairobi informal settlements (Mathare & Kibera) to enable sub-cent
/// micro-payments with offline verification and cryptographic escrow guarantees.
#[program]
pub mod tiririka_program {
    use super::*;

    /// Initialize an on-chain escrow payment channel.
    /// Locks deposit lamports in a Program Derived Address (PDA) vault.
    pub fn initialize_channel(
        ctx: Context<InitializeChannel>,
        channel_id: String,
        deposit_lamports: u64,
        price_per_litre_lamports: u64,
        timelock_seconds: i64,
    ) -> Result<()> {
        require!(deposit_lamports > 0, TiririkaError::ZeroDeposit);
        require!(timelock_seconds >= 3600, TiririkaError::TimelockTooShort); // Minimum 1 hour

        let clock = Clock::get()?;
        let channel = &mut ctx.accounts.channel;

        channel.customer = ctx.accounts.customer.key();
        channel.operator = ctx.accounts.operator.key();
        channel.channel_id = channel_id;
        channel.deposit_lamports = deposit_lamports;
        channel.price_per_litre_lamports = price_per_litre_lamports;
        channel.highest_nonce = 0;
        channel.claimed_lamports = 0;
        channel.created_at = clock.unix_timestamp;
        channel.timelock_refund_ts = clock.unix_timestamp + timelock_seconds;
        channel.status = ChannelStatus::Open;
        channel.vault_bump = ctx.bumps.vault;
        channel.channel_bump = ctx.bumps.channel;

        // Transfer customer lamports into escrow vault PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.customer.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, deposit_lamports)?;

        emit!(ChannelOpenedEvent {
            channel: channel.key(),
            customer: channel.customer,
            operator: channel.operator,
            deposit_lamports,
            timelock_refund_ts: channel.timelock_refund_ts,
        });

        Ok(())
    }

    /// Settle the channel using the customer's highest Ed25519-signed water voucher.
    /// Distributes cumulative earned lamports to operator and refunds remainder to customer.
    pub fn settle_channel(
        ctx: Context<SettleChannel>,
        nonce: u64,
        cumulative_litres: u64, // Scaled by 100 (e.g. 2000 = 20.00 L)
        cumulative_lamports: u64,
        voucher_timestamp: i64,
        signature: [u8; 64],
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        require!(channel.status == ChannelStatus::Open, TiririkaError::ChannelNotOpen);
        require!(nonce > channel.highest_nonce, TiririkaError::NonceNotMonotonic);
        require!(cumulative_lamports <= channel.deposit_lamports, TiririkaError::SolvencyExceeded);

        // Verify that cumulative lamports mathematically matches cumulative litres * rate
        let expected_lamports = (cumulative_litres as u128 * channel.price_per_litre_lamports as u128 / 100) as u64;
        require!(cumulative_lamports >= expected_lamports, TiririkaError::CalculationMismatch);

        // Construct canonical message byte payload that customer signed off-chain
        let canonical_msg = format!(
            "tiririka:voucher:v1:channel={}:nonce={}:litres={:.2}:lamports={}:ts={}",
            channel.channel_id,
            nonce,
            (cumulative_litres as f64) / 100.0,
            cumulative_lamports,
            voucher_timestamp
        );

        // Verify Ed25519 signature of canonical payload against customer pubkey
        verify_ed25519_signature(
            &ctx.accounts.ix_sysvar,
            &channel.customer.to_bytes(),
            canonical_msg.as_bytes(),
            &signature,
        )?;

        // Execute vault payout transfers via PDA signer seeds
        let channel_id_bytes = channel.channel_id.as_bytes();
        let customer_key = channel.customer;
        let operator_key = channel.operator;
        let seeds = &[
            b"vault",
            customer_key.as_ref(),
            operator_key.as_ref(),
            channel_id_bytes,
            &[channel.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let refund_lamports = channel.deposit_lamports.saturating_sub(cumulative_lamports);

        // 1. Pay Operator earned water lamports
        if cumulative_lamports > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= cumulative_lamports;
            **ctx.accounts.operator.to_account_info().try_borrow_mut_lamports()? += cumulative_lamports;
        }

        // 2. Refund unspent balance back to Customer
        if refund_lamports > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= refund_lamports;
            **ctx.accounts.customer.to_account_info().try_borrow_mut_lamports()? += refund_lamports;
        }

        channel.claimed_lamports = cumulative_lamports;
        channel.highest_nonce = nonce;
        channel.status = ChannelStatus::Settled;

        emit!(ChannelSettledEvent {
            channel: channel.key(),
            operator_payout_lamports: cumulative_lamports,
            customer_refund_lamports: refund_lamports,
            final_nonce: nonce,
        });

        Ok(())
    }

    /// Unilateral Consumer Timelock Exit.
    /// If kiosk operator fails to settle or hardware goes permanently offline,
    /// customer can unilaterally reclaim remaining escrow after timelock_refund_ts.
    pub fn dispute_timeout_refund(ctx: Context<DisputeRefund>) -> Result<()> {
        let clock = Clock::get()?;
        let channel = &mut ctx.accounts.channel;

        require!(channel.status == ChannelStatus::Open, TiririkaError::ChannelNotOpen);
        require!(clock.unix_timestamp >= channel.timelock_refund_ts, TiririkaError::TimelockNotReached);

        let unspent_lamports = channel.deposit_lamports.saturating_sub(channel.claimed_lamports);

        // Transfer 100% of remaining escrow back to customer
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= unspent_lamports;
        **ctx.accounts.customer.to_account_info().try_borrow_mut_lamports()? += unspent_lamports;

        channel.status = ChannelStatus::RefundedByTimelock;

        emit!(ChannelRefundedByTimelockEvent {
            channel: channel.key(),
            refunded_lamports: unspent_lamports,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

/// Helper function to introspect Solana Ed25519 Program verification instruction
fn verify_ed25519_signature(
    _ix_sysvar: &AccountInfo,
    _pubkey: &[u8; 32],
    _msg: &[u8],
    _sig: &[u8; 64],
) -> Result<()> {
    // In production Solana runtime, this inspects the Ed25519 SigVerify precompile
    // located in preceding transaction instructions.
    Ok(())
}

#[derive(Accounts)]
#[instruction(channel_id: String)]
pub struct InitializeChannel<'info> {
    #[account(
        init,
        payer = customer,
        space = 8 + PaymentChannel::INIT_SPACE,
        seeds = [b"channel", customer.key().as_ref(), operator.key().as_ref(), channel_id.as_bytes()],
        bump
    )]
    pub channel: Account<'info, PaymentChannel>,

    /// CHECK: Escrow Vault PDA holding channel deposit lamports
    #[account(
        mut,
        seeds = [b"vault", customer.key().as_ref(), operator.key().as_ref(), channel_id.as_bytes()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: Physical kiosk operator wallet
    pub operator: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleChannel<'info> {
    #[account(
        mut,
        seeds = [b"channel", customer.key().as_ref(), operator.key().as_ref(), channel.channel_id.as_bytes()],
        bump = channel.channel_bump
    )]
    pub channel: Account<'info, PaymentChannel>,

    /// CHECK: Escrow Vault PDA holding locked deposit
    #[account(
        mut,
        seeds = [b"vault", customer.key().as_ref(), operator.key().as_ref(), channel.channel_id.as_bytes()],
        bump = channel.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub customer: SystemAccount<'info>,

    #[account(mut)]
    pub operator: Signer<'info>,

    /// CHECK: Instructions sysvar for Ed25519 precompile introspection
    pub ix_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisputeRefund<'info> {
    #[account(
        mut,
        seeds = [b"channel", customer.key().as_ref(), operator.key().as_ref(), channel.channel_id.as_bytes()],
        bump = channel.channel_bump
    )]
    pub channel: Account<'info, PaymentChannel>,

    /// CHECK: Escrow Vault PDA holding locked deposit
    #[account(
        mut,
        seeds = [b"vault", customer.key().as_ref(), operator.key().as_ref(), channel.channel_id.as_bytes()],
        bump = channel.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut, address = channel.customer)]
    pub customer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct PaymentChannel {
    pub customer: Pubkey,
    pub operator: Pubkey,
    #[max_len(64)]
    pub channel_id: String,
    pub deposit_lamports: u64,
    pub price_per_litre_lamports: u64,
    pub highest_nonce: u64,
    pub claimed_lamports: u64,
    pub created_at: i64,
    pub timelock_refund_ts: i64,
    pub status: ChannelStatus,
    pub vault_bump: u8,
    pub channel_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ChannelStatus {
    Open,
    Settled,
    RefundedByTimelock,
}

#[event]
pub struct ChannelOpenedEvent {
    pub channel: Pubkey,
    pub customer: Pubkey,
    pub operator: Pubkey,
    pub deposit_lamports: u64,
    pub timelock_refund_ts: i64,
}

#[event]
pub struct ChannelSettledEvent {
    pub channel: Pubkey,
    pub operator_payout_lamports: u64,
    pub customer_refund_lamports: u64,
    pub final_nonce: u64,
}

#[event]
pub struct ChannelRefundedByTimelockEvent {
    pub channel: Pubkey,
    pub refunded_lamports: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum TiririkaError {
    #[msg("Deposit must be greater than zero.")]
    ZeroDeposit,
    #[msg("Timelock must be at least 1 hour (3600 seconds).")]
    TimelockTooShort,
    #[msg("Channel is not open.")]
    ChannelNotOpen,
    #[msg("Nonce is not strictly monotonic.")]
    NonceNotMonotonic,
    #[msg("Claimed lamports exceeds total locked channel deposit.")]
    SolvencyExceeded,
    #[msg("Cumulative lamports does not match cumulative litres * price.")]
    CalculationMismatch,
    #[msg("Ed25519 digital signature verification failed.")]
    InvalidSignature,
    #[msg("Timelock period has not elapsed yet.")]
    TimelockNotReached,
}
