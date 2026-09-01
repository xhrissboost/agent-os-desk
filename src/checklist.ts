import { MAJOR_PAIRS, X402_MAX_USD } from "./config.js";
import { quotePlusFees } from "./market/filters.js";
import { FEE_BUFFER_USDT, TAKER_FEE_BPS } from "./config.js";
import type {
  AlphaReport,
  Checklist,
  ChecklistItem,
  Confirms,
  PaymentRun,
  TokenAudit,
} from "./types.js";

export function isMajorPair(symbol: string): boolean {
  return (MAJOR_PAIRS as readonly string[]).includes(symbol);
}

export function auditBlocksLive(audit: TokenAudit): boolean {
  if (audit.honeypot) return true;
  const lvl = (audit.riskLevelEnum ?? "").toUpperCase();
  if (lvl === "HIGH" || lvl === "CRITICAL") return true;
  if ((audit.riskLevel ?? 0) >= 4) return true;
  return false;
}

export function buildChecklist(opts: {
  symbol: string;
  report: AlphaReport;
  payment: PaymentRun;
  confirms: Confirms;
  live: boolean;
}): Checklist {
  const { symbol, report, payment, confirms, live } = opts;
  const needed = quotePlusFees(report.filters.minNotional, TAKER_FEE_BPS, FEE_BUFFER_USDT);
  const tickerOk = Boolean(report.row.ticker.lastPrice) && Number.isFinite(report.row.ticker.priceChangePercent);
  const auditOk = !auditBlocksLive(report.audit);
  const x402Ok = payment.amountUsd > 0 && payment.amountUsd <= X402_MAX_USD && payment.readyToSign;
  const liveUsdtOk = !live || report.portfolio.usdtFree >= needed;

  const items: ChecklistItem[] = [
    {
      id: "major-pair",
      ok: isMajorPair(symbol),
      gate: true,
      label: "major CEX pair only",
      detail: isMajorPair(symbol)
        ? `${symbol} is on the allowlist (${MAJOR_PAIRS.join(", ")}). No meme live orders.`
        : `${symbol} is not a major CEX pair — live orders blocked.`,
    },
    {
      id: "audit",
      ok: auditOk,
      gate: true,
      label: "audit not HIGH / not honeypot",
      detail: report.audit.honeypot
        ? "honeypot hit — fail closed"
        : report.audit.hasResult && report.audit.isSupported
          ? `audit ${report.audit.riskLevelEnum ?? "n/a"} lvl ${report.audit.riskLevel ?? "?"} (${report.audit.source.kind})`
          : `audit unavailable (${report.audit.source.kind}) — not HIGH, not honeypot; still fail-closed on HIGH if a later print hits`,
    },
    {
      id: "ticker",
      ok: tickerOk,
      gate: true,
      label: "ticker+24h returned",
      detail: tickerOk
        ? `${symbol} last ${report.row.ticker.lastPrice}  24h ${report.row.ticker.priceChangePercent}%  src ${report.row.source.host ?? report.row.source.kind}`
        : "ticker/24h missing",
    },
    {
      id: "btc-calibration",
      ok: report.calibration.gateOk,
      gate: true,
      label: "BTC calibration not majority 明显高估 on short horizon",
      detail: report.calibration.gateDetail,
    },
    {
      id: "spot-usdt",
      ok: liveUsdtOk,
      gate: live,
      label: "Spot USDT ≥ min notional + fees",
      detail: live
        ? `Agentic-sub USDT ${report.portfolio.usdtFree} vs need ${needed.toFixed(2)} (min ${report.filters.minNotional} + fees). Never main-account.`
        : `DRY-RUN — live USDT check skipped. Sample sub book ${report.portfolio.usdtFree} USDT; need ${needed.toFixed(2)} if live.`,
    },
    {
      id: "x402",
      ok: x402Ok,
      gate: true,
      label: `x402 amountUsd ≤ ${X402_MAX_USD.toFixed(2)} and READY_TO_SIGN`,
      detail: `amountUsd=${payment.amountUsd.toFixed(2)} ready=${payment.readyToSign} rail=${payment.rail}`,
    },
    {
      id: "confirm-pay",
      ok: confirms.pay,
      gate: true,
      label: "CONFIRM pay  (--confirm-pay)",
      detail: confirms.pay ? "operator confirmed the x402 payment" : "not set — fail closed. Never skipped.",
    },
    {
      id: "confirm-spot",
      ok: confirms.spot,
      gate: true,
      label: "CONFIRM spot (--confirm-spot)",
      detail: confirms.spot ? "operator confirmed the SPOT MARKET ticket" : "not set — fail closed. Never skipped.",
    },
    {
      id: "confirm-defi",
      ok: confirms.defi,
      gate: true,
      label: "CONFIRM defi (--confirm-defi)",
      detail: confirms.defi ? "operator confirmed the Earn deposit intent" : "not set — fail closed. Never skipped.",
    },
  ];

  const hardPass = items.filter((i) => i.gate).every((i) => i.ok);
  return { items, hardPass, liveBlocked: live && !hardPass };
}
