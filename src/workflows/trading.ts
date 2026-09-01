import { DEFAULT_SYMBOL, RISK } from "../config.js";
import { clamp, round } from "../http.js";
import { defaultVenue } from "../mcp/client.js";
import { quotePlusFees } from "../market/filters.js";
import { FEE_BUFFER_USDT, TAKER_FEE_BPS } from "../config.js";
import type {
  AlphaReport,
  Checklist,
  ExecutionResult,
  Signal,
  Side,
  TradeIntent,
} from "../types.js";
import { runAlphaReport } from "./data.js";

export type SignalInputs = {
  symbol: string;
  lastPrice: number;
  fundingRate: number;
  imbalance: number;
  change24hPct: number;
  portfolioUsd: number;
};

export function scoreRaw(fundingRate: number, imbalance: number): number {
  const fundingScore = clamp(fundingRate / RISK.fundingScale, -1, 1);
  const imbalanceScore = clamp(imbalance, -1, 1);
  return -(RISK.fundingWeight * fundingScore + RISK.imbalanceWeight * imbalanceScore);
}

export function sideFromScore(raw: number, confidenceFloor = RISK.minConfidence): Side {
  const confidence = Math.min(1, Math.abs(raw));
  if (confidence < confidenceFloor) return "HOLD";
  if (raw > RISK.sideDeadband) return "BUY";
  if (raw < -RISK.sideDeadband) return "SELL";
  return "HOLD";
}

export function computeSignal(input: SignalInputs): Signal {
  const raw = scoreRaw(input.fundingRate, input.imbalance);
  let side = sideFromScore(raw);
  let skipped = false;
  let skipReason: string | undefined;

  if (Math.abs(input.fundingRate) > RISK.maxAbsFunding) {
    side = "HOLD";
    skipped = true;
    skipReason = `funding ${input.fundingRate} exceeds |${RISK.maxAbsFunding}| hard cap`;
  }

  const confidence = skipped ? 0 : Math.min(1, Math.abs(raw));
  if (!skipped && confidence < RISK.minConfidence) {
    side = "HOLD";
  }

  const byNotional = RISK.maxNotionalUsd * Math.max(confidence, 0.15);
  const byBook = input.portfolioUsd * RISK.maxPortfolioPct;
  const quoteUsd = round(Math.min(byNotional, byBook), 2);
  const cappedBy =
    byBook <= byNotional ? `portfolio ${RISK.maxPortfolioPct * 100}% cap` : `max notional $${RISK.maxNotionalUsd}`;
  const baseQty = input.lastPrice ? round(quoteUsd / input.lastPrice, 8) : 0;

  const rationale = skipped
    ? skipReason
    : [
        `fade crowded ${input.fundingRate >= 0 ? "longs" : "shorts"}`,
        `funding ${(input.fundingRate * 100).toFixed(4)}%`,
        `book imbalance ${input.imbalance >= 0 ? "bid" : "ask"}-heavy ${input.imbalance.toFixed(3)}`,
        `24h ${input.change24hPct.toFixed(2)}%`,
        `raw ${raw.toFixed(3)} → ${side} @ ${(confidence * 100).toFixed(0)}%`,
      ].join("; ");

  return {
    symbol: input.symbol,
    side,
    confidence: round(confidence, 4),
    rationale: rationale ?? "HOLD",
    suggestedSize: {
      quoteUsd,
      baseQty,
      maxNotionalUsd: RISK.maxNotionalUsd,
      cappedBy,
    },
    inputs: {
      lastPrice: input.lastPrice,
      fundingRate: input.fundingRate,
      imbalance: input.imbalance,
      change24hPct: input.change24hPct,
      rawScore: round(raw, 4),
    },
    risk: {
      maxLeverage: RISK.maxLeverage,
      skipped,
      skipReason,
    },
  };
}

/** ScoutPay treasury ticket: min-notional BNBUSDT SPOT MARKET buy. */
export function minNotionalBuy(report: AlphaReport): Signal {
  const quoteUsd = report.filters.minNotional;
  const last = report.row.ticker.lastPrice;
  const baseQty = last ? round(quoteUsd / last, 8) : 0;
  return {
    symbol: report.symbol,
    side: "BUY",
    confidence: 1,
    rationale: `ScoutPay treasury: SPOT MARKET buy ${report.symbol} at exchangeInfo min notional ${quoteUsd} USDT (queried, not hardcoded).`,
    suggestedSize: {
      quoteUsd,
      baseQty,
      maxNotionalUsd: quoteUsd,
      cappedBy: `exchangeInfo NOTIONAL min ${quoteUsd} USDT`,
    },
    inputs: {
      lastPrice: last,
      fundingRate: report.row.funding?.lastFundingRate ?? 0,
      imbalance: report.row.book.imbalance,
      change24hPct: report.row.ticker.priceChangePercent,
      rawScore: 1,
    },
    risk: { maxLeverage: 1, skipped: false },
  };
}

export function executeSpotBuy(
  signal: Signal,
  opts: { liveRequested: boolean; confirmSpot: boolean; checklist: Checklist; mcpTradeBound: boolean },
): ExecutionResult {
  const hardGates = opts.checklist.items.filter((i) => i.gate && i.id !== "confirm-pay" && i.id !== "confirm-spot" && i.id !== "confirm-defi");
  const researchPass = hardGates.every((i) => i.ok);

  if (!researchPass) {
    return {
      mode: "blocked",
      payload: {},
      note: "Fail-closed: Alpha/x402 gates failed. SPOT ticket not printed as live-eligible. Report + 402 receipt still shown.",
    };
  }

  const payload: TradeIntent = {
    capability: "trade",
    venue: defaultVenue(),
    confirmBeforeExecute: true,
    dryRun: true,
    order: {
      symbol: signal.symbol,
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: signal.suggestedSize.quoteUsd.toFixed(2),
    },
  };

  if (!opts.confirmSpot) {
    return {
      mode: "waiting-confirm",
      payload,
      note: "RESTATED SPOT MARKET ticket waiting for --confirm-spot. DRY-RUN. Confirms are never skipped.",
    };
  }

  if (!opts.liveRequested) {
    return {
      mode: "dry-run",
      payload: { ...payload, dryRun: true },
      note: "DRY-RUN. --confirm-spot set but DESK_LIVE is not 1. MCP payload printed, not sent.",
    };
  }

  if (!opts.mcpTradeBound) {
    return {
      mode: "live-blocked-no-mcp",
      payload: { ...payload, dryRun: false },
      note: "DESK_LIVE=1 and --confirm-spot set, but no authenticated MCP trade tool is bound. Refusing to send.",
    };
  }

  return {
    mode: "live-blocked-no-mcp",
    payload: { ...payload, dryRun: false },
    note: "Trade tool would bind here — Desk still refuses to invent an MCP tool name. No send.",
  };
}

export function executeSignal(
  signal: Signal,
  opts: { liveRequested: boolean; confirm: boolean },
): ExecutionResult {
  const checklist: Checklist = {
    items: [
      {
        id: "confirm-spot",
        ok: opts.confirm,
        gate: true,
        label: "CONFIRM spot",
        detail: "",
      },
    ],
    hardPass: opts.confirm,
    liveBlocked: false,
  };
  return executeSpotBuy(signal, {
    liveRequested: opts.liveRequested,
    confirmSpot: opts.confirm,
    checklist,
    mcpTradeBound: false,
  });
}

export async function runSignalWorkflow(symbol = DEFAULT_SYMBOL): Promise<{
  signal: Signal;
  execution: ExecutionResult;
  report: AlphaReport;
}> {
  const report = await runAlphaReport(symbol);
  const signal = minNotionalBuy(report);
  const execution = executeSpotBuy(signal, {
    liveRequested: process.env.DESK_LIVE === "1",
    confirmSpot: process.argv.includes("--confirm-spot"),
    checklist: {
      items: [
        { id: "major-pair", ok: true, gate: true, label: "major", detail: "" },
        { id: "audit", ok: true, gate: true, label: "audit", detail: "" },
        { id: "ticker", ok: true, gate: true, label: "ticker", detail: "" },
        { id: "x402", ok: true, gate: true, label: "x402", detail: "" },
        {
          id: "confirm-spot",
          ok: process.argv.includes("--confirm-spot"),
          gate: true,
          label: "CONFIRM spot",
          detail: "",
        },
      ],
      hardPass: process.argv.includes("--confirm-spot"),
      liveBlocked: false,
    },
    mcpTradeBound: false,
  });
  return { signal, execution, report };
}

export function riskFooter(): string {
  const need = quotePlusFees(5, TAKER_FEE_BPS, FEE_BUFFER_USDT);
  return `ScoutPay spot: exchangeInfo min notional · taker ${TAKER_FEE_BPS} bps · live need ~$${need.toFixed(2)} USDT on the Agentic sub`;
}
