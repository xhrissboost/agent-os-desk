# Desk

**Desk** (`@desk/agent`) is a confirm-first TypeScript agent for the Binance Agent OS Mini Hackathon **Track A** ($20,000 USDC). The judge path is one commerce loop — research nickname **ScoutPay** (the package is still Desk):

**Alpha Report → pay another agent for a gated memo (HTTP 402) → min-notional BNBUSDT SPOT MARKET ticket → leftover USDT as a DeFi Earn deposit intent.**

Fail-closed checklist. Three separate confirms (`--confirm-pay`, `--confirm-spot`, `--confirm-defi`). Confirms are never skipped. Dry-run by default.

Judges: `npm install && npm run demo` — no Binance login, no API keys, under two minutes.

Binance's public name for this stack is **Agent Native / Binance MCP Server**. "Agent OS" is the tweet / campaign branding. This repo uses both.

| Surface | Link |
|---|---|
| Agent Native MCP docs | https://developers.binance.com/en/docs/agent-native/mcp-server/agentic |
| MCP endpoint (streamable HTTP, OAuth, no API keys) | https://agent.binance.com/mcp/agentic |
| Skills Hub | https://github.com/binance/binance-skills-hub |
| B402 bazaar (public) | `https://www.binance.com/bapi/ramp/v1/public/ramp/b402/bazaar/{resources,search,merchant}` |

Connect a client: [CONNECT.md](./CONNECT.md). Film: [DEMO.md](./DEMO.md).

## Quickstart

Requires **Node 22+**.

```bash
npm install
npm run demo
```

CLI commands are entry points into the **same** loop:

```bash
npx desk brief          # Alpha Report (BNBUSDT)
npx desk pay            # 402 → PAYMENT-SIGNATURE → gated memo
npx desk signal         # restated min-notional SPOT MARKET ticket
npx desk chain          # DeFi Earn deposit INTENT
npx desk mcp-status     # MCP env/tools present?
```

`npm test`, `npm run build`, and `npm run lint` are wired for CI.

## Why this maps to Track A

Judges should see a **commerce loop**, not four disconnected modules. Desk buys research from a counterparty agent, then only if the checklist passes does it restate a min-notional major-pair spot buy and park leftover USDT as an Earn intent.

| Track A category | Where it lives | What `desk demo` does |
|---|---|---|
| Data & Analysis | `src/workflows/data.ts` | One-page **Alpha Report** for **BNBUSDT**: CEX ticker/24h/book/klines/funding via public REST, plus Skill Hub-style token audit / trading-signal (adapters or honest stubs) |
| Payment Workflows | `src/payments/merchant.ts` | Agent-to-agent **x402 v2** merchant. HTTP 402 → `PAYMENT-SIGNATURE` → gated Alpha Memo. Cap **$0.25** (≤ $1, well under the $20/day x402 wallet cap). Public B402 bazaar is scanned for ≤ $1 listings; without a partner settle key the **in-repo merchant** is the demo rail |
| Trading Workflows | `src/workflows/trading.ts` | **Only if research gates pass:** restated **BNBUSDT SPOT MARKET buy** at **exchangeInfo min notional** (5 USDT observed 2026-09-01; queried, not hardcoded). DRY-RUN. Live needs `DESK_LIVE=1` **and** `--confirm-spot` **and** a bound MCP trade tool |
| Onchain Workflows | `src/skills/hub.ts` | Park leftover **1–5 USDT** as a **DeFi Earn deposit INTENT** (`baw defi preview` shape). Dry-run unless the wallet skill is actually present — still not broadcast in this repo |

**Track B** is a **separate first-10k race** (spot + futures + convert, ~80 USDT in the Agentic sub, $40k USDC prize). This repo does **not** execute Track B trades. See [CONNECT.md](./CONNECT.md) and [DEMO.md](./DEMO.md).

## Architecture

```mermaid
flowchart TD
  CLI["desk demo"] --> Report["Alpha Report BNBUSDT"]
  Report --> Pay["HTTP 402 merchant"]
  Pay --> Memo["PAYMENT-SIGNATURE → gated memo"]
  Memo --> Check["Fail-closed checklist"]
  Check -->|gates pass| Ticket["Restate SPOT MARKET min notional"]
  Check -->|always| List["Print every checklist line"]
  Ticket --> Earn["Earn deposit INTENT 1–5 USDT"]
  Report --> REST["Public REST / MCP later"]
  Pay --> Bazaar["B402 bazaar scan ≤ $1"]
```

```
src/
  cli.ts                 desk demo | brief | pay | signal | chain | mcp-status
  workflows/demo.ts      ScoutPay loop (sequential)
  workflows/data.ts      Alpha Report
  workflows/trading.ts   min-notional SPOT BUY
  workflows/payments.ts  x402 merchant + bazaar scan
  workflows/onchain.ts   Earn deposit intent
  checklist.ts           fail-closed, print every line
  payments/merchant.ts   ~20-line x402 v2 demo merchant
  mcp/client.ts          capability bind — no invented tool names
```

`BinanceMcpClient` never hard-codes MCP tool names. Missing OAuth does not crash the demo.

## Checklist (fail closed)

Printed on every `desk demo`. A missing confirm is a **fail**, never an implicit yes. Bare `--confirm` is ignored.

- major CEX pair only (default BNBUSDT) — no meme live orders
- audit not HIGH / not honeypot
- ticker+24h returned
- (live path) Spot USDT ≥ min notional + fees on the **Agentic sub**
- x402 `amountUsd ≤ 1.00` and `READY_TO_SIGN`
- three separate confirms: pay, spot, defi

If later gates fail, Desk still shows the Alpha Report and the 402 receipt/memo when payment happened.

## Risk notes

- **Not financial advice.**
- **Dry-run default.** Live send requires `DESK_LIVE=1` **and** `--confirm-spot` **and** a bound trade tool. This repo still refuses to invent a tool name.
- **No withdrawals, ever.** Agentic virtual sub only. The agent cannot pull from main.
- **No mainnet money movement** in this demo. x402 is the in-repo merchant on chain 97. Earn is an intent.
- Sub-account funding is the max loss. Confirm-first is a pause, not a cap.

## License

MIT. See [LICENSE](./LICENSE).
