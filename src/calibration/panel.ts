import {
  CALIB_BASELINE_HORIZONS,
  CALIB_HORIZONS,
  CALIB_INTERVAL,
  CALIB_LOOKBACKS,
  CALIB_SYMBOL,
} from "../config.js";
import { round } from "../http.js";
import type {
  CalibGrid,
  CalibModelId,
  CalibrationPanel,
  DataSource,
  Kline,
} from "../types.js";
import { buildSamples, rollingUpFrequency } from "./features.js";
import { loadCalibrationKlines } from "./klines.js";
import { modelMeta, oosStats, walkForward } from "./models.js";
import { makeCell, summarizeCells } from "./status.js";

const DISCLAIMER =
  "Families match the screenshot names. Desk did not reverse-engineer their weights or training set.";

function roundPct(n: number): number {
  return Number.isFinite(n) ? round(n, 1) : NaN;
}

function evaluateModel(
  klines: Kline[],
  id: Exclude<CalibModelId, "baseline">,
  horizons: readonly number[],
  lookbacks: readonly number[],
): CalibGrid {
  const meta = modelMeta(id);
  const cells = [];
  for (const h of horizons) {
    for (const l of lookbacks) {
      const samples = buildSamples(klines, l, h);
      const walk = walkForward(samples, id);
      const stats = oosStats(samples, walk);
      cells.push(
        makeCell(h, l, roundPct(stats.predictedPct), roundPct(stats.realizedPct), stats.n),
      );
    }
  }
  return { id, zh: meta.zh, en: meta.en, cells, summary: summarizeCells(cells) };
}

function evaluateBaseline(
  klines: Kline[],
  horizons: readonly number[],
  lookbacks: readonly number[],
): CalibGrid {
  const cells = [];
  for (const h of horizons) {
    for (const l of lookbacks) {
      const samples = buildSamples(klines, l, h);
      let pSum = 0;
      let ySum = 0;
      let n = 0;
      for (const s of samples) {
        const p = rollingUpFrequency(klines, s.t, l);
        if (p == null) continue;
        pSum += p;
        ySum += s.y;
        n += 1;
      }
      const predictedPct = n ? (pSum / n) * 100 : NaN;
      const realizedPct = n ? (ySum / n) * 100 : NaN;
      cells.push(makeCell(h, l, roundPct(predictedPct), roundPct(realizedPct), n));
    }
  }
  return {
    id: "baseline",
    zh: "基线 4根/5根",
    en: "baseline (4/5-bar horizons)",
    cells,
    summary: summarizeCells(cells),
  };
}

function pickSelected(models: CalibGrid[]): CalibGrid {
  const rank: Record<string, number> = { gbdt: 3, "gam-logistic": 2, "gaussian-nb": 1 };
  const sorted = [...models].sort((a, b) => {
    if (b.summary.reliable !== a.summary.reliable) return b.summary.reliable - a.summary.reliable;
    return (rank[b.id] ?? 0) - (rank[a.id] ?? 0);
  });
  return sorted[0] ?? models[0]!;
}

/** Fail if H=1–2 cells (short horizon) are majority 明显高估. */
export function shortHorizonMajorityOverconfident(grid: CalibGrid): boolean {
  const short = grid.cells.filter((c) => c.horizon <= 2 && c.n > 0);
  if (short.length === 0) return true;
  const over = short.filter((c) => c.status === "overconfident").length;
  return over > short.length / 2;
}

export function buildPanel(klines: Kline[], source: DataSource, symbol = CALIB_SYMBOL): CalibrationPanel {
  const models: CalibGrid[] = [
    evaluateModel(klines, "gam-logistic", CALIB_HORIZONS, CALIB_LOOKBACKS),
    evaluateModel(klines, "gaussian-nb", CALIB_HORIZONS, CALIB_LOOKBACKS),
    evaluateModel(klines, "gbdt", CALIB_HORIZONS, CALIB_LOOKBACKS),
  ];
  const baseline = evaluateBaseline(klines, CALIB_BASELINE_HORIZONS, CALIB_LOOKBACKS);
  const selected = pickSelected(models);
  const overShort = shortHorizonMajorityOverconfident(selected);
  const short = selected.cells.filter((c) => c.horizon <= 2 && c.n > 0);
  const over = short.filter((c) => c.status === "overconfident").length;
  const gateOk = !overShort;
  return {
    target: "BTC",
    symbol,
    interval: CALIB_INTERVAL,
    event: "P(close[t+H] > close[t])",
    klineCount: klines.length,
    source,
    disclaimer: DISCLAIMER,
    baseline,
    models,
    selected,
    gateOk,
    gateDetail: gateOk
      ? `${selected.zh} selected (${selected.summary.reliable}/${selected.summary.total} 基本靠谱). Short-horizon H=1–2 明显高估 ${over}/${short.length} — not a majority.`
      : `${selected.zh} short-horizon cells majority 明显高估 (${over}/${short.length}). Fail closed.`,
  };
}

export async function runCalibrationPanel(opts?: {
  klines?: Kline[];
  source?: DataSource;
}): Promise<CalibrationPanel> {
  if (opts?.klines) {
    return buildPanel(opts.klines, opts.source ?? { kind: "fixture", note: "injected klines" });
  }
  const { klines, source } = await loadCalibrationKlines();
  return buildPanel(klines, source);
}

export function stubCalibrationPanel(): CalibrationPanel {
  const empty = evaluateBaseline([], CALIB_BASELINE_HORIZONS, CALIB_LOOKBACKS);
  const models = (
    ["gam-logistic", "gaussian-nb", "gbdt"] as const
  ).map((id) => evaluateModel([], id, CALIB_HORIZONS, CALIB_LOOKBACKS));
  const selected = models[2]!;
  return {
    target: "BTC",
    symbol: CALIB_SYMBOL,
    interval: CALIB_INTERVAL,
    event: "P(close[t+H] > close[t])",
    klineCount: 0,
    source: { kind: "fixture", note: "stub" },
    disclaimer: DISCLAIMER,
    baseline: empty,
    models,
    selected,
    gateOk: false,
    gateDetail: "stub panel — no klines",
  };
}

/** Sync fixture for unit tests: GBDT selected, short-horizon not majority 高估. */
export function passingStubPanel(): CalibrationPanel {
  const p = stubCalibrationPanel();
  const fill = (g: CalibGrid, horizons: readonly number[]): void => {
    g.cells = horizons.flatMap((h) =>
      CALIB_LOOKBACKS.map((l) => makeCell(h, l, 51.2, 50.8, 80)),
    );
    g.summary = summarizeCells(g.cells);
  };
  fill(p.baseline, CALIB_BASELINE_HORIZONS);
  for (const m of p.models) fill(m, CALIB_HORIZONS);
  p.selected = p.models.find((m) => m.id === "gbdt") ?? p.models[0]!;
  p.klineCount = 480;
  p.gateOk = true;
  p.gateDetail = `${p.selected.zh} selected (${p.selected.summary.reliable}/${p.selected.summary.total} 基本靠谱). Short-horizon H=1–2 明显高估 0/10 — not a majority.`;
  return p;
}
