import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { LateStaking } from "../target/types/late_staking";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { describe, test, expect, beforeAll } from '@jest/globals';
import { PublicKey, Transaction } from '@solana/web3.js';
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
  let user3: anchor.web3.Keypair;
  let user4: anchor.web3.Keypair;
  let user5: anchor.web3.Keypair;
  let user6: anchor.web3.Keypair;
  let user7: anchor.web3.Keypair;
  let user8: anchor.web3.Keypair;
  let user9: anchor.web3.Keypair;
  let user10: anchor.web3.Keypair;
  let context: any;
  let tokenMint: PublicKey;
  let ownerTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let user3TokenAccount: PublicKey;
  let user4TokenAccount: PublicKey;
  let user5TokenAccount: PublicKey;
  let user6TokenAccount: PublicKey;
  let user7TokenAccount: PublicKey;
  let user8TokenAccount: PublicKey;
  let user9TokenAccount: PublicKey;
  let user10TokenAccount: PublicKey;
  let reward_pool;
      // Update the clock to simulate time passing
      let currentClock;
  
  beforeAll(async () => {
   
        
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
          lamports: 1000000000,
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
      {
        address: user3.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user4.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user5.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user6.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user7.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user8.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user9.publicKey,
        info: {
          lamports: 10000000000,
          executable: false,
          owner: anchor.web3.SystemProgram.programId,
          data: Buffer.alloc(0),
        },
      },
      {
        address: user10.publicKey,
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
    
    user3TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user3.publicKey,
    )
    
    user4TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user4.publicKey,
    )
    
    user5TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user5.publicKey,
    )
    
    user6TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user6.publicKey,
    )
    
    user7TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user7.publicKey,
    )
    
    user8TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user8.publicKey,
    )
    
    user9TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user9.publicKey,
    )
    
    user10TokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user10.publicKey,
    )

    await mintTo(
      context.banksClient,
      owner,
      tokenMint,
      ownerTokenAccount,
      owner.publicKey,
      5000000_000_000,
    )

    await mintTo(
      context.banksClient,
      owner,
      tokenMint,
      user1TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )

    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user2TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user3TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user4TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user5TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user6TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user7TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user8TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user9TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )
    
    await mintTo( 
      context.banksClient,
      owner,
      tokenMint,
      user10TokenAccount,
      owner.publicKey,
      5000000_000_000,
    )

    // declate variable not const
    let ownerAccountInfo = await getAccount(
      context.banksClient,
      ownerTokenAccount,
    )

    let user1AccountInfo = await getAccount(
      context.banksClient,
      user1TokenAccount,
    )

    let user2AccountInfo = await getAccount(
      context.banksClient,
      user2TokenAccount,
    )

         // Update the clock to simulate time passing
        currentClock = await context.banksClient.getClock();


         context.setClock(
           new Clock(
             currentClock.slot,
             currentClock.epochStartTimestamp,
             currentClock.epoch,
             currentClock.leaderScheduleEpoch,
             BigInt(0),
           )
         )
    
  });

  test('init and start staking', async () => {
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
    const initProtocolTx = await program.methods
      .initProtocol(owner.publicKey)
      .accountsPartial({
        owner: owner.publicKey,
        protocolConfig: protocolConfig,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
      
    const blockhash = context.lastBlockhash;
    initProtocolTx.recentBlockhash = blockhash;
    initProtocolTx.sign(owner);
    await context.banksClient.processTransaction(initProtocolTx);
      
    // Verify protocol initialization was successful
    const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);
    expect(protocolConfigAccount.owner.toString()).toBe(owner.publicKey.toString());
    expect(protocolConfigAccount.tokenMint.toString()).toBe(tokenMint.toString());

    // Initialize staking pool with 3 day period and 1000 tokens per second reward
    const periodEnd = 5000;
    // Log the period end timestamp
    console.log("Staking period end timestamp:", periodEnd);
    console.log("Staking period end date:", new Date(periodEnd * 1000).toLocaleString());
    const rewardAmount = new BN(5000000_000_000); // 25920000 tokens per second (contract will calculate with precision)

    // Create the associated token account for the staking config (reward pool)
   reward_pool = await createAssociatedTokenAccount(
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

    const startStakingTx = await program.methods
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
      .transaction();
      
    startStakingTx.recentBlockhash = context.lastBlockhash;
    startStakingTx.sign(owner);
    await context.banksClient.processTransaction(startStakingTx);
    
  });
  
  test('user1 deposits tokens', async () => {
    // Create the associated token account for the staking config (reward pool)
    const [stakingConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_config")],
      program.programId
    );
    
    // Log the data stored in staking config
    const stakingConfigAccount = await program.account.stakingConfig.fetch(stakingConfig);

    // log staking config
    console.log("Staking Config:", {
      owner: stakingConfigAccount.owner.toString(),
      tokenMint: stakingConfigAccount.tokenMint.toString(),
      periodEnd: stakingConfigAccount.periodEnd.toString(),
      totalStaked: stakingConfigAccount.totalStaked.toString(),
      rewardPerSecond: stakingConfigAccount.rewardPerSecond.toString(),
      rewardPerTokenStored: stakingConfigAccount.rewardPerTokenStored.toString(),
    });
    
    // Amount to deposit
    const depositAmount = new BN(10000_000_000);

    // initial user1 balance
    const initialUser1Balance = await getAccount(
      context.banksClient,
      user1TokenAccount
    );

    // Find the user info account PDA
    const [userInfo, userInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user1.publicKey.toBuffer(), tokenMint.toBuffer()],
      program.programId
    );

    // Get the stake pool (reward pool) balance before deposit
    const stakePoolBefore = await getAccount(
      context.banksClient,
      reward_pool
    );

    // Execute the deposit instruction
    const depositTx = await program.methods
      .deposit(depositAmount)
      .accountsPartial({
        user: user1.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user1TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: userInfo,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .transaction();
      
    depositTx.recentBlockhash = context.lastBlockhash;
    depositTx.sign(user1);
    await context.banksClient.processTransaction(depositTx);

    // Verify the deposit was successful
    const userInfoAccount = await program.account.userInfo.fetch(userInfo);
    expect(userInfoAccount.stakedAmount.toString()).toBe(depositAmount.toString());

    // Check user1's token balance decreased
    const finalUser1Balance = await getAccount(
      context.banksClient,
      user1TokenAccount
    );
    expect(Number(initialUser1Balance.amount) - Number(finalUser1Balance.amount)).toBe(Number(depositAmount));

    // Check stake pool balance increased
    const stakePoolBalance = await getAccount(
      context.banksClient,
      reward_pool
    );
    
    // Calculate the expected increase in stake pool balance
    const expectedIncrease = Number(depositAmount);
    const actualIncrease = Number(stakePoolBalance.amount) - Number(stakePoolBefore.amount);
    
    // Verify the stake pool balance increased by exactly the deposit amount
    expect(actualIncrease).toBe(expectedIncrease);
    
    // Also verify the total balance is at least the deposit amount
    expect(Number(stakePoolBalance.amount)).toBeGreaterThanOrEqual(Number(depositAmount));


 
    

    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(1000),
      )
    )

    // User1 stakes again after some time has passed
    const secondDepositAmount = new BN(5000_000_000);
    
    const secondDepositTx = new Transaction();
    secondDepositTx.add(
      await program.methods
      .deposit(secondDepositAmount)
      .accountsPartial({
        user: user1.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user1TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: userInfo,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    secondDepositTx.recentBlockhash = context.lastBlockhash;
    secondDepositTx.sign(user1);
    await context.banksClient.processTransaction(secondDepositTx);
  });
  
});
