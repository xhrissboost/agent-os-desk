import { DESK_VERSION, GITHUB_URL, LOOP_NICKNAME } from "./config.js";
import { banner, fundingPct, pct, rule, truncate, usd } from "./format.js";
import { formatCalibrationAnsi } from "./calibration/heatmap.js";
import type { DemoReport } from "./types.js";

function tick(ok: boolean): string {
  return ok ? "[x]" : "[ ]";
}

export function formatDemoReport(report: DemoReport): string {
  const lines: string[] = [];
  lines.push(
    banner(
      `DESK  v${DESK_VERSION}  ·  ${LOOP_NICKNAME}  ·  pay-for-alpha treasury loop`,
      `${report.generatedAt}  ·  ${report.symbol}  ·  dry-run default  ·  no withdrawals`,
    ),
  );
  lines.push("");
  lines.push(`MCP  ${report.mcp.authenticated ? "AUTH" : "OFF"}  ${report.mcp.endpoint}`);
  lines.push(`     ${report.mcp.note}`);
  lines.push("");

  lines.push(rule("1. DATA  Alpha Report"));
  const cal = report.data.calibration;
  lines.push(
    ` 标的 BTC  selected ${cal.selected.zh}  ${cal.selected.summary.reliable}/${cal.selected.summary.total} 基本靠谱`,
  );
  lines.push(formatCalibrationAnsi(cal, { full: false }));
  lines.push("");
  const row = report.data.row;
  const src = row.source.host ?? row.source.kind;
  lines.push(
    ` ${row.symbol.padEnd(8)}  ${usd(row.ticker.lastPrice, 2).padStart(10)}  24h ${pct(row.ticker.priceChangePercent).padStart(8)}  imb ${row.book.imbalance.toFixed(3)}  fund ${row.funding ? fundingPct(row.funding.lastFundingRate) : "n/a"}`,
  );
  lines.push(
    `          S ${usd(row.levels.support)}  R ${usd(row.levels.resistance)}  spread ${row.book.spreadBps.toFixed(2)} bps  klines ${row.klines.length}  src ${src}`,
  );
  lines.push(
    `          minNotional ${report.data.filters.minNotional} USDT  (${report.data.filters.source.host ?? report.data.filters.source.note ?? report.data.filters.source.kind})`,
  );
  const tok = report.data.token;
  lines.push(
    ` token    ${tok.symbol ?? "?"}  ${tok.contractAddress}  chain ${tok.chainId}  ${tok.source.kind}`,
  );
  const audit = report.data.audit;
  const auditLabel =
    audit.hasResult && audit.isSupported
      ? `${audit.riskLevelEnum ?? "n/a"} lvl ${audit.riskLevel ?? "?"}`
      : "unavailable (honest)";
  lines.push(
    ` audit    ${auditLabel}  honeypot=${audit.honeypot}  hits ${audit.hits.length ? audit.hits.join(", ") : "none"}`,
  );
  lines.push(` signal   ${report.data.skillSignal.stub ? "STUB" : "LIVE"}  ${report.data.skillSignal.summary}`);
  lines.push(
    ` sub book ${report.data.portfolio.usdtFree} USDT free  (Agentic-sub sample — never main-account)`,
  );
  lines.push("");

  lines.push(rule("2. PAY  402 → Alpha Memo"));
  const pay = report.payments;
  lines.push(` rail     ${pay.rail}  bazaar ${pay.listed} listed / ${pay.cheapListings} ≤ $1`);
  lines.push(` amount   $${pay.amountUsd.toFixed(2)}  READY_TO_SIGN=${pay.readyToSign}`);
  for (const step of pay.trace) {
    lines.push(` ${String(step.status).padStart(5)}  ${step.title}`);
    lines.push(`          ${step.detail}`);
  }
  if (pay.memo) {
    lines.push(` memo     ${pay.memo.title}`);
    lines.push(`          ${truncate(pay.memo.body, 140)}`);
  }
  if (pay.receipt) {
    lines.push(` receipt  ${pay.receipt.settlement}  chain ${pay.receipt.chainId}  ${pay.receipt.txHash.slice(0, 22)}…`);
  }
  lines.push(` confirm  pay ${report.confirms.pay ? "YES" : "NO"}  (--confirm-pay)`);
  lines.push("");

  lines.push(rule("3. TRADE  BNBUSDT SPOT MARKET"));
  const s = report.trading.signal;
  lines.push(` TICKET   ${s.symbol}  ${s.side}  MARKET  quoteOrderQty ${s.suggestedSize.quoteUsd.toFixed(2)} USDT`);
  lines.push(`          ${s.rationale}`);
  lines.push(` exec     ${report.trading.execution.mode.toUpperCase()}`);
  lines.push(`          ${report.trading.execution.note}`);
  if (Object.keys(report.trading.execution.payload).length) {
    lines.push(` payload  ${JSON.stringify(report.trading.execution.payload)}`);
  }
  lines.push(` confirm  spot ${report.confirms.spot ? "YES" : "NO"}  (--confirm-spot)  DESK_LIVE=${process.env.DESK_LIVE === "1" ? "1" : "0"}`);
  lines.push("");

  lines.push(rule("4. ONCHAIN  DeFi Earn deposit INTENT"));
  const o = report.onchain;
  lines.push(` intent   ${o.intent.action}  ${o.intent.amountUsdt.toFixed(2)} USDT  ${o.intent.chain}  DRY-RUN`);
  lines.push(`          ${o.intent.summary}`);
  lines.push(` baw      ${o.intent.bawCommand}`);
  lines.push(`          ${o.intent.note}`);
  lines.push(` confirm  defi ${report.confirms.defi ? "YES" : "NO"}  (--confirm-defi)`);
  lines.push("");

  lines.push(rule("CHECKLIST  fail-closed"));
  for (const item of report.checklist.items) {
    lines.push(` ${tick(item.ok)}  ${item.label}`);
    lines.push(`          ${item.detail}`);
  }
  lines.push("");
  lines.push(`loop     ${report.checklist.hardPass ? "OPEN" : "CLOSED"}  (confirms never skipped)`);
  lines.push(`github   ${GITHUB_URL}`);
  lines.push("Not financial advice. Sub-account only. No withdrawal scope. No live Track B trades.");
  return lines.join("\n");
}
