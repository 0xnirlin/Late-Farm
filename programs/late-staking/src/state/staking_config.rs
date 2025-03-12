use anchor_lang::prelude::*;
use crate::state::errors::ErrorCode;

#[account]
#[derive(InitSpace)]
pub struct StakingConfig {
    pub owner: Pubkey,
    pub period_start: u64,
    pub period_end: u64,
    pub last_updated: u64,
    pub total_staked: u64,
    pub total_reward: u64,
    pub token_mint: Pubkey,
    // this is the amount of tokens that will be issued per second.
    pub reward_per_second: u64, // ok 
    // this will be reward per token. 
    pub reward_per_token_stored: u64, // ok 
    pub bump: u8,
}


impl StakingConfig {
    pub fn set_values(
        &mut self,
        owner: Pubkey,
        period_start: u64,
        period_end: u64,
        total_staked: u64,
        last_updated: u64,
        total_reward: u64,
        token_mint: Pubkey,
        reward_per_second: u64,
        reward_per_token_stored: u64,
        bump: u8,
    ) -> Result<()> {
        require!(period_end > period_start, ErrorCode::InvalidPeriod);
        
        self.owner = owner;
        self.period_start = period_start;
        self.period_end = period_end;
        self.last_updated = last_updated;
        self.total_staked = total_staked;
        self.total_staked = total_staked;
        self.total_reward = total_reward;
        self.token_mint = token_mint;
        self.reward_per_second = reward_per_second;
        self.reward_per_token_stored = reward_per_token_stored;
        self.bump = bump;
        
        Ok(())
    }

}
