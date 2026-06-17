import { db } from "../db";
import { users, balances } from "../db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { createWallet } from "./wallet.service";

export async function register(email: string, password: string) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await Bun.password.hash(password);

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id, email: users.email });

  if (!user) {
    throw new AppError(500, "Failed to create user");
  }

  await db.insert(balances).values({ userId: user.id });

  const wallet = await createWallet(user.id);

  const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  return { user, wallet, token };
}

export async function login(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new AppError(401, "Invalid credentials");
  }

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid credentials");
  }

  const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  return { user: { id: user.id, email: user.email }, token };
}
