import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { biasPoints, classifyStatus, summarizeCells } from "../src/calibration/status.js";
import { buildSamples, lookbackFeatures } from "../src/calibration/features.js";
import { makeFixtureKlines } from "../src/calibration/fixture.js";
import { buildPanel, passingStubPanel, shortHorizonMajorityOverconfident } from "../src/calibration/panel.js";
import { formatCalibrationAnsi, formatCalibrationMarkdown } from "../src/calibration/heatmap.js";

describe("calibration status", () => {
  it("bias is realized minus predicted in percentage points", () => {
    assert.equal(biasPoints(56.2, 52.6).toFixed(1), "-3.6");
    assert.equal(biasPoints(55.8, 68.9).toFixed(1), "13.1");
  });

  it("classifies screenshot rules", () => {
    assert.equal(classifyStatus(55.6, 55.8, 129).status, "reliable");
    assert.equal(classifyStatus(56.7, 46.7, 15).status, "overconfident");
    assert.equal(classifyStatus(55.8, 68.9, 61).status, "underconfident");
    assert.equal(classifyStatus(50, 54, 80).status, "agree-no-edge");
    assert.equal(classifyStatus(50, 51, 10).status, "agree-no-edge");
    assert.equal(classifyStatus(50, 50, 0).status, "no-sample");
  });
});

describe("fixture kline grid", () => {
  it("builds a deterministic 5×5 walk-forward panel", () => {
    const klines = makeFixtureKlines(480, 42);
    assert.equal(klines.length, 480);
    const feat = lookbackFeatures(klines, 10, 3);
    assert.ok(feat);
    const samples = buildSamples(klines, 2, 1);
    assert.ok(samples.length > 100);

    const panel = buildPanel(klines, { kind: "fixture", note: "seed=42" });
    assert.equal(panel.target, "BTC");
    assert.equal(panel.models.length, 3);
    assert.equal(panel.models[0]?.zh, "广义加性逻辑模型");
    assert.equal(panel.models[1]?.zh, "高斯朴素贝叶斯");
    assert.equal(panel.models[2]?.zh, "梯度提升树");
    for (const m of panel.models) {
      assert.equal(m.cells.length, 25);
      assert.ok(m.cells.every((c) => c.n > 0));
    }
    assert.equal(panel.baseline.cells.length, 10);

    const gbdt11 = panel.models[2]?.cells.find((c) => c.horizon === 1 && c.lookback === 1);
    assert.ok(gbdt11);
    assert.equal(gbdt11.n, 335);
    assert.equal(gbdt11.predictedPct, 52.2);
    assert.equal(gbdt11.realizedPct, 53.7);
    assert.equal(gbdt11.status, "reliable");

    const ansi = formatCalibrationAnsi(panel, { full: true });
    assert.match(ansi, /标的 BTC/);
    assert.match(ansi, /基本靠谱|吻合但没优势|明显高估|明显低估/);
    const md = formatCalibrationMarkdown(panel);
    assert.match(md, /Walk-forward/);
  });
});

describe("calibration ScoutPay gate", () => {
  it("fails closed when short-horizon cells are majority 明显高估", () => {
    const panel = passingStubPanel();
    assert.equal(shortHorizonMajorityOverconfident(panel.selected), false);
    for (const c of panel.selected.cells) {
      if (c.horizon <= 2) {
        c.status = "overconfident";
        c.predictedPct = 60;
        c.realizedPct = 50;
        c.biasPt = -10;
      }
    }
    panel.selected.summary = summarizeCells(panel.selected.cells);
    assert.equal(shortHorizonMajorityOverconfident(panel.selected), true);
  });
});
