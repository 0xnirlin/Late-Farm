use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("Invalid staking period")]
    InvalidPeriod,

    #[msg("Staking period ended")]
    StakingPeriodEnded,

    #[msg("Invalid owner")]
    InvalidOwner,
}