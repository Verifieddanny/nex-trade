import { Request, Response, NextFunction } from "express";
import * as depositService from "../services/deposit.service";

export async function recordDeposit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { toAddress, txHash, amount, fromAddress } = req.body;

    if (!toAddress || !txHash || !amount || !fromAddress) {
      res
        .status(400)
        .json({ error: "toAddress, txHash, amount, and fromAddress are required" });
      return;
    }

    const tx = await depositService.recordDeposit(
      toAddress,
      txHash,
      amount,
      fromAddress
    );
    res.status(201).json(tx);
  } catch (error) {
    next(error);
  }
}
