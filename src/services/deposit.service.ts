import { db } from "../db";
import { wallets, balances, transactions } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler";

export async function recordDeposit(
  toAddress: string,
  txHash: string,
  amount: string,
  fromAddress: string
) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.address, toAddress))
    .limit(1);

  if (!wallet) {
    throw new AppError(404, "No wallet found for this address");
  }

  const existingTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.txHash, txHash))
    .limit(1);

  if (existingTx.length > 0) {
    throw new AppError(409, "Transaction already recorded");
  }

  const [tx] = await db
    .insert(transactions)
    .values({
      userId: wallet.userId,
      type: "deposit",
      status: "completed",
      amount,
      txHash,
      fromAddress,
      toAddress,
    })
    .returning();

  await db
    .update(balances)
    .set({
      amount: sql`${balances.amount}::numeric + ${amount}::numeric`,
      updatedAt: new Date(),
    })
    .where(eq(balances.userId, wallet.userId));

  return tx;
}
