import { ethers } from "ethers";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { wallets, balances, transactions } from "../db/schema";
import { getProvider } from "../utils/blockchain";
import { config } from "../config";

let isRunning = false;

const POLL_INTERVAL = 5000;

export async function startListener() {
  if (isRunning) return;
  isRunning = true;

  console.log(`Deposit listener started (polling every ${POLL_INTERVAL / 1000}s)`);

  while (isRunning) {
    try {
      await checkAllWallets();
    } catch (error) {
      console.error("Listener error:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

export function stopListener() {
  isRunning = false;
  console.log("Deposit listener stopped");
}

interface TxDetail {
  txHash: string | null;
  fromAddress: string | null;
  amount: string;
}

async function fetchRecentInternalTxs(address: string): Promise<TxDetail[]> {
  const params = new URLSearchParams({
    module: "account",
    action: "txlistinternal",
    address,
    sort: "desc",
    page: "1",
    offset: "10",
  });

  if (config.explorerApiKey) {
    params.set("apikey", config.explorerApiKey);
  }

  try {
    const res = await fetch(`${config.explorerApiUrl}?${params}`);
    const data: any = await res.json();

    if (data.status !== "1" || !Array.isArray(data.result)) return [];

    return data.result
      .filter((tx: any) => tx.to?.toLowerCase() === address.toLowerCase())
      .map((tx: any) => ({
        txHash: tx.hash || null,
        fromAddress: tx.from || null,
        amount: ethers.formatEther(tx.value),
      }));
  } catch (error) {
    console.error(`Explorer API error for ${address}:`, error);
    return [];
  }
}

async function fetchRecentNormalTxs(address: string): Promise<TxDetail[]> {
  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    sort: "desc",
    page: "1",
    offset: "10",
  });

  if (config.explorerApiKey) {
    params.set("apikey", config.explorerApiKey);
  }

  try {
    const res = await fetch(`${config.explorerApiUrl}?${params}`);
    const data: any = await res.json();

    if (data.status !== "1" || !Array.isArray(data.result)) return [];

    return data.result
      .filter(
        (tx: any) =>
          tx.to?.toLowerCase() === address.toLowerCase() &&
          tx.value !== "0"
      )
      .map((tx: any) => ({
        txHash: tx.hash || null,
        fromAddress: tx.from || null,
        amount: ethers.formatEther(tx.value),
      }));
  } catch (error) {
    console.error(`Explorer API error for ${address}:`, error);
    return [];
  }
}

async function checkAllWallets() {
  const allWallets = await db.select().from(wallets);
  if (allWallets.length === 0) return;

  const provider = getProvider();

  for (const wallet of allWallets) {
    try {
      const onChainBalanceWei = await provider.getBalance(wallet.address);
      const onChainBalance = ethers.formatEther(onChainBalanceWei);

      const lastKnown = parseFloat(wallet.lastKnownBalance);
      const current = parseFloat(onChainBalance);

      if (current > lastKnown) {
        const depositAmount = (current - lastKnown).toFixed(18);

        console.log(
          `Deposit detected: ${depositAmount} ETH to ${wallet.address} (balance: ${lastKnown} -> ${current})`
        );

        const recentTxs = [
          ...(await fetchRecentInternalTxs(wallet.address)),
          ...(await fetchRecentNormalTxs(wallet.address)),
        ];

        const matchedTx = recentTxs.find((tx) => {
          const txAmount = parseFloat(tx.amount);
          const deposit = parseFloat(depositAmount);
          return Math.abs(txAmount - deposit) < 0.000000001;
        });

        const existingTx = matchedTx?.txHash
          ? await db
              .select({ id: transactions.id })
              .from(transactions)
              .where(eq(transactions.txHash, matchedTx.txHash))
              .limit(1)
          : [];

        if (existingTx.length > 0) {
          console.log(`Skipping duplicate tx: ${matchedTx!.txHash!.slice(0, 16)}...`);
          await db
            .update(wallets)
            .set({ lastKnownBalance: onChainBalance })
            .where(eq(wallets.id, wallet.id));
          continue;
        }

        await db.insert(transactions).values({
          userId: wallet.userId,
          type: "deposit",
          status: "completed",
          amount: depositAmount,
          txHash: matchedTx?.txHash || null,
          fromAddress: matchedTx?.fromAddress || null,
          toAddress: wallet.address,
        });

        await db
          .update(balances)
          .set({
            amount: sql`${balances.amount}::numeric + ${depositAmount}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(balances.userId, wallet.userId));

        await db
          .update(wallets)
          .set({ lastKnownBalance: onChainBalance })
          .where(eq(wallets.id, wallet.id));

        console.log(
          `Balance credited: ${depositAmount} ETH for user ${wallet.userId}` +
            (matchedTx?.txHash ? ` (tx: ${matchedTx.txHash.slice(0, 16)}...)` : "")
        );
      } else if (current < lastKnown) {
        await db
          .update(wallets)
          .set({ lastKnownBalance: onChainBalance })
          .where(eq(wallets.id, wallet.id));
      }
    } catch (error) {
      console.error(`Failed to check wallet ${wallet.address}:`, error);
    }
  }
}
