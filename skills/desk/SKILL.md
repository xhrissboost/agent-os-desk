---
name: desk
description: >
  Confirm-first Binance Agent Native desk. ScoutPay loop: BTCUSDT
  calibration heatmap, pay a counterparty via x402 for a gated memo,
  restate a min-notional BNBUSDT SPOT MARKET buy, park leftover USDT
  as an Earn intent. Run `npx desk demo`. Never skip --confirm-pay /
  --confirm-spot / --confirm-defi. Never place live orders unless
  DESK_LIVE=1 and those confirms are set and a trade tool is bound.
metadata:
  version: "1.2.0"
  author: desk
license: MIT
---

# Desk

Desk is a TypeScript agent (`@desk/agent`) for Binance **Agent Native / Binance MCP Server** (campaign name: Agent OS). The commerce loop nickname is **ScoutPay** — do not rename the package.

## When to use

| User intent | Command |
|---|---|
| Full ScoutPay loop | `npx desk demo` |
| BTC calibration heatmap | `npx desk brief` |
| Min-notional SPOT ticket | `npx desk signal` |
| 402 → gated memo | `npx desk pay` |
| Earn deposit intent | `npx desk chain` |
| Is Binance MCP connected? | `npx desk mcp-status` |

## Hard rules

- Not financial advice.
- Default is dry-run. Confirms are **three separate flags**. A bare `--confirm` is ignored.
- Never withdraw. Never pull from the main Binance account. Never show main-account balances as if they were the agent's.
- Do not invent MCP tool names.
- Do not call authenticated `/papi/v2/b402/{supported,verify,settle}`.
- Track B (spot + futures + convert, ~80 USDT in the Agentic sub) is a **separate** first-10k race. Do not execute it from this repo.

## Install

```bash
npm install
npm run demo
```
