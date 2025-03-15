use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Whitelist {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub bump: u8,
}

// The INIT_SPACE calculation was incorrect:
// 8 (account discriminator) + 32 (creator) + 32 (token_mint) + 1 (bump) = 73
// Using #[derive(InitSpace)] is preferred as it automatically calculates the space
