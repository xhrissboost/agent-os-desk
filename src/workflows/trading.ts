import { RISK } from "../config.js";
import { clamp, round } from "../http.js";
import { defaultVenue } from "../mcp/client.js";
import type { ExecutionResult, PortfolioInsight, Signal, Side, TradeIntent } from "../types.js";
import { runDataWorkflow } from "./data.js";

export type SignalInputs = {
  symbol: string;
  lastPrice: number;
  fundingRate: number;
  imbalance: number;
  change24hPct: number;
  portfolioUsd: number;
};

/**
 * Funding-rate + book-imbalance mean reversion.
 *
 * Positive funding = longs pay shorts (crowded long). Bid-heavy book is the
 * same crowding in the spot ladder. Fade both. Hard caps keep size tiny.
 */
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

export function executeSignal(
  signal: Signal,
  opts: { liveRequested: boolean; confirm: boolean },
): ExecutionResult {
  if (signal.side === "HOLD") {
    return {
      mode: "dry-run",
      payload: {},
      note: "No order. HOLD under risk limits — nothing to send.",
    };
  }

  const payload: TradeIntent = {
    capability: "trade",
    venue: defaultVenue(),
    confirmBeforeExecute: true,
    dryRun: true,
    order: {
      symbol: signal.symbol,
      side: signal.side,
      type: "MARKET",
      quantity: String(signal.suggestedSize.baseQty),
      quoteOrderQty: String(signal.suggestedSize.quoteUsd),
    },
  };

  if (!opts.liveRequested || !opts.confirm) {
    return {
      mode: "dry-run",
      payload: { ...payload, dryRun: true },
      note: "DRY-RUN. MCP trade payload printed, not sent. Live requires DESK_LIVE=1 AND --confirm.",
    };
  }

  return {
    mode: "live-blocked-no-mcp",
    payload: { ...payload, dryRun: false },
    note: "DESK_LIVE=1 and --confirm set, but no authenticated MCP trade tool is bound. Refusing to send. Agent cannot withdraw.",
  };
}

export async function runSignalWorkflow(symbol = "BTCUSDT"): Promise<{
  signal: Signal;
  execution: ExecutionResult;
  portfolio: PortfolioInsight;
}> {
  const { rows, portfolio } = await runDataWorkflow([symbol, "ETHUSDT", "SOLUSDT"]);
  const row = rows.find((r) => r.symbol === symbol) ?? rows[0]!;
  const signal = computeSignal({
    symbol: row.symbol,
    lastPrice: row.ticker.lastPrice,
    fundingRate: row.funding?.lastFundingRate ?? 0,
    imbalance: row.book.imbalance,
    change24hPct: row.ticker.priceChangePercent,
    portfolioUsd: portfolio.totalUsd,
  });
  const execution = executeSignal(signal, {
    liveRequested: process.env.DESK_LIVE === "1",
    confirm: process.argv.includes("--confirm"),
  });
  return { signal, execution, portfolio };
}

export function riskFooter(): string {
  return `risk: max $${RISK.maxNotionalUsd} notional · ${RISK.maxPortfolioPct * 100}% book · leverage ≤ ${RISK.maxLeverage} · min confidence ${RISK.minConfidence}`;
}
