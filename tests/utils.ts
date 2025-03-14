import * as anchor from "@coral-xyz/anchor";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { PublicKey } from '@solana/web3.js';
import {
  createMint,
  createAccount,
  mintTo,
} from "spl-token-bankrun";
import { Clock } from "solana-bankrun";

export interface TestContext {
  provider: BankrunProvider;
  context: any;
  tokenMint: PublicKey;
  owner: anchor.web3.Keypair;
  users: anchor.web3.Keypair[];
  userTokenAccounts: PublicKey[];
  ownerTokenAccount: PublicKey;
  currentClock: any;
}

export async function setupTestContext(numUsers: number = 10): Promise<TestContext> {
  const owner = new anchor.web3.Keypair();
  const users: anchor.web3.Keypair[] = [];
  
  // Create keypairs for all users
  for (let i = 0; i < numUsers; i++) {
    users.push(new anchor.web3.Keypair());
  }
  
  // Setup initial account states
  const accountSetups = [
    {
      address: owner.publicKey,
      info: {
        lamports: 259200000_000_000,
        executable: false,
        owner: anchor.web3.SystemProgram.programId,
        data: Buffer.alloc(0),
      },
    }
  ];
  
  // Add user accounts
  for (const user of users) {
    accountSetups.push({
      address: user.publicKey,
      info: {
        lamports: 10000000000,
        executable: false,
        owner: anchor.web3.SystemProgram.programId,
        data: Buffer.alloc(0),
      },
    });
  }
  
  // Start anchor with the account setups
  const context = await startAnchor(".", [], accountSetups);
  
  const provider = new BankrunProvider(context);
  anchor.setProvider(provider);
  
  // Create token mint
  const tokenMint = await createMint(
    context.banksClient,
    owner,
    owner.publicKey,
    owner.publicKey,
    6,
  );
  
  // Create owner token account
  const ownerTokenAccount = await createAccount(
    context.banksClient,
    owner,
    tokenMint,
    owner.publicKey,
  );
  
  // Create user token accounts
  const userTokenAccounts: PublicKey[] = [];
  for (const user of users) {
    const userTokenAccount = await createAccount(
      context.banksClient,
      owner,
      tokenMint,
      user.publicKey,
    );
    userTokenAccounts.push(userTokenAccount);
  }
  
  // Mint tokens to owner
  await mintTo(
    context.banksClient,
    owner,
    tokenMint,
    ownerTokenAccount,
    owner.publicKey,
    5000000_000_000,
  );
  
  // Mint tokens to users
  for (const userTokenAccount of userTokenAccounts) {
    await mintTo(
      context.banksClient,
      owner,
      tokenMint,
      userTokenAccount,
      owner.publicKey,
      5000000_000_000,
    );
  }
  
  // Get current clock
  const currentClock = await context.banksClient.getClock();
  
  // Set initial clock
  context.setClock(
    new Clock(
      currentClock.slot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      BigInt(0),
    )
  );
  
  return {
    provider,
    context,
    tokenMint,
    owner,
    users,
    userTokenAccounts,
    ownerTokenAccount,
    currentClock,
  };
}

export function advanceClock(context: any, currentClock: any, timestamp: number) {
  context.setClock(
    new Clock(
      currentClock.slot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      BigInt(timestamp),
    )
  );
} 