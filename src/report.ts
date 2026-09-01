import { DESK_VERSION } from "./config.js";
import { banner, fundingPct, pct, rule, truncate, usd } from "./format.js";
import type { DemoReport } from "./types.js";

export function formatDemoReport(report: DemoReport): string {
  const lines: string[] = [];
  lines.push(
    banner(
      `DESK  v${DESK_VERSION}  ·  Agent Native desk blotter`,
      `${report.generatedAt}  ·  dry-run default  ·  no withdrawals`,
    ),
  );
  lines.push("");
  lines.push(
    `MCP  ${report.mcp.authenticated ? "AUTH" : "OFF"}  ${report.mcp.endpoint}`,
  );
  lines.push(`     ${report.mcp.note}`);
  lines.push("");

  lines.push(rule("1. DATA & ANALYSIS"));
  for (const row of report.data.rows) {
    const src = row.source.host ?? row.source.kind;
    const fund = row.funding ? fundingPct(row.funding.lastFundingRate) : "n/a";
    lines.push(
      ` ${row.symbol.padEnd(8)}  ${usd(row.ticker.lastPrice, 2).padStart(12)}  24h ${pct(row.ticker.priceChangePercent).padStart(8)}  imb ${row.book.imbalance.toFixed(3).padStart(6)}  fund ${fund.padStart(9)}`,
    );
    lines.push(
      `          S ${usd(row.levels.support)}  R ${usd(row.levels.resistance)}  spread ${row.book.spreadBps.toFixed(2)} bps  klines ${row.klines.length}  src ${src}`,
    );
  }
  const p = report.data.portfolio;
  lines.push(
    ` book     $${usd(p.totalUsd)}  24h mtm $${usd(p.estimatedPnl24hUsd)}  ${p.concentration}`,
  );
  lines.push(
    ` weights  ${p.weights.map((w) => `${w.asset} ${w.weightPct.toFixed(1)}%`).join(" · ")}`,
  );
  for (const note of p.notes) lines.push(` note     ${note}`);
  if (p.source.note) lines.push(` source   ${p.source.kind}${p.source.note ? ` — ${p.source.note}` : ""}`);
  lines.push("");

  lines.push(rule("2. TRADING WORKFLOWS"));
  const s = report.trading.signal;
  lines.push(
    ` SIGNAL   ${s.symbol}  ${s.side}  confidence ${(s.confidence * 100).toFixed(0)}%`,
  );
  lines.push(` size     $${usd(s.suggestedSize.quoteUsd)}  qty ${s.suggestedSize.baseQty}  (${s.suggestedSize.cappedBy})`);
  lines.push(` why      ${s.rationale}`);
  lines.push(` exec     ${report.trading.execution.mode.toUpperCase()}`);
  lines.push(`          ${report.trading.execution.note}`);
  if (Object.keys(report.trading.execution.payload).length) {
    lines.push(` payload  ${JSON.stringify(report.trading.execution.payload)}`);
  }
  lines.push("");

  lines.push(rule("3. PAYMENT WORKFLOWS"));
  const pay = report.payments;
  lines.push(
    ` bazaar   ${pay.listed} resource(s)  src ${pay.bazaarSource.host ?? pay.bazaarSource.kind}${pay.bazaarSource.note ? ` — ${pay.bazaarSource.note}` : ""}`,
  );
  if (pay.picked) {
    lines.push(` pick     ${truncate(pay.picked.resource, 88)}`);
  }
  lines.push(` roles    Desk (payer)  ↔  Counterparty (payee)`);
  for (const step of pay.trace) {
    lines.push(` ${String(step.status).padStart(5)}  ${step.title}`);
    lines.push(`          ${step.detail}`);
  }
  lines.push(
    ` receipt  ${pay.receipt.settlement}  chain ${pay.receipt.chainId}  ${pay.receipt.amount}  ${pay.receipt.txHash.slice(0, 22)}…`,
  );
  lines.push("");

  lines.push(rule("4. ONCHAIN WORKFLOWS"));
  const o = report.onchain;
  lines.push(
    ` token    ${o.token.symbol ?? "?"}  ${o.token.contractAddress}  chain ${o.token.chainId}`,
  );
  if (o.token.priceUsd != null) {
    lines.push(
      `          px $${usd(o.token.priceUsd, 4)}  24h ${o.token.change24hPct != null ? pct(o.token.change24hPct) : "n/a"}  liq $${o.token.liquidityUsd != null ? usd(o.token.liquidityUsd) : "n/a"}`,
    );
  }
  const auditLabel =
    o.audit.hasResult && o.audit.isSupported
      ? `${o.audit.riskLevelEnum ?? "?"} (lvl ${o.audit.riskLevel ?? "?"})`
      : "unavailable";
  lines.push(` audit    ${auditLabel}  hits ${o.audit.hits.length ? o.audit.hits.join(", ") : "none"}`);
  lines.push(` intent   ${o.intent.action}  ${o.intent.chain}  DRY-RUN`);
  lines.push(`          ${o.intent.summary}`);
  lines.push(` baw      ${o.intent.bawCommand}`);
  lines.push(`          ${o.intent.note}`);
  lines.push(` adapters ${o.adapters.join(" · ")}`);
  lines.push("");
  lines.push("Not financial advice. Confirm-first. No live orders in this demo.");
  return lines.join("\n");
}
