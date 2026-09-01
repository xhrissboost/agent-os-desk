import {
  CALIB_AGREE_PT,
  CALIB_N_SUFFICIENT,
  CALIB_RELIABLE_PT,
} from "../config.js";
import type { CalibCell, CalibGridSummary, CalibStatus } from "../types.js";

export const STATUS_LABEL: Record<CalibStatus, { zh: string; en: string }> = {
  reliable: { zh: "基本靠谱", en: "basically reliable" },
  "agree-no-edge": { zh: "吻合但没优势", en: "agreement but no edge" },
  overconfident: { zh: "明显高估", en: "significantly overestimated" },
  underconfident: { zh: "明显低估", en: "significantly underestimated" },
  "no-sample": { zh: "无样本", en: "no sample" },
};

/** 偏差 = realized% − predicted% (percentage points), matching the screenshot. */
export function biasPoints(predictedPct: number, realizedPct: number): number {
  return realizedPct - predictedPct;
}

/**
 * Status rules (documented in README):
 * - N = 0 → 无样本
 * - pred exceeds realized by ≥ 6pt → 明显高估
 * - realized exceeds pred by ≥ 6pt → 明显低估
 * - |bias| < 3pt and N ≥ 30 → 基本靠谱
 * - |bias| < 6pt otherwise → 吻合但没优势
 */
export function classifyStatus(
  predictedPct: number,
  realizedPct: number,
  n: number,
  opts?: { reliablePt?: number; agreePt?: number; nSufficient?: number },
): { status: CalibStatus; biasPt: number } {
  const reliablePt = opts?.reliablePt ?? CALIB_RELIABLE_PT;
  const agreePt = opts?.agreePt ?? CALIB_AGREE_PT;
  const nSufficient = opts?.nSufficient ?? CALIB_N_SUFFICIENT;
  if (n <= 0 || !Number.isFinite(predictedPct) || !Number.isFinite(realizedPct)) {
    return { status: "no-sample", biasPt: 0 };
  }
  const biasPt = biasPoints(predictedPct, realizedPct);
  const abs = Math.abs(biasPt);
  if (abs >= agreePt) {
    return { status: biasPt <= -agreePt ? "overconfident" : "underconfident", biasPt };
  }
  if (abs < reliablePt && n >= nSufficient) {
    return { status: "reliable", biasPt };
  }
  return { status: "agree-no-edge", biasPt };
}

export function makeCell(
  horizon: number,
  lookback: number,
  predictedPct: number,
  realizedPct: number,
  n: number,
): CalibCell {
  const { status, biasPt } = classifyStatus(predictedPct, realizedPct, n);
  return {
    horizon,
    lookback,
    predictedPct,
    realizedPct,
    biasPt,
    n,
    status,
  };
}

export function summarizeCells(cells: CalibCell[]): CalibGridSummary {
  const summary: CalibGridSummary = {
    reliable: 0,
    agree: 0,
    over: 0,
    under: 0,
    empty: 0,
    total: cells.length,
  };
  for (const c of cells) {
    if (c.status === "reliable") summary.reliable += 1;
    else if (c.status === "agree-no-edge") summary.agree += 1;
    else if (c.status === "overconfident") summary.over += 1;
    else if (c.status === "underconfident") summary.under += 1;
    else summary.empty += 1;
  }
  return summary;
}

export function bilingual(status: CalibStatus): string {
  const lab = STATUS_LABEL[status];
  return `${lab.zh} / ${lab.en}`;
}
