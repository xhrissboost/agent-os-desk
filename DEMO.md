# DEMO.md — 60-second video script

Film a terminal. Node 22. No Binance login. This is **Track A** (build an AI agent, $20k USDC). Do not execute live trades.

**Track B** (Connect to MCP, $40k USDC) is a separate prize for completing authorized **spot + futures + margin/convert** via the Binance MCP server. Mention it at the end as a follow-up once OAuth is connected. Do **not** send live orders in this recording.

---

## 0:00–0:08  Title

On screen:

```bash
node -v    # v22.x
```

Say:

> Desk is a confirm-first Agent Native desk. One blotter: analysis, a risk-capped signal, an agent-to-agent B402 receipt, then an onchain DeFi intent. Dry-run by default. No login.

---

## 0:08–0:20  Install + judge path

On screen:

```bash
npm install && npm run demo
```

Wait for the four headings. Scroll if needed so all four are visible.

Say:

> npm run demo hits all four Track A categories. Public REST for BTC, ETH, and SOL — price, 24h, book imbalance, klines, funding, and a sample portfolio. No API keys.

---

## 0:20–0:32  Signal

Keep the **TRADING WORKFLOWS** block on screen. Point at `SIGNAL`, `confidence`, `payload`.

Say:

> The strategy fades crowded funding plus book imbalance, with a 250-dollar notional cap and 5 percent of the book. The executor prints an MCP trade payload. It does not send. Live would need DESK_LIVE=1, --confirm, and a bound trade tool — we are not doing that.

---

## 0:32–0:46  Pay + onchain

Scroll to **PAYMENT WORKFLOWS** then **ONCHAIN WORKFLOWS**.

Say:

> Desk pays a Counterparty agent for a signal receipt. We discover the public B402 bazaar, take the HTTP 402, and settle locally on BSC testnet chain 97. No merchant partner key.

> Then we inspect USDT on BSC through the Skills Hub adapters, read the audit, and propose a testnet LP add. The wallet skill is not required. Still dry-run.

---

## 0:46–0:60  Close / Track B

On screen (optional second command):

```bash
npx desk mcp-status
```

Say:

> MCP is off in this clone — that's expected. Track B is connecting this same desk to Binance MCP for spot, USD-M and COIN-M futures, margin, and convert, still confirm-first, still no withdrawals. Desk stops here so the judge can clone and run in under two minutes.

Cut.

---

## Shot list (if you need a second take)

| Time | Command | Must show |
|---|---|---|
| 0:08 | `npm run demo` | Headings 1–4 |
| 0:20 | (same output) | `SIGNAL` + `DRY-RUN` payload |
| 0:32 | (same output) | `402` + `receipt` + `chain 97` |
| 0:40 | (same output) | token address + `intent lp-add` |
| 0:50 | `desk mcp-status` | `authenticated=false` |

Do not export API keys, `.env` secrets, or a funded sub-account on camera.
