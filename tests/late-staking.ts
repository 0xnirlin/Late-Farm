import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { LateStaking } from "../target/types/late_staking";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { describe, test, expect, beforeEach } from '@jest/globals';
import { PublicKey } from '@solana/web3.js';
import {TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getBalance,
  getMint,
  getAssociatedTokenAddress,
} from "spl-token-bankrun";
import { Clock } from "solana-bankrun";


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
          lamports: 259200000_000_000, // Reduced to a more reasonable amount
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

  // test('initialize protocol', async () => {
  //   // Create a token mint for testing
    
  //   // Find protocol config PDA
  //   const [protocolConfig, _] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("protocol_config")],
  //     program.programId
  //   );
    
  //   // Default fee recipient (using owner in this case)
  //   const feeRecipient = new PublicKey(0); // Pubkey::default()
    
  //   // Call init_protocol
  //   await program.methods
  //     .initProtocol(feeRecipient)
  //     .accountsPartial({
  //       owner: owner.publicKey,
  //       protocolConfig: protocolConfig,
  //       tokenMint: tokenMint,
  //       tokenProgram: TOKEN_2022_PROGRAM_ID,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .signers([owner])
  //     .rpc();
    
  //   // Fetch the protocol config to verify initialization
  //   const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);

  //   console.log(protocolConfigAccount);
    
  //   // Verify the protocol was initialized correctly
  //   expect(protocolConfigAccount.owner.toString()).toBe(owner.publicKey.toString());
  //   expect(protocolConfigAccount.tokenMint.toString()).toBe(tokenMint.toString());
  //   expect(protocolConfigAccount.stakingFeeRecipient.toString()).toBe(owner.publicKey.toString());
  // });
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

    const feeRecipient = new PublicKey(0); // Pubkey::default()

    // Initialize the protocol first
    await program.methods
      .initProtocol(owner.publicKey)
      .accountsPartial({
        owner: owner.publicKey,
        protocolConfig: protocolConfig,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
      
    // Verify protocol initialization was successful
    const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);
    expect(protocolConfigAccount.owner.toString()).toBe(owner.publicKey.toString());
    expect(protocolConfigAccount.tokenMint.toString()).toBe(tokenMint.toString());
    console.log("Protocol initialized successfully");

  

    

    // Initialize staking pool with 3 day period and 1000 tokens per second reward
    const periodEnd = Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60);
    const rewardAmount = new BN(259200000); // 25920000 tokens per second (contract will calculate with precision)

    // Create the associated token account for the staking config (reward pool)
    const reward_pool = await createAssociatedTokenAccount(
      context.banksClient,
      owner,
      tokenMint,
      stakingConfig,
    );

    // log token mint and staking config
    console.log("Token Mint:", tokenMint.toString());
    console.log("Staking Config:", stakingConfig.toString());

    // console.log("Staking Config Token Account:", stakingConfigTokenAccount.toString());

    // Verify the token mint is initialized
    const mintInfo = await getMint(
      context.banksClient,
      tokenMint,
    );
    console.log("Token Mint Info:", mintInfo);



    // Log all the keys being passed to the startStaking instruction
    console.log("Starting staking with the following accounts:");
    console.log("- owner:", owner.publicKey.toString());
    console.log("- stakingConfig:", stakingConfig.toString());
    console.log("- tokenMint:", tokenMint.toString());
    console.log("- protocolConfig:", protocolConfig.toString());
    console.log("- ownerTokenAccount:", ownerTokenAccount.toString());
    console.log("- systemProgram:", anchor.web3.SystemProgram.programId.toString());
    console.log("- tokenProgram:", TOKEN_2022_PROGRAM_ID.toString());
    console.log("- associatedTokenProgram:", anchor.utils.token.ASSOCIATED_PROGRAM_ID.toString());
    console.log("- stakingConfigTokenAccount:", reward_pool.toString());

    await program.methods
    .startStaking(new BN(periodEnd), rewardAmount)
    .accountsPartial({
      owner: owner.publicKey,
      stakingConfig: stakingConfig,
      tokenMint: tokenMint,
      protocolConfig: protocolConfig,
      rewardPool: reward_pool,
      ownerTokenAccount: ownerTokenAccount,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([owner])
    .rpc();



    
  });
});
