import dotenv from "dotenv";
import jwt from "jsonwebtoken";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  databaseUrl: process.env.DATABASE_URL!,

  rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
  chainId: parseInt(process.env.CHAIN_ID || "84532", 10),
  explorerApiKey: process.env.EXPLORER_API_KEY || "",
  explorerApiUrl:
    process.env.EXPLORER_API_URL ||
    "https://base-sepolia.blockscout.com/api",

  encryptionKey: process.env.ENCRYPTION_KEY!,

  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: (process.env.JWT_EXPIRES_IN || "24h") as jwt.SignOptions["expiresIn"],
  },

  sweep: {
    threshold: process.env.SWEEP_THRESHOLD || "0.001",
    hotWalletAddress: process.env.HOT_WALLET_ADDRESS!,
    hotWalletPrivateKey: process.env.HOT_WALLET_PRIVATE_KEY!,
  },
};
