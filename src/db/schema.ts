import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  pgEnum,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "payout",
  "sweep",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "confirming",
  "completed",
  "failed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    address: varchar("address", { length: 42 }).notNull().unique(),
    encryptedPrivateKey: text("encrypted_private_key").notNull(),
    lastKnownBalance: numeric("last_known_balance", { precision: 36, scale: 18 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("wallets_user_id_idx").on(table.userId)]
);

export const balances = pgTable(
  "balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),
    amount: numeric("amount", { precision: 36, scale: 18 })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("balances_user_id_idx").on(table.userId)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    amount: numeric("amount", { precision: 36, scale: 18 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }),
    fromAddress: varchar("from_address", { length: 42 }),
    toAddress: varchar("to_address", { length: 42 }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_tx_hash_idx").on(table.txHash),
    index("transactions_status_idx").on(table.status),
  ]
);
