import { Router } from "express";
import { authenticate } from "../middleware/auth";
import authRoutes from "./auth.routes";
import walletRoutes from "./wallet.routes";
import depositRoutes from "./deposit.routes";
import payoutRoutes from "./payout.routes";
import sweepRoutes from "./sweep.routes";
import transactionRoutes from "./transaction.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/wallets", authenticate, walletRoutes);
router.use("/deposits", depositRoutes);
router.use("/payouts", authenticate, payoutRoutes);
router.use("/sweep", sweepRoutes);
router.use("/transactions", authenticate, transactionRoutes);

export default router;
