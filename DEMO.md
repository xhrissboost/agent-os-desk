# DEMO.md — 60-second video script

Film a **terminal**. Node 22. **No Binance login.** Track A ($20k USDC). Product name: **Desk**. Loop nickname: **ScoutPay**.

Do **not** execute live trades. **Sub-account only** — no withdrawal scope, no main-account balances on camera.

**Track B** is a **separate** first-10k race: connect MCP and complete authorized **spot + futures + convert** with ~80 USDT in the Agentic sub. Do **not** run Track B trades in this repo or on this recording.

---

## 0:00–0:05  Title

On screen:

```bash
node -v && npm run demo
```

Say:

> Desk. ScoutPay loop. We read a BTC calibration panel, pay another agent for a gated memo, then park a min-notional BNB spot buy and leftover USDT as an Earn intent. Dry-run. No login.

---

## 0:05–0:12  BTC calibration heatmap

Keep **1. DATA  Alpha Report** on screen. Point at `标的 BTC`, a 5×5 grid, `predicted% → realized%`, bilingual status colors.

Say:

> Data is a live BTCUSDT one-hour calibration dashboard. Walk-forward. Green is 基本靠谱. We pick the model with the most reliable cells — trade ticket stays BNBUSDT.

Optional cutaway: `artifacts/btc-calibration.md` in the repo after the run.

---

## 0:12–0:22  402 → memo

Scroll to **2. PAY**. Point at `402` then `memo`.

Say:

> Counterparty sells the memo. HTTP 402, we attach PAYMENT-SIGNATURE, twenty-five cents, under the one-dollar cap and the twenty-dollar daily x402 wallet cap. Local merchant — no partner key.

---

## 0:22–0:38  Restated BNBUSDT BUY MARKET

Scroll to **3. TRADE**. Point at `TICKET` and `payload`.

Say:

> Restated ticket: BNBUSDT buy market, quote order qty from exchangeInfo min notional — five USDT today, queried, not hardcoded. Confirm-spot is off. Dry-run. We do not send.

---

## 0:38–0:52  DeFi deposit preview

Scroll to **4. ONCHAIN**.

Say:

> Leftover USDT, one to five dollars, as a DeFi Earn deposit intent. baw defi preview shape. Wallet skill is not required. Confirm-defi is off.

---

## 0:52–0:60  Four ticks + GitHub

Scroll to **CHECKLIST** and the `github` line. Point at the BTC calibration tick.

Say:

> Fail-closed checklist, including the short-horizon overconfidence gate. Confirms are never skipped. Sub-account only, no withdrawal scope. Track B is a different race. github.com/xhrissboost/agent-os-desk

Cut.

---

## Shot list

| Time | Must show |
|---|---|
| 0–5 | `npm run demo` · Desk / ScoutPay |
| 5–12 | `标的 BTC` · 5×5 heatmap · `基本靠谱` / `明显高估` |
| 12–22 | `402` · `memo` · `$0.25` |
| 22–38 | `BNBUSDT  BUY  MARKET` · `quoteOrderQty` |
| 38–52 | `earn-deposit` · `baw defi preview` |
| 52–60 | checklist ticks · `github.com/xhrissboost/agent-os-desk` |

Do not export API keys, `.env` secrets, a funded main account, or a withdrawal screen.
