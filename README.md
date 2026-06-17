# NexTrade — Crypto-to-Fiat Backend MVP

A backend service handling the core money movement lifecycle on **Base Sepolia** (testnet): deposit, payout, and sweep operations for a crypto-to-fiat platform.

## Tech Stack

- **Runtime:** Bun
- **Framework:** Express.js (TypeScript)
- **Database:** PostgreSQL (Supabase)
- **ORM:** Drizzle ORM
- **Blockchain:** Base Sepolia (Chain ID: 84532) via ethers.js
- **Auth:** JWT
- **Security:** AES-encrypted private keys, Helmet, CORS, rate limiting

## Architecture

```
src/
├── config/          # Environment & app configuration
├── controllers/     # Request handlers
├── db/
│   ├── schema.ts    # Drizzle schema (users, wallets, balances, transactions)
│   └── index.ts     # Database connection
├── middleware/       # Auth (JWT) & error handling
├── routes/          # Express route definitions
├── services/        # Business logic (auth, wallet, deposit, payout, sweep, listener)
└── utils/           # Encryption (AES) & blockchain helpers
```

### Core Flows

1. **Deposit** — User receives crypto to their programmatically generated wallet. On-chain deposits are recorded and internal balances updated.
2. **Payout** — User withdraws crypto to an external address. Balance is checked, transaction is broadcast, and status is tracked through confirmation.
3. **Sweep** — Idle funds in user wallets are swept to a hot wallet when they exceed a configurable threshold (accounts for gas costs).

### Key Design Decisions

- **Single wallet per user** — simplifies address management and balance tracking
- **Internal balance ledger** — balances tracked in DB separate from on-chain state for speed and reliability
- **AES-encrypted private keys** — keys never stored in plaintext; decrypted only at transaction signing time
- **Seamless onboarding** — wallet is auto-created on registration; one API call to go from signup to deposit-ready
- **Idempotent deposits** — duplicate tx hashes are rejected to prevent double-crediting
- **Balance reconciliation** — `lastKnownBalance` tracking prevents the listener from misinterpreting payouts/sweeps as deposits; a manual sync endpoint handles edge cases
- **Failure handling** — payout failures roll back the internal balance deduction and record the failure reason; payout and sweep both update `lastKnownBalance` after on-chain transactions to keep the listener in sync

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- A [Supabase](https://supabase.com/) project (free tier works)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd NexTrade
bun install

# Configure environment
cp .env.example .env
# Fill in your Supabase DATABASE_URL, ENCRYPTION_KEY, JWT_SECRET, etc.

# Push schema to database
bun run db:migrate

# Start development server
bun run dev
```

## API Endpoints

### Auth
| Method | Endpoint              | Description                              | Auth |
|--------|----------------------|------------------------------------------|------|
| POST   | `/api/v1/auth/register` | Register user (auto-creates wallet)     | No   |
| POST   | `/api/v1/auth/login`    | Login, get JWT                          | No   |

Registration is a single-step onboarding: creates the user, initializes their balance, generates a wallet, and returns a JWT — the user gets their deposit address immediately.

### Wallets
| Method | Endpoint                | Description                              | Auth |
|--------|------------------------|------------------------------------------|------|
| GET    | `/api/v1/wallets`      | Get wallet + balances                    | Yes  |
| POST   | `/api/v1/wallets/sync` | Sync internal balance with on-chain      | Yes  |

### Deposits
| Method | Endpoint            | Description                          | Auth |
|--------|---------------------|--------------------------------------|------|
| POST   | `/api/v1/deposits`  | Record deposit (resolved by wallet address) | No |

Deposits are unauthenticated — the wallet address (`toAddress`) is used to resolve the user. The blockchain listener calls this same service internally when it detects incoming transactions.

### Payouts
| Method | Endpoint           | Description                     | Auth |
|--------|--------------------|---------------------------------|------|
| POST   | `/api/v1/payouts`  | Withdraw crypto to external addr| Yes  |

### Sweep
| Method | Endpoint               | Description                   | Auth |
|--------|------------------------|-------------------------------|------|
| POST   | `/api/v1/sweep/trigger` | Sweep all wallets to hot wallet | No*  |

*Sweep endpoint should be protected by an API key or admin auth in production.

### Transactions
| Method | Endpoint                    | Description            | Auth |
|--------|-----------------------------|------------------------|------|
| GET    | `/api/v1/transactions`      | List user transactions | Yes  |
| GET    | `/api/v1/transactions/:id`  | Get transaction by ID  | Yes  |

### Health
| Method | Endpoint   | Description    |
|--------|-----------|----------------|
| GET    | `/health` | Health check   |

## Testing the API

```bash
# Register (returns user, wallet address, and JWT in one call)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepass123"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepass123"}'

# Get wallet + balances
curl http://localhost:3000/api/v1/wallets \
  -H "Authorization: Bearer <token>"

# Sync internal balance with on-chain balance
curl -X POST http://localhost:3000/api/v1/wallets/sync \
  -H "Authorization: Bearer <token>"

# Record deposit (no auth — resolved by wallet address)
curl -X POST http://localhost:3000/api/v1/deposits \
  -H "Content-Type: application/json" \
  -d '{"toAddress": "0xUserWallet...", "txHash": "0x...", "amount": "0.01", "fromAddress": "0x..."}'

# Payout
curl -X POST http://localhost:3000/api/v1/payouts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"toAddress": "0x...", "amount": "0.005"}'

# Trigger sweep
curl -X POST http://localhost:3000/api/v1/sweep/trigger

# List transactions
curl http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer <token>"
```

## Blockchain Listener

The deposit listener starts automatically with the server and uses **balance-polling** rather than block scanning. Every 5 seconds, it:

1. Queries the on-chain balance of every user wallet via the RPC
2. Compares it against the `last_known_balance` stored in the DB
3. If the balance increased, queries Blockscout's API for recent transactions (both normal and internal) to resolve the tx hash and sender address
4. Records a deposit transaction with full details and credits the user's internal balance
5. Updates the `last_known_balance` to the current on-chain value
6. If the balance decreased (e.g. after a payout or sweep), updates `last_known_balance` without recording a deposit

**Why balance-polling instead of block scanning?** Block scanning (`getBlock` with prefetched transactions) only sees top-level EOA transactions. Smart contract wallets (ERC-4337, MetaMask smart accounts) produce **internal transactions** which don't appear in block data. Balance-polling catches all deposits regardless of how they arrive — regular transfers, internal transactions, or contract interactions. Blockscout's API is then used to enrich each detected deposit with the tx hash and sender address.

## Trade-offs

- **Synchronous payout** — the payout endpoint waits for on-chain confirmation. In production, this should be async with webhook/polling for status.
- **Sweep is manual** — triggered via API. Production would use a cron job.
- **Single chain** — scoped to Base Sepolia as required. Architecture supports multi-chain extension.
- **Balance-polling + Blockscout enrichment** — polling balances catches all deposit types (including internal txs from smart wallets). Blockscout API resolves tx hashes and sender addresses. The Blockscout API key is optional but recommended to avoid rate limits.
