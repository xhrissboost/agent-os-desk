---
name: desk
description: >
  Confirm-first Binance Agent Native desk. Use when the user wants a market
  briefing, a risk-capped trade signal, an agent-to-agent B402/x402 payment
  trace, or a dry-run onchain DeFi intent. Run `npx desk demo` for all four
  Track A workflows. Never place live orders unless DESK_LIVE=1 and the user
  passed --confirm and a Binance MCP trade tool is bound.
metadata:
  version: "1.0.0"
  author: desk
license: MIT
---

# Desk

Desk is a TypeScript agent (`@desk/agent`) for Binance **Agent Native / Binance MCP Server** (campaign name: Agent OS).

## When to use

| User intent | Command |
|---|---|
| Full Track A blotter | `npx desk demo` |
| Reports / market analysis / portfolio insights | `npx desk brief` |
| Signals / strategy / automated action (dry-run) | `npx desk signal` |
| Agent-to-agent payment / x402 / B402 | `npx desk pay` |
| Staking / DeFi / onchain inspect | `npx desk chain` |
| Is Binance MCP connected? | `npx desk mcp-status` |

## Hard rules

- Not financial advice.
- Default is dry-run. Do **not** set `DESK_LIVE=1` unless the user explicitly asks to send, and even then require `--confirm`.
- Never withdraw. Never pull from the user's main Binance account.
- Do not invent MCP tool names. If `desk mcp-status` shows no tools, stay on public REST.
- Do not call authenticated `/papi/v2/b402/{supported,verify,settle}` (no partner key).
- Onchain writes go through `baw` from `binance-agentic-wallet` only after a clear "yes". `desk chain` itself is dry-run.

## Install

```bash
npm install
npm run demo
```

MCP connect snippets live in `CONNECT.md` (Claude Code, Codex `--oauth-client-id codex`, VS Code HTTP MCP, Grok Bot `oauth_client_id = grok`).

Skills Hub:

```bash
npx skills add https://github.com/binance/binance-skills-hub
```
