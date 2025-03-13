use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::state::*;
/// Accounts required for starting a new staking pool
#[derive(Accounts)]
pub struct StartStaking<'info> {
    /// The owner who is creating the staking pool and providing rewards
    #[account(mut)]
    pub owner: Signer<'info>,
    
    /// The staking configuration account that will be initialized
    #[account(
        init,
        payer = owner,
        space = 8 + StakingConfig::INIT_SPACE,
        seeds = [b"staking_config".as_ref()],
        bump
    )]
    pub staking_config: Account<'info, StakingConfig>,

    /// The token mint for the staking and rewards
    pub token_mint: InterfaceAccount<'info, Mint>,

    /// Protocol configuration containing global settings
    #[account(
        seeds = [b"protocol_config".as_ref()],
        bump,
        has_one = token_mint,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Token account that will hold the reward tokens
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_mint,
        associated_token::authority = staking_config,
    )]
    pub reward_pool: InterfaceAccount<'info, TokenAccount>,

    /// Owner's token account from which reward tokens will be transferred
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Required system program
    pub system_program: Program<'info, System>,
    
    /// Required token program interface
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Required associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> StartStaking<'info> {
    /// Initializes a new staking pool with the specified parameters
    ///
    /// # Arguments
    /// * `period_end` - The timestamp when the staking period will end
    /// * `token_amount` - The total amount of tokens to be distributed as rewards
    /// * `bumps` - Bump seeds for PDA derivation
    pub fn start_staking(&mut self, period_end: u64, token_amount: u64, bumps: StartStakingBumps) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp as u64;
        let period_start = current_timestamp;
        
        // Calculate rewards per second based on the total duration and token amount
        let duration = period_end - period_start;
        msg!("Staking duration: {} seconds", duration);
        
        let reward_per_second = token_amount / duration;
        msg!("Calculated reward per second: {}", reward_per_second);

        // Initialize the staking configuration with the provided values
        self.staking_config.set_values(
            self.owner.key(),
            period_start,
            period_end,
            0,                  // total_staked (starting with zero)
            current_timestamp,  // last_updated
            token_amount,       // total_reward
            self.token_mint.key(),
            reward_per_second,  // reward_per_second
            0,                  // reward_per_token_stored (starting with zero)
            bumps.staking_config,
        )?;

        // Transfer the reward tokens from the owner to the reward pool
        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(), 
            TransferChecked {
                from: self.owner_token_account.to_account_info(),
                to: self.reward_pool.to_account_info(),
                authority: self.owner.to_account_info(),
                mint: self.token_mint.to_account_info(),
            }
        );

        // msg token_amount
        msg!("Starting staking pool with {} tokens as rewards", token_amount);
        msg!("Period start: {}, Period end: {}", period_start, period_end);
        msg!("Reward per second: {}", reward_per_second);
        
        transfer_checked(cpi_ctx, token_amount, self.token_mint.decimals)?;

        Ok(())
    }
}
