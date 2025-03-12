use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub owner: Pubkey,
    pub staking_fee: u64,
    pub staking_fee_recipient: Pubkey,
    pub token_mint: Pubkey,
    pub bump: u8,
}