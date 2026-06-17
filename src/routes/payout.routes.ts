import { Router } from "express";
import * as payoutController from "../controllers/payout.controller";

const router = Router();

router.post("/", payoutController.payout);

export default router;
