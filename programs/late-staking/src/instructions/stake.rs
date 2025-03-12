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
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut, 
        associated_token::mint = token_mint,
        associated_token::authority = staking_config,
    )]
    pub staking_config_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = staking_config,
    )]
    pub stake_pool: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
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
    // first alice interaction at very start when no time has passed.
    // bob stakes after 10 seconds for the amount of 5000, 50% of alice stake
    // at t=20 seconds alice comes back and stake just 5000 token. 
    pub fn deposit(&mut self, amount: u64, bumps: StakeBumps) -> Result<()> {
        
        // Transfer tokens from user to stake pool
        //  Bob is transferred 
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

        // Update user info with new stake amount
        // bob user info is updated. 
        // this will be 10,001
        self.user_info.staked_amount += amount;
        self.user_info.reward_claimed = 0;
        self.user_info.user = self.user.key();
        self.user_info.bump = bumps.user_info;

        // Update total staked amount in staking config
        // 10,000
        // 15,000
        self.staking_config.total_staked += amount;
        
        // Calculate time passed since last update
        let current_time = Clock::get()?.unix_timestamp as u64;
        let last_time = self.staking_config.last_updated;
        // we calculate the time that has passed since the last update, if it is zero we will skip few operations. 
        // 10 second, reward per second is 1000.
        // when bob stakes 10 seconds have passed. 
        // time passed this time is again 10 seconds. 
        let time_passed = current_time.checked_sub(last_time).ok_or(ErrorCode::MathOverflow)?;
        

        let reward_per_token = if time_passed > 0 {
            // reward = 1000 * 10 / 150000 = 10,000 / 15,000 = 0.6
            // reward = 1000 * 10 / 20,000 = 0.5 tokens per token. 
            let reward = self.staking_config.reward_per_second * PRECISION_D9 * time_passed / self.staking_config.total_staked;
            
           // reward per token is stored as 0.6
           // 0.6 + 0.5 = 1.1
            self.staking_config.reward_per_token_stored += reward;
            
            reward
        } else {
            // reward per token for now is 0, since no time has passed. 
            self.staking_config.reward_per_token_stored
        };
        
        // Calculate user's reward debt based on their stake and the new rewards
        // this will be 0 tooo. 
        // reward_debt for bob = 5000 * 0.6 = 3000
        // 0
        // 5000 * 1.1 = 5500
        let reward_debt = amount * reward_per_token;
        self.user_info.reward_debt += reward_debt;

        // Calculate pending rewards for the user
        // this will be 0. 
        // reward_before_debt = 5000 * 0.6 = 3000
        // 15000 * 1.1 = 16500
        let reward_before_debt = self.user_info.staked_amount * self.staking_config.reward_per_token_stored;
        // 0 minus 1 will be 0 
        // pending_reward = 3000 - 3000 = 0
        // 16500 - 5500 = 11000
        let pending_reward = reward_before_debt.checked_sub(reward_debt).ok_or(ErrorCode::MathOverflow)?;
        
        // Transfer any pending rewards to the user
        // now transfer happens at thispoint. 
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
            transfer_checked(cpi_ctx, pending_reward / PRECISION_D9, self.token_mint.decimals)?;
        }
        
        // Update last updated time in staking config
        self.staking_config.last_updated = current_time;
        self.user_info.reward_claimed = pending_reward;
        self.user_info.last_updated = Clock::get()?.unix_timestamp as u64;

        
       
        Ok(())
    }

    // pub fn withdraw(&mut self, amount: u64) -> Result<()> {
    //     // Ensure user has enough staked tokens to withdraw
    //     require!(
    //         self.user_info.staked_amount >= amount,
    //         ErrorCode::InsufficientStakedAmount
    //     );

    //     // Calculate time passed since last update
    //     let current_time = Clock::get()?.unix_timestamp as u64;
    //     let last_time = self.staking_config.last_updated;
    //     let time_passed = current_time.checked_sub(last_time).ok_or(ErrorCode::MathOverflow)?;

    //     // Update reward per token stored if time has passed
    //     if time_passed > 0 && self.staking_config.total_staked > 0 {
    //         let reward = self.staking_config.reward_per_second * PRECISION_D9 * time_passed / self.staking_config.total_staked;
    //         self.staking_config.reward_per_token_stored += reward;
    //     }

    //     // Calculate pending rewards before withdrawal
    //     let reward_before_debt = self.user_info.staked_amount * self.staking_config.reward_per_token_stored;
    //     let pending_reward = reward_before_debt.checked_sub(self.user_info.reward_debt).ok_or(ErrorCode::MathOverflow)?;

    //     // Update user's staked amount and total staked amount
    //     self.user_info.staked_amount = self.user_info.staked_amount.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
    //     self.staking_config.total_staked = self.staking_config.total_staked.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;

    //     // Update user's reward debt based on new staked amount
    //     self.user_info.reward_debt = self.user_info.staked_amount * self.staking_config.reward_per_token_stored;

    //     // Transfer staked tokens back to user
    //     let seeds = &[
    //         b"staking_config".as_ref(),
    //         &[self.staking_config.bump],
    //     ];
    //     let signer = &[&seeds[..]];

    //     let cpi_ctx = CpiContext::new_with_signer(
    //         self.token_program.to_account_info(),
    //         TransferChecked {
    //             from: self.stake_pool.to_account_info(),
    //             to: self.user_token_account.to_account_info(),
    //             mint: self.token_mint.to_account_info(),
    //         },
    //         signer,
    //     );
    //     transfer_checked(cpi_ctx, amount, self.token_mint.decimals)?;

    //     // Transfer any pending rewards to the user
    //     if pending_reward > 0 {
    //         let cpi_ctx = CpiContext::new_with_signer(
    //             self.token_program.to_account_info(),
    //             TransferChecked {
    //                 from: self.staking_config_token_account.to_account_info(),
    //                 to: self.user_token_account.to_account_info(),
    //                 mint: self.token_mint.to_account_info(),
    //             },
    //             signer,
    //         );
    //         transfer_checked(cpi_ctx, pending_reward / PRECISION_D9, self.token_mint.decimals)?;
    //         self.user_info.reward_claimed = pending_reward;
    //     }

    //     // Update last updated time
    //     self.staking_config.last_updated = current_time;
    //     self.user_info.last_updated = Clock::get()?.unix_timestamp as i64;

    //     Ok(())
    // }
}