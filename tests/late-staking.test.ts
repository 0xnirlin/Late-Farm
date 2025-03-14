import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { LateStaking } from "../target/types/late_staking";
import { describe, test, expect, beforeAll } from '@jest/globals';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  createAssociatedTokenAccount,
  getAccount,
  getMint,
} from "spl-token-bankrun";
import { setupTestContext, advanceClock, TestContext } from './utils';

describe('Late Staking', () => {
  let testContext: TestContext;
  let program: Program<LateStaking>;
  let reward_pool: PublicKey;
  
  beforeAll(async () => {
    // Setup test context with 10 users
    testContext = await setupTestContext(10);
    program = anchor.workspace.LateStaking as Program<LateStaking>;
  });

  test('init and start staking', async () => {
    const { owner, tokenMint, context, ownerTokenAccount } = testContext;
    
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
    const { users, userTokenAccounts, tokenMint, context, currentClock } = testContext;
    const user1 = users[0];
    const user1TokenAccount = userTokenAccounts[0];
    
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

    // Advance the clock by 1000 seconds
    advanceClock(context, currentClock, 1000);

    // User2 stakes 5000_000_000 tokens
    const user2 = users[1];
    const user2TokenAccount = userTokenAccounts[1];
    const user2DepositAmount = new BN(5000_000_000);
    
    // Find the user info account PDA for user2
    const [user2Info] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user2.publicKey.toBuffer(), tokenMint.toBuffer()],
      program.programId
    );
    
    const user2DepositTx = new Transaction();
    user2DepositTx.add(
      await program.methods
      .deposit(user2DepositAmount)
      .accountsPartial({
        user: user2.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user2TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: user2Info,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    user2DepositTx.recentBlockhash = context.lastBlockhash;
    user2DepositTx.sign(user2);
    await context.banksClient.processTransaction(user2DepositTx);
    
    // Advance the clock by 500 seconds
    advanceClock(context, currentClock, 1500);
    
    // User3 stakes 30000_000_000 tokens
    const user3 = users[2];
    const user3TokenAccount = userTokenAccounts[2];
    const user3DepositAmount = new BN(30000_000_000);
    
    // Find the user info account PDA for user3
    const [user3Info] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_info"), user3.publicKey.toBuffer(), tokenMint.toBuffer()],
      program.programId
    );
    
    const user3DepositTx = new Transaction();
    user3DepositTx.add(
      await program.methods
      .deposit(user3DepositAmount)
      .accountsPartial({
        user: user3.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user3TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: user3Info,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    user3DepositTx.recentBlockhash = context.lastBlockhash;
    user3DepositTx.sign(user3);
    await context.banksClient.processTransaction(user3DepositTx);
    
    // Advance the clock by 500 seconds
    advanceClock(context, currentClock, 2000);
    
    // All users stake 1 token each
    const depositOneAmount = new BN(1);
    
    // User1 stakes 1 token
    const user1DepositOneTx = new Transaction();
    user1DepositOneTx.add(
      await program.methods
      .deposit(depositOneAmount)
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
    user1DepositOneTx.recentBlockhash = context.lastBlockhash;
    user1DepositOneTx.sign(user1);
    await context.banksClient.processTransaction(user1DepositOneTx);
    
    // User2 stakes 1 token
    const user2DepositOneTx = new Transaction();
    user2DepositOneTx.add(
      await program.methods
      .deposit(depositOneAmount)
      .accountsPartial({
        user: user2.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user2TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: user2Info,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    user2DepositOneTx.recentBlockhash = context.lastBlockhash;
    user2DepositOneTx.sign(user2);
    await context.banksClient.processTransaction(user2DepositOneTx);
    
    // User3 stakes 1 token
    const user3DepositOneTx = new Transaction();
    user3DepositOneTx.add(
      await program.methods
      .deposit(depositOneAmount)
      .accountsPartial({
        user: user3.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user3TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: user3Info,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    user3DepositOneTx.recentBlockhash = context.lastBlockhash;
    user3DepositOneTx.sign(user3);
    await context.banksClient.processTransaction(user3DepositOneTx);

    // Advance the clock by 1500 seconds more
    await advanceClock(context, currentClock, 3500);
    
    // Amount for additional stakes
    const additionalStakeAmount = new BN(5000_000_000);
    
    // User3 stakes 5000_000_000 more tokens
    const user3AdditionalStakeTx = new Transaction();
    
    user3AdditionalStakeTx.add(
      await program.methods
      .deposit(additionalStakeAmount)
      .accountsPartial({
        user: user3.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user3TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: user3Info,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    user3AdditionalStakeTx.recentBlockhash = context.lastBlockhash;
    user3AdditionalStakeTx.sign(user3);
    await context.banksClient.processTransaction(user3AdditionalStakeTx);
    
    // Advance the clock to 4999 (just before period end)
    await advanceClock(context, currentClock, 4999);
    
    // All users stake 1 wei more tokens
    const oneWeiAmount = new BN(11);
    
    // User1 stakes 1 wei more tokens
    const user1FinalStakeTx = new Transaction();
    
    user1FinalStakeTx.add(
      await program.methods
      .deposit(oneWeiAmount)
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
    user1FinalStakeTx.recentBlockhash = context.lastBlockhash;
    user1FinalStakeTx.sign(user1);
    await context.banksClient.processTransaction(user1FinalStakeTx);
    
    // User2 stakes 1 wei more tokens
    const user2FinalStakeTx = new Transaction();
    
    user2FinalStakeTx.add(
      await program.methods
      .deposit(oneWeiAmount)
      .accountsPartial({
        user: user2.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user2TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: user2Info,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    user2FinalStakeTx.recentBlockhash = context.lastBlockhash;
    user2FinalStakeTx.sign(user2);
    await context.banksClient.processTransaction(user2FinalStakeTx);
    
    // User3 stakes 1 wei more tokens
    const user3FinalStakeTx = new Transaction();
    
    user3FinalStakeTx.add(
      await program.methods
      .deposit(oneWeiAmount)
      .accountsPartial({
        user: user3.publicKey,
        stakingConfig: stakingConfig,
        userTokenAccount: user3TokenAccount,
        stakingConfigTokenAccount: reward_pool,
        stakePool: reward_pool,
        userInfo: user3Info,
        tokenMint: tokenMint,
        tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
    );
    user3FinalStakeTx.recentBlockhash = context.lastBlockhash;
    user3FinalStakeTx.sign(user3);
    await context.banksClient.processTransaction(user3FinalStakeTx);
    
    // Get the stake pool balance after all deposits
    const stakePoolAfterAllDeposits = await getAccount(
      context.banksClient,
      reward_pool
    );
    
    // Get final user balances
    const finalUser1BalanceAfterAll = await getAccount(
      context.banksClient,
      user1TokenAccount
    );
    
    const finalUser2Balance = await getAccount(
      context.banksClient,
      user2TokenAccount
    );
    
    const finalUser3Balance = await getAccount(
      context.banksClient,
      user3TokenAccount
    );
    
    // Calculate the total increase in balance across all users
    const totalIncrease = Number(stakePoolAfterAllDeposits.amount) - Number(stakePoolBefore.amount);
    console.log("Total increase in stake pool balance:", totalIncrease);
    
    // Log individual user balance changes
    console.log("User1 balance change:", Number(initialUser1Balance.amount) - Number(finalUser1BalanceAfterAll.amount));
    console.log("User2 balance change (deposit only):", Number(user2DepositAmount) + Number(depositOneAmount));
    console.log("User3 balance change (deposit only):", Number(user3DepositAmount) + Number(depositOneAmount) + Number(additionalStakeAmount) + Number(oneWeiAmount));
    
    // Calculate total time passed
    const totalTimePassed = 4999; // 2000 seconds
    console.log("Total time passed:", totalTimePassed, "seconds");
    
    // Calculate 1000 * time passed
    const timeMultiplier = 1000 * totalTimePassed;
    console.log("1000 * time passed:", timeMultiplier);
  });
});
