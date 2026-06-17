import { db } from "../db";
import { wallets, balances, transactions } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { generateWallet, getBalance } from "../utils/blockchain";
import { encrypt } from "../utils/encryption";
import { AppError } from "../middleware/errorHandler";

export async function createWallet(userId: string) {
  const existing = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(409, "User already has a wallet");
  }

  const { address, privateKey } = generateWallet();
  const encryptedPrivateKey = encrypt(privateKey);

  const [wallet] = await db
    .insert(wallets)
    .values({ userId, address, encryptedPrivateKey })
    .returning({ id: wallets.id, address: wallets.address });

  return wallet;
}

export async function getWallet(userId: string) {
  const [wallet] = await db
    .select({ id: wallets.id, address: wallets.address })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  if (!wallet) {
    throw new AppError(404, "No wallet found. Create one first.");
  }

  const onChainBalance = await getBalance(wallet.address);

  const [balance] = await db
    .select()
    .from(balances)
    .where(eq(balances.userId, userId))
    .limit(1);

  return {
    ...wallet,
    onChainBalance,
    internalBalance: balance?.amount || "0",
  };
}

export async function syncBalance(userId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  if (!wallet) {
    throw new AppError(404, "No wallet found");
  }

  const onChainBalance = await getBalance(wallet.address);

  const [balance] = await db
    .select()
    .from(balances)
    .where(eq(balances.userId, userId))
    .limit(1);

  const internal = parseFloat(balance?.amount || "0");
  const onChain = parseFloat(onChainBalance);
  const diff = onChain - internal;

  if (Math.abs(diff) < 0.000000000000000001) {
    return {
      status: "in_sync",
      internalBalance: balance?.amount || "0",
      onChainBalance,
    };
  }

  if (diff > 0) {
    await db.insert(transactions).values({
      userId,
      type: "deposit",
      status: "completed",
      amount: diff.toFixed(18),
      fromAddress: null,
      toAddress: wallet.address,
    });

    await db
      .update(balances)
      .set({
        amount: onChainBalance,
        updatedAt: new Date(),
      })
      .where(eq(balances.userId, userId));
  } else {
    await db
      .update(balances)
      .set({
        amount: onChainBalance,
        updatedAt: new Date(),
      })
      .where(eq(balances.userId, userId));
  }

  await db
    .update(wallets)
    .set({ lastKnownBalance: onChainBalance })
    .where(eq(wallets.id, wallet.id));

  return {
    status: "synced",
    previousBalance: balance?.amount || "0",
    newBalance: onChainBalance,
    adjustment: diff.toFixed(18),
  };
}
