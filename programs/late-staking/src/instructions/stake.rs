use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer, transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::state::errors::ErrorCode;
use crate::state::*;


#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"staking_config".as_ref()],
        bump = staking_config.bump,
        has_one = token_mint,
    )]
    pub staking_config: Account<'info, StakingConfig>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = staking_config,
    )]
    pub staking_config_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = staking_config,
    )]
    pub stake_pool: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserInfo::INIT_SPACE,
        seeds = [b"user_info".as_ref(), user.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub user_info: Account<'info, UserInfo>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl<'info> Stake<'info> {
    pub fn deposit(&mut self, amount: u64, bumps: StakeBumps) -> Result<()> {
        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(), 
            TransferChecked {
                from: self.user_token_account.to_account_info(),
                to: self.stake_pool.to_account_info(),
                authority: self.user.to_account_info(),
                mint: self.token_mint.to_account_info(),
            }
        );
        transfer_checked(cpi_ctx, amount, self.token_mint.decimals)?;

        // print the before staked  
        msg!("Before staked: {}", self.user_info.staked_amount);


        
        let mut current_time = Clock::get()?.unix_timestamp as u64;
        require!(
            current_time <= self.staking_config.period_end,
            ErrorCode::StakingPeriodEnded
        );
        let last_time = self.staking_config.last_updated;

        // log current time and last time
        msg!("Current time: {}", current_time);
        msg!("Last time: {}", last_time);
        
        let time_passed = current_time.checked_sub(last_time).ok_or(ErrorCode::MathOverflow)?;
        msg!("Time passed: {}", time_passed);
        let reward_per_token = if time_passed > 0 {
            let reward_per_second = self.staking_config.reward_per_second;
            let reward_amount = reward_per_second * time_passed;
            let total_staked = self.staking_config.total_staked;
            msg!("Total Staked: {}", total_staked);
            let reward = self.staking_config.reward_per_second * PRECISION_D9 * time_passed / self.staking_config.total_staked;
            self.staking_config.reward_per_token_stored += reward;
            self.staking_config.reward_per_token_stored
        } else {
            self.staking_config.reward_per_token_stored
        };

        self.staking_config.total_staked += amount;

    
        let mut pending_reward = 0;
        if self.user_info.staked_amount > 0 {
            let reward_before_debt = (self.user_info.staked_amount * self.staking_config.reward_per_token_stored) / PRECISION_D9;
            // log reward before debt
            msg!("Reward before debt: {}", reward_before_debt / PRECISION_D9);

            pending_reward = reward_before_debt.checked_sub(self.user_info.reward_debt).ok_or(ErrorCode::MathOverflow)?;
            msg!("Pending reward: {}", pending_reward / PRECISION_D9);
            
            if pending_reward > 0 {
                let seeds = &[
                    b"staking_config".as_ref(),
                    &[self.staking_config.bump],
                ];
                let signer = &[&seeds[..]];
                
                let cpi_ctx = CpiContext::new_with_signer(
                    self.token_program.to_account_info(), 
                    TransferChecked {
                        authority: self.staking_config.to_account_info(),
                        from: self.staking_config_token_account.to_account_info(),
                        to: self.user_token_account.to_account_info(),
                        mint: self.token_mint.to_account_info(),
                    },
                    signer
                );
                transfer_checked(cpi_ctx, pending_reward, self.token_mint.decimals)?;
            }
        }

            
     
        
        self.staking_config.last_updated = current_time;
        self.user_info.reward_claimed += pending_reward;
        self.user_info.last_updated = Clock::get()?.unix_timestamp as u64;

        self.user_info.staked_amount += amount;
        self.user_info.user = self.user.key();
        self.user_info.bump = bumps.user_info;

        let reward_debt = self.user_info.staked_amount * reward_per_token / PRECISION_D9;
        msg!("Reward debt: {}", reward_debt/PRECISION_D9);
        self.user_info.reward_debt = reward_debt;
        msg!("User info reward debt: {}", self.user_info.reward_debt/PRECISION_D9);

        Ok(())
    }

}