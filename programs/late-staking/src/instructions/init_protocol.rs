use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::{ProtocolConfig, PROTOCOL_FEE};

#[derive(Accounts)]
pub struct InitProtocol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = 8 + ProtocolConfig::INIT_SPACE, seeds = [b"protocol_config".as_ref()], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// CHECK: This is just used to store the mint address
    pub token_mint: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitProtocol<'info> {
    pub fn init_protocol(&mut self, fee_recipient: Pubkey, bumps: InitProtocolBumps) -> Result<()> {
        let fee_recipient = if fee_recipient == Pubkey::default() {
            self.owner.key()
        } else {
            fee_recipient
        };
        
        self.protocol_config.owner = self.owner.key();
        self.protocol_config.staking_fee_recipient = fee_recipient;
        self.protocol_config.staking_fee = PROTOCOL_FEE; // Using the constant for the fee
        self.protocol_config.bump = bumps.protocol_config;
        self.protocol_config.token_mint = self.token_mint.key();
        
        Ok(())
    }
}