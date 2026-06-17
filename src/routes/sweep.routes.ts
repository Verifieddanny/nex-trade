import { Router } from "express";
import * as sweepController from "../controllers/sweep.controller";

const router = Router();

router.post("/trigger", sweepController.sweep);

export default router;
