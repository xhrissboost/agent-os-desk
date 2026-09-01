import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CALIB_ARTIFACT_DIR, CALIB_LOOKBACKS } from "../config.js";
import type { CalibCell, CalibGrid, CalibStatus, CalibrationPanel } from "../types.js";
import { STATUS_LABEL, bilingual } from "./status.js";

const ANSI: Record<CalibStatus, string> = {
  reliable: "\x1b[42;30m",
  "agree-no-edge": "\x1b[43;30m",
  overconfident: "\x1b[41;97m",
  underconfident: "\x1b[44;97m",
  "no-sample": "\x1b[100;97m",
};
const RESET = "\x1b[0m";

function visLen(s: string): number {
  let n = 0;
  for (const ch of s) n += /[\u3400-\u9fff]/.test(ch) ? 2 : 1;
  return n;
}

function padVis(s: string, width: number): string {
  const extra = width - visLen(s);
  return extra > 0 ? s + " ".repeat(extra) : s;
}

function cellBlock(c: CalibCell | undefined, width: number): [string, string, string] {
  if (!c) {
    const empty = padVis("—", width);
    return [empty, empty, empty];
  }
  const lab = STATUS_LABEL[c.status].zh;
  const colored = `${ANSI[c.status]}${padVis(lab, width)}${RESET}`;
  const pr = Number.isFinite(c.predictedPct) ? c.predictedPct.toFixed(1) : "n/a";
  const rz = Number.isFinite(c.realizedPct) ? c.realizedPct.toFixed(1) : "n/a";
  const line2 = padVis(`${pr}%→${rz}%`, width);
  const sign = c.biasPt > 0 ? "+" : "";
  const line3 = padVis(`偏差${sign}${c.biasPt.toFixed(1)}点 N=${c.n}`, width);
  return [colored, line2, line3];
}

function summaryLine(g: CalibGrid): string {
  const s = g.summary;
  return `吻合 ${s.agree + s.reliable}/${s.total} · 基本靠谱 ${s.reliable} · 高估 ${s.over} · 低估 ${s.under} · 无样本 ${s.empty}`;
}

function gridAnsi(grid: CalibGrid, lookbacks: readonly number[], selected: boolean): string {
  const width = 20;
  const horizons = [...new Set(grid.cells.map((c) => c.horizon))].sort((a, b) => a - b);
  const star = selected ? "  ★ selected" : "";
  const lines = [` ${grid.zh}  ${grid.en}${star}`, ` ${summaryLine(grid)}`];
  const header = ` ${padVis("H\\L", 6)}${lookbacks.map((l) => padVis(`${l}根`, width)).join("")}`;
  lines.push(header);
  for (const h of horizons) {
    const rowCells = lookbacks.map((l) => grid.cells.find((c) => c.horizon === h && c.lookback === l));
    const b0 = rowCells.map((c) => cellBlock(c, width)[0]);
    const b1 = rowCells.map((c) => cellBlock(c, width)[1]);
    const b2 = rowCells.map((c) => cellBlock(c, width)[2]);
    lines.push(` ${padVis(`${h}根`, 6)}${b0.join("")}`);
    lines.push(` ${padVis("", 6)}${b1.join("")}`);
    lines.push(` ${padVis("", 6)}${b2.join("")}`);
  }
  return lines.join("\n");
}

export function formatCalibrationAnsi(panel: CalibrationPanel, opts?: { full?: boolean }): string {
  const full = opts?.full ?? true;
  const lines: string[] = [];
  lines.push(` 标的 BTC  ·  ${panel.symbol} ${panel.interval}  ·  ${panel.event}`);
  lines.push(` walk-forward OOS  ·  ${panel.klineCount} bars  ·  src ${panel.source.host ?? panel.source.kind}`);
  lines.push(` legend  绿 基本靠谱  黄 吻合但没优势  红 明显高估  蓝 明显低估`);
  lines.push(` ${panel.disclaimer}`);
  lines.push("");
  lines.push(gridAnsi(panel.baseline, CALIB_LOOKBACKS, false));
  lines.push("");
  const show = full ? panel.models : [panel.selected];
  for (const g of show) {
    lines.push(gridAnsi(g, CALIB_LOOKBACKS, g.id === panel.selected.id));
    lines.push("");
  }
  if (!full) {
    for (const g of panel.models) {
      if (g.id === panel.selected.id) continue;
      lines.push(` ${g.zh}  ${summaryLine(g)}`);
    }
    lines.push("");
  }
  lines.push(` selected ${panel.selected.zh}  (${panel.selected.en})`);
  lines.push(` gate     ${panel.gateOk ? "PASS" : "FAIL"}  ${panel.gateDetail}`);
  return lines.join("\n");
}

function mdCell(c: CalibCell): string {
  const lab = bilingual(c.status);
  if (c.n === 0) return lab;
  const sign = c.biasPt > 0 ? "+" : "";
  return `${lab}<br>${c.predictedPct.toFixed(1)}% → ${c.realizedPct.toFixed(1)}%<br>偏差 ${sign}${c.biasPt.toFixed(1)} 点 · N=${c.n}`;
}

function mdGrid(grid: CalibGrid): string {
  const horizons = [...new Set(grid.cells.map((c) => c.horizon))].sort((a, b) => a - b);
  const lookbacks = [...new Set(grid.cells.map((c) => c.lookback))].sort((a, b) => a - b);
  const head = `| H \\ L | ${lookbacks.map((l) => `${l}根`).join(" | ")} |`;
  const sep = `| --- | ${lookbacks.map(() => "---").join(" | ")} |`;
  const rows = horizons.map((h) => {
    const cols = lookbacks.map((l) => {
      const c = grid.cells.find((x) => x.horizon === h && x.lookback === l);
      return c ? mdCell(c) : "—";
    });
    return `| ${h}根 | ${cols.join(" | ")} |`;
  });
  return [
    `### ${grid.zh} (${grid.en})`,
    "",
    `吻合 ${grid.summary.agree + grid.summary.reliable}/${grid.summary.total} · 基本靠谱 ${grid.summary.reliable} · 高估 ${grid.summary.over} · 低估 ${grid.summary.under} · 无样本 ${grid.summary.empty}`,
    "",
    head,
    sep,
    ...rows,
    "",
  ].join("\n");
}

export function formatCalibrationMarkdown(panel: CalibrationPanel): string {
  return [
    `# BTC model-calibration dashboard`,
    "",
    `- 标的 **BTC** · \`${panel.symbol}\` · interval **${panel.interval}**`,
    `- Event: \`${panel.event}\` over H future bars; features from L lookback bars (return, range, vol).`,
    `- Walk-forward out-of-sample. ${panel.klineCount} bars. Source: ${panel.source.host ?? panel.source.kind}${panel.source.note ? ` (${panel.source.note})` : ""}.`,
    `- ${panel.disclaimer}`,
    `- Status: \\|bias\\| < 3pt and N ≥ 30 → 基本靠谱 / basically reliable; \\|bias\\| < 6pt → 吻合但没优势 / agreement but no edge; pred − realized ≥ 6pt → 明显高估; realized − pred ≥ 6pt → 明显低估.`,
    `- Selected: **${panel.selected.zh}** (${panel.selected.summary.reliable}/${panel.selected.summary.total} 基本靠谱). Gate: ${panel.gateOk ? "PASS" : "FAIL"} — ${panel.gateDetail}`,
    "",
    mdGrid(panel.baseline),
    ...panel.models.map(mdGrid),
  ].join("\n");
}

export function writeCalibrationArtifacts(panel: CalibrationPanel, dir = CALIB_ARTIFACT_DIR): {
  md: string;
  json: string;
} {
  mkdirSync(dir, { recursive: true });
  const mdPath = join(dir, "btc-calibration.md");
  const jsonPath = join(dir, "btc-calibration.json");
  writeFileSync(mdPath, `${formatCalibrationMarkdown(panel)}\n`);
  writeFileSync(jsonPath, `${JSON.stringify(panel, null, 2)}\n`);
  return { md: mdPath, json: jsonPath };
}
