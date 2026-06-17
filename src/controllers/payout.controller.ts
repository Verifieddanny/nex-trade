import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as payoutService from "../services/payout.service";

export async function payout(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { toAddress, amount } = req.body;

    if (!toAddress || !amount) {
      res.status(400).json({ error: "toAddress and amount are required" });
      return;
    }

    const result = await payoutService.processPayout(
      req.userId!,
      toAddress,
      amount
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}
