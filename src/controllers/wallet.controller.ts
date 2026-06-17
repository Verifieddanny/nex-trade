import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as walletService from "../services/wallet.service";

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const wallet = await walletService.createWallet(req.userId!);
    res.status(201).json(wallet);
  } catch (error) {
    next(error);
  }
}

export async function get(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const wallet = await walletService.getWallet(req.userId!);
    res.json(wallet);
  } catch (error) {
    next(error);
  }
}

export async function sync(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await walletService.syncBalance(req.userId!);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
