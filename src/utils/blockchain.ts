import { ethers } from "ethers";
import { config } from "../config";

let provider: ethers.JsonRpcProvider;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return provider;
}

export function generateWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export function getWalletFromKey(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey, getProvider());
}

export async function getBalance(address: string): Promise<string> {
  const balance = await getProvider().getBalance(address);
  return ethers.formatEther(balance);
}

export async function sendTransaction(
  privateKey: string,
  to: string,
  amountEther: string
): Promise<ethers.TransactionResponse> {
  const wallet = getWalletFromKey(privateKey);
  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(amountEther),
  });
  return tx;
}
