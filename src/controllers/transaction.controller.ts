import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { transactions } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userTxs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, req.userId!))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    res.json(userTxs);
  } catch (error) {
    next(error);
  }
}

export async function getById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, req.params.id as string))
      .limit(1);

    if (!tx || tx.userId !== req.userId) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    res.json(tx);
  } catch (error) {
    next(error);
  }
}
