import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { LateStaking } from "../target/types/late_staking";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { describe, test, expect, beforeEach } from '@jest/globals';
import { PublicKey } from '@solana/web3.js';
import {TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getBalance,
  getMint,
} from "spl-token-bankrun";


describe('Late Staking', () => {
  let provider: BankrunProvider;
  let program: Program<LateStaking>;
  let owner: anchor.web3.Keypair;
  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;
  let context: any;
  let tokenMint: PublicKey;
  let ownerTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  
  beforeEach(async () => {
    owner = new anchor.web3.Keypair();
    user1 = new anchor.web3.Keypair();
    user2 = new anchor.web3.Keypair();
    
    context = await startAnchor(".", [], [
      {
        address: owner.publicKey,
        info: {
          lamports: 100_000_000_000_000_000, // Reduced to a more reasonable amount
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user1.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user2.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
    ]);
    
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    program = anchor.workspace.LateStaking as Program<LateStaking>;

    tokenMint = await createMint(
      context.banksClient,
      owner,
      owner.publicKey,
      owner.publicKey,
      6,
    )

    ownerTokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      owner.publicKey,
    )
    
    user1TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user1.publicKey,
    )
    
    user2TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user2.publicKey,
    )

    await mintTo(
      context.banksClient,
      owner,
      tokenMint,
      ownerTokenAccount,
      owner.publicKey,
      100000_000_000,
    )

    await mintTo(
      context.banksClient,
      owner,
      tokenMint,
      user1TokenAccount,
      owner.publicKey,
      100000_000_000,
    )

    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user2TokenAccount,
      owner.publicKey,
      100000_000_000,
    )

    // declate variable not const
    let ownerAccountInfo = await getAccount(
      context.banksClient,
      ownerTokenAccount,
    )

    console.log("Owner Account Info: ", ownerAccountInfo.amount);

    let user1AccountInfo = await getAccount(
      context.banksClient,
      user1TokenAccount,
    )

    console.log("User1 Account Info: ", user1AccountInfo.amount);

    let user2AccountInfo = await getAccount(
      context.banksClient,
      user2TokenAccount,
    )

    console.log("User2 Account Info: ", user2AccountInfo.amount);
    
  });

  test('initialize protocol', async () => {
    // Create a token mint for testing
    
    // Find protocol config PDA
    const [protocolConfig, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      program.programId
    );
    
    // Default fee recipient (using owner in this case)
    const feeRecipient = new PublicKey(0); // Pubkey::default()
    
    // Call init_protocol
    await program.methods
      .initProtocol(feeRecipient)
      .accountsPartial({
        owner: owner.publicKey,
        protocolConfig: protocolConfig,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    
    // Fetch the protocol config to verify initialization
    const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);

    console.log(protocolConfigAccount);
    
    // Verify the protocol was initialized correctly
    expect(protocolConfigAccount.owner.toString()).toBe(owner.publicKey.toString());
    expect(protocolConfigAccount.tokenMint.toString()).toBe(tokenMint.toString());
    expect(protocolConfigAccount.stakingFeeRecipient.toString()).toBe(owner.publicKey.toString());
  });
  test('owner stakes tokens', async () => {
    // First initialize a staking pool
    const [stakingConfig, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_config")],
      program.programId
    );

    // Find protocol config PDA
    const [protocolConfig, __] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      program.programId
    );

    // Initialize staking pool with 3 day period and 1000 tokens per second reward
    const periodEnd = Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60);
    const rewardAmount = new BN(25920000_000_000); // 25920000 tokens per second (contract will calculate with precision)

    // Create the associated token account for the staking config
    const stakingConfigTokenAccount = await createAssociatedTokenAccount(
      context.banksClient,
      owner,
      tokenMint,
      stakingConfig,
    );

    // Verify the token mint is initialized
    const mintInfo = await getMint(
      context.banksClient,
      tokenMint,
    );
    console.log("Token Mint Info:", mintInfo);

    await program.methods
      .startStaking(new BN(periodEnd), rewardAmount)
      .accountsPartial({
        owner: owner.publicKey,
        stakingConfig: stakingConfig,
        tokenMint: tokenMint,
        protocolConfig: protocolConfig, // Fixed: was incorrectly using stakingConfig
        // rewardPool: stakingConfigTokenAccount.address,
        ownerTokenAccount: ownerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();

    // // Now test the deposit function
    // const stakeAmount = new BN(10_000_000); // 10 tokens with 6 decimals
    
    // // Get owner token account
    // const ownerTokenAccount = await createAssociatedTokenAccount(
    //   context.banksClient,
    //   owner,
    //   tokenMint,
    //   owner.publicKey
    // );
    
    // // Create stake pool account
    // const stakePool = await createAssociatedTokenAccount(
    //   context.banksClient,
    //   owner,
    //   tokenMint,
    //   stakingConfig,
    //   true
    // );
    
    // // Find user info PDA
    // const [userInfo, _userInfoBump] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("user_info"), owner.publicKey.toBuffer(), tokenMint.toBuffer()],
    //   program.programId
    // );
    
    // // Call deposit function
    // await program.methods
    //   .deposit(stakeAmount)
    //   .accounts({
    //     user: owner.publicKey,
    //     staking_config: stakingConfig,
    //     user_token_account: ownerTokenAccount,
    //     staking_config_token_account: stakingConfigTokenAccount,
    //     stake_pool: stakePool,
    //     user_info: userInfo,
    //     token_mint: tokenMint,
    //     token_program: TOKEN_2022_PROGRAM_ID,
    //     associated_token_program: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    //     system_program: anchor.web3.SystemProgram.programId,
    //   })
    //   .signers([owner])
    //   .rpc();
    
    // // Verify the stake was successful by checking user info account
    // const userInfoAccount = await program.account.userInfo.fetch(userInfo);
    // expect(userInfoAccount.stakedAmount.toString()).toBe(stakeAmount.toString());
    // expect(userInfoAccount.user.toString()).toBe(owner.publicKey.toString());
    
    // // Check staking config was updated
    // const stakingConfigAccount = await program.account.stakingConfig.fetch(stakingConfig);
    // expect(stakingConfigAccount.totalStaked.toString()).toBe(stakeAmount.toString());
    
    // // Check token balances
    // const stakePoolInfo = await getAccount(context.banksClient, stakePool);
    // expect(stakePoolInfo.amount.toString()).toBe(stakeAmount.toString());
  });
});
