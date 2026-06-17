import { db } from "../db";
import { eq } from "drizzle-orm";
import { wallets, transactions } from "../db/schema";
import { decrypt } from "../utils/encryption";
import { getBalance, sendTransaction, getProvider } from "../utils/blockchain";
import { config } from "../config";
import { ethers } from "ethers";

export async function sweepAllWallets() {
  const allWallets = await db.select().from(wallets);
  const results: { address: string; status: string; txHash?: string }[] = [];

  for (const wallet of allWallets) {
    try {
      const balance = await getBalance(wallet.address);
      const balanceWei = ethers.parseEther(balance);
      const thresholdWei = ethers.parseEther(config.sweep.threshold);

      if (balanceWei <= thresholdWei) {
        results.push({ address: wallet.address, status: "skipped" });
        continue;
      }

      const privateKey = decrypt(wallet.encryptedPrivateKey);
      const provider = getProvider();
      const gasPrice = (await provider.getFeeData()).gasPrice || 0n;
      const gasLimit = 21000n;
      const gasCost = gasPrice * gasLimit;
      const sweepAmount = balanceWei - gasCost;

      if (sweepAmount <= 0n) {
        results.push({
          address: wallet.address,
          status: "skipped_gas",
        });
        continue;
      }

      const txResponse = await sendTransaction(
        privateKey,
        config.sweep.hotWalletAddress,
        ethers.formatEther(sweepAmount)
      );

      await db.insert(transactions).values({
        userId: wallet.userId,
        type: "sweep",
        status: "confirming",
        amount: ethers.formatEther(sweepAmount),
        txHash: txResponse.hash,
        fromAddress: wallet.address,
        toAddress: config.sweep.hotWalletAddress,
      });

      const newOnChainBalance = await getBalance(wallet.address);
      await db
        .update(wallets)
        .set({ lastKnownBalance: newOnChainBalance })
        .where(eq(wallets.id, wallet.id));

      results.push({
        address: wallet.address,
        status: "swept",
        txHash: txResponse.hash,
      });
    } catch (error) {
      console.error(`Sweep failed for ${wallet.address}:`, error);
      results.push({ address: wallet.address, status: "failed" });
    }
  }

  return results;
}
