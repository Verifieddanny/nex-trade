import { Request, Response, NextFunction } from "express";
import { sweepAllWallets } from "../services/sweep.service";

export async function sweep(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await sweepAllWallets();
    res.json({ swept: results });
  } catch (error) {
    next(error);
  }
}
