import { Router } from "express";
import * as depositController from "../controllers/deposit.controller";

const router = Router();

router.post("/",  depositController.recordDeposit);

export default router;
