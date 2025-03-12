use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

pub mod instructions;
pub mod state;

use instructions::*;
use state::*;

declare_id!("5eEvigM8bxcM8NgXX7aFLaHiy8XZpUKdCyQhRLNAoRWN");

#[program]
pub mod late_staking {
    use super::*;

    /// Initialize the protocol configuration
    pub fn init_protocol(
        ctx: Context<InitProtocol>,
        fee_recipient: Pubkey,
    ) -> Result<()> {
        ctx.accounts.init_protocol(fee_recipient, ctx.bumps)
    }

    /// Start a new staking pool
    pub fn start_staking(
        ctx: Context<StartStaking>,
        period_end: u64,
        token_amount: u64,
    ) -> Result<()> {
        ctx.accounts.start_staking(period_end, token_amount, ctx.bumps)
    }

    /// Stake tokens in an active staking pool
    pub fn stake(
        ctx: Context<Stake>,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.deposit(amount, ctx.bumps)
    }

}
