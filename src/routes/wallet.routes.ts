import { Router } from "express";
import * as walletController from "../controllers/wallet.controller";

const router = Router();

router.post("/", walletController.create);
router.get("/", walletController.get);
router.post("/sync", walletController.sync);

export default router;
