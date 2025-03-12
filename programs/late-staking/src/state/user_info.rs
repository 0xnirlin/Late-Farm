use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserInfo {
    pub user: Pubkey,
    pub staked_amount: u64,
    pub reward_claimed: u64,
    pub last_updated: u64,
    // we have the reward debt per user so when user deposits it will be reward debt * current reward per token.
    pub reward_debt: u64,
    pub bump: u8,
}

