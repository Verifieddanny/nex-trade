import { ethers } from "ethers";
import { db } from "../db";
import { wallets, balances, transactions } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { decrypt } from "../utils/encryption";
import { sendTransaction, getBalance } from "../utils/blockchain";
import { AppError } from "../middleware/errorHandler";

export async function processPayout(
  userId: string,
  toAddress: string,
  amount: string
) {
  const [balance] = await db
    .select()
    .from(balances)
    .where(eq(balances.userId, userId))
    .limit(1);

  if (!balance || parseFloat(balance.amount) < parseFloat(amount)) {
    throw new AppError(400, "Insufficient balance");
  }

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  if (!wallet) {
    throw new AppError(404, "No wallet found");
  }

  const [tx] = await db
    .insert(transactions)
    .values({
      userId,
      type: "payout",
      status: "pending",
      amount,
      fromAddress: wallet.address,
      toAddress,
    })
    .returning();

  if (!tx) {
    throw new AppError(500, "Failed to create transaction record");
  }

  try {
    const privateKey = decrypt(wallet.encryptedPrivateKey);
    const txResponse = await sendTransaction(privateKey, toAddress, amount);

    await db
      .update(transactions)
      .set({
        status: "confirming",
        txHash: txResponse.hash,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    await db
      .update(balances)
      .set({
        amount: sql`${balances.amount}::numeric - ${amount}::numeric`,
        updatedAt: new Date(),
      })
      .where(eq(balances.userId, userId));

    const receipt = await txResponse.wait();

    if (receipt?.status === 1) {
      await db
        .update(transactions)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(transactions.id, tx.id));
    } else {
      await db
        .update(transactions)
        .set({
          status: "failed",
          failureReason: "Transaction reverted",
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, tx.id));

      await db
        .update(balances)
        .set({
          amount: sql`${balances.amount}::numeric + ${amount}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(balances.userId, userId));
    }

    const newOnChainBalance = await getBalance(wallet.address);
    await db
      .update(wallets)
      .set({ lastKnownBalance: newOnChainBalance })
      .where(eq(wallets.id, wallet.id));

    return {
      ...tx,
      txHash: txResponse.hash,
      status: receipt?.status === 1 ? "completed" : "failed",
    };
  } catch (error) {
    await db
      .update(transactions)
      .set({
        status: "failed",
        failureReason:
          error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    const newOnChainBalance = await getBalance(wallet.address);
    await db
      .update(wallets)
      .set({ lastKnownBalance: newOnChainBalance })
      .where(eq(wallets.id, wallet.id));

    throw new AppError(500, "Payout transaction failed");
  }
}
