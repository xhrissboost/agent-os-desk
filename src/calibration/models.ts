import type { CalibModelId } from "../types.js";
import type { Sample } from "./features.js";

function sigmoid(z: number): number {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function logit(p: number): number {
  const q = Math.min(1 - 1e-6, Math.max(1e-6, p));
  return Math.log(q / (1 - q));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[i] ?? 0;
}

function solveLinear(Ain: number[][], bin: number[]): number[] {
  const n = bin.length;
  const A = Ain.map((row) => row.slice());
  const b = bin.slice();
  for (let i = 0; i < n; i++) {
    let piv = i;
    let best = Math.abs(A[i]?.[i] ?? 0);
    for (let r = i + 1; r < n; r++) {
      const v = Math.abs(A[r]?.[i] ?? 0);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (best < 1e-12) {
      continue;
    }
    if (piv !== i) {
      const tmp = A[i]!;
      A[i] = A[piv]!;
      A[piv] = tmp;
      const tb = b[i]!;
      b[i] = b[piv]!;
      b[piv] = tb;
    }
    const diag = A[i]![i] ?? 1;
    for (let r = i + 1; r < n; r++) {
      const f = (A[r]?.[i] ?? 0) / diag;
      for (let c = i; c < n; c++) {
        A[r]![c] = (A[r]![c] ?? 0) - f * (A[i]![c] ?? 0);
      }
      b[r] = (b[r] ?? 0) - f * (b[i] ?? 0);
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i] ?? 0;
    for (let c = i + 1; c < n; c++) s -= (A[i]?.[c] ?? 0) * (x[c] ?? 0);
    const diag = A[i]?.[i] ?? 0;
    x[i] = Math.abs(diag) < 1e-12 ? 0 : s / diag;
  }
  return x;
}

function retEdges(samples: Sample[]): number[] {
  const rets = samples.map((s) => s.x[0]).sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => quantile(rets, q));
}

function expandGam(x: [number, number, number], edges: number[]): number[] {
  const [ret, range, vol] = x;
  const buckets = [0, 0, 0, 0];
  let placed = false;
  for (let i = 0; i < 4; i++) {
    if (ret <= (edges[i] ?? 0)) {
      buckets[i] = 1;
      placed = true;
      break;
    }
  }
  if (!placed) buckets[3] = 1;
  return [
    1,
    ret,
    ret * ret,
    Math.tanh(ret * 40),
    range,
    range * range,
    vol,
    Math.sqrt(Math.max(vol, 0)),
    ...buckets,
  ];
}

function fitLogistic(X: number[][], y: number[], lambda = 1e-2): number[] {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  if (n === 0 || d === 0) return [];
  const w = new Array<number>(d).fill(0);
  for (let iter = 0; iter < 18; iter++) {
    const g = new Array<number>(d).fill(0);
    const H = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    for (let i = 0; i < n; i++) {
      const x = X[i] ?? [];
      const p = sigmoid(dot(w, x));
      const s = Math.max(p * (1 - p), 1e-6);
      const yi = y[i] ?? 0;
      for (let j = 0; j < d; j++) {
        const xj = x[j] ?? 0;
        g[j] = (g[j] ?? 0) + xj * (p - yi);
        for (let k = 0; k <= j; k++) {
          H[j]![k] = (H[j]![k] ?? 0) + s * xj * (x[k] ?? 0);
        }
      }
    }
    for (let j = 0; j < d; j++) {
      g[j] = (g[j] ?? 0) + lambda * (w[j] ?? 0);
      H[j]![j] = (H[j]![j] ?? 0) + lambda;
      for (let k = j + 1; k < d; k++) {
        H[j]![k] = H[k]![j] ?? 0;
      }
    }
    const step = solveLinear(H, g);
    let norm = 0;
    for (let j = 0; j < d; j++) {
      w[j] = (w[j] ?? 0) - (step[j] ?? 0);
      norm += (step[j] ?? 0) ** 2;
    }
    if (Math.sqrt(norm) < 1e-6) break;
  }
  return w;
}

class OnlineGnb {
  n = [0, 0];
  mean = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  m2 = [
    [0, 0, 0],
    [0, 0, 0],
  ];

  update(x: [number, number, number], y: 0 | 1): void {
    this.n[y] = (this.n[y] ?? 0) + 1;
    const k = this.n[y] ?? 1;
    for (let j = 0; j < 3; j++) {
      const d = x[j]! - (this.mean[y]![j] ?? 0);
      this.mean[y]![j] = (this.mean[y]![j] ?? 0) + d / k;
      this.m2[y]![j] = (this.m2[y]![j] ?? 0) + d * (x[j]! - (this.mean[y]![j] ?? 0));
    }
  }

  private loglik(x: [number, number, number], y: 0 | 1): number {
    const ny = this.n[y] ?? 0;
    if (ny < 2) return -1e6;
    let ll = 0;
    for (let j = 0; j < 3; j++) {
      const v = Math.max((this.m2[y]![j] ?? 0) / (ny - 1), 1e-12);
      const mu = this.mean[y]![j] ?? 0;
      const z = x[j]! - mu;
      ll += -0.5 * (Math.log(2 * Math.PI * v) + (z * z) / v);
    }
    return ll;
  }

  predict(x: [number, number, number]): number {
    const n0 = this.n[0] ?? 0;
    const n1 = this.n[1] ?? 0;
    if (n0 + n1 === 0) return 0.5;
    const logp0 = Math.log((n0 + 1e-9) / (n0 + n1)) + this.loglik(x, 0);
    const logp1 = Math.log((n1 + 1e-9) / (n0 + n1)) + this.loglik(x, 1);
    const m = Math.max(logp0, logp1);
    const e0 = Math.exp(logp0 - m);
    const e1 = Math.exp(logp1 - m);
    return e1 / (e0 + e1);
  }
}

type GbdtNode =
  | { kind: "leaf"; value: number }
  | { kind: "split"; feature: number; threshold: number; left: GbdtNode; right: GbdtNode };

function predictTree(node: GbdtNode, x: [number, number, number]): number {
  if (node.kind === "leaf") return node.value;
  return (x[node.feature] ?? 0) <= node.threshold
    ? predictTree(node.left, x)
    : predictTree(node.right, x);
}

function fitTree(
  X: Array<[number, number, number]>,
  residual: number[],
  idx: number[],
  depth: number,
  minLeaf: number,
): GbdtNode {
  const vals = idx.map((i) => residual[i] ?? 0);
  const leafVal = mean(vals);
  if (depth === 0 || idx.length < minLeaf * 2) {
    return { kind: "leaf", value: leafVal };
  }
  const parentSse = vals.reduce((s, v) => s + (v - leafVal) ** 2, 0);
  let bestGain = 0;
  let best: { feature: number; threshold: number; left: number[]; right: number[] } | null = null;
  for (let f = 0; f < 3; f++) {
    const featVals = idx.map((i) => X[i]?.[f] ?? 0).sort((a, b) => a - b);
    const uniq: number[] = [];
    for (const v of featVals) {
      if (uniq.length === 0 || Math.abs(v - (uniq[uniq.length - 1] ?? v)) > 1e-12) uniq.push(v);
    }
    const step = Math.max(1, Math.floor(uniq.length / 8));
    for (let u = step; u < uniq.length; u += step) {
      const thr = (((uniq[u - 1] ?? 0) + (uniq[u] ?? 0)) / 2);
      const left: number[] = [];
      const right: number[] = [];
      for (const i of idx) {
        if ((X[i]?.[f] ?? 0) <= thr) left.push(i);
        else right.push(i);
      }
      if (left.length < minLeaf || right.length < minLeaf) continue;
      const lm = mean(left.map((i) => residual[i] ?? 0));
      const rm = mean(right.map((i) => residual[i] ?? 0));
      let sse = 0;
      for (const i of left) sse += ((residual[i] ?? 0) - lm) ** 2;
      for (const i of right) sse += ((residual[i] ?? 0) - rm) ** 2;
      const gain = parentSse - sse;
      if (gain > bestGain) {
        bestGain = gain;
        best = { feature: f, threshold: thr, left, right };
      }
    }
  }
  if (!best || bestGain <= 1e-12) return { kind: "leaf", value: leafVal };
  return {
    kind: "split",
    feature: best.feature,
    threshold: best.threshold,
    left: fitTree(X, residual, best.left, depth - 1, minLeaf),
    right: fitTree(X, residual, best.right, depth - 1, minLeaf),
  };
}

function fitGbdt(samples: Sample[], nTrees = 8, lr = 0.12, depth = 2): { init: number; trees: GbdtNode[]; lr: number } {
  const n = samples.length;
  const y = samples.map((s) => s.y);
  const X = samples.map((s) => s.x);
  const init = logit(mean(y));
  const F = new Array<number>(n).fill(init);
  const trees: GbdtNode[] = [];
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let t = 0; t < nTrees; t++) {
    const residual = new Array<number>(n);
    for (let i = 0; i < n; i++) residual[i] = (y[i] ?? 0) - sigmoid(F[i] ?? 0);
    const tree = fitTree(X, residual, idx, depth, 8);
    trees.push(tree);
    for (let i = 0; i < n; i++) {
      F[i] = (F[i] ?? 0) + lr * predictTree(tree, X[i]!);
    }
  }
  return { init, trees, lr };
}

function predictGbdt(model: { init: number; trees: GbdtNode[]; lr: number }, x: [number, number, number]): number {
  let f = model.init;
  for (const tree of model.trees) f += model.lr * predictTree(tree, x);
  return sigmoid(f);
}

function minTrainSize(n: number): number {
  if (n < 40) return Math.max(10, n - 5);
  return Math.min(Math.max(80, Math.floor(n * 0.3)), n - 16);
}

function trainSlice<T>(xs: T[], end: number, cap = 360): T[] {
  const start = Math.max(0, end - cap);
  return xs.slice(start, end);
}

function walkLogistic(samples: Sample[], retrainEvery: number): number[] {
  const n = samples.length;
  const start = minTrainSize(n);
  const preds = new Array<number>(n).fill(0.5);
  let w: number[] = [];
  let edges: number[] = [-0.01, 0, 0.005, 0.01];
  let last = -1;
  for (let i = start; i < n; i++) {
    if (w.length === 0 || i - last >= retrainEvery) {
      const train = trainSlice(samples, i);
      edges = retEdges(train);
      const X = train.map((s) => expandGam(s.x, edges));
      const y = train.map((s) => s.y);
      w = fitLogistic(X, y);
      last = i;
    }
    preds[i] = sigmoid(dot(w, expandGam(samples[i]!.x, edges)));
  }
  return preds.slice(start);
}

function walkGnb(samples: Sample[]): number[] {
  const n = samples.length;
  const start = minTrainSize(n);
  const gnb = new OnlineGnb();
  for (let i = 0; i < start; i++) gnb.update(samples[i]!.x, samples[i]!.y);
  const preds: number[] = [];
  for (let i = start; i < n; i++) {
    preds.push(gnb.predict(samples[i]!.x));
    gnb.update(samples[i]!.x, samples[i]!.y);
  }
  return preds;
}

function walkGbdt(samples: Sample[], retrainEvery: number): number[] {
  const n = samples.length;
  const start = minTrainSize(n);
  const preds: number[] = [];
  let model = fitGbdt(trainSlice(samples, start));
  let last = start;
  for (let i = start; i < n; i++) {
    if (i - last >= retrainEvery) {
      model = fitGbdt(trainSlice(samples, i));
      last = i;
    }
    preds.push(predictGbdt(model, samples[i]!.x));
  }
  return preds;
}

export type WalkResult = { preds: number[]; oosStart: number };

export function walkForward(samples: Sample[], id: CalibModelId): WalkResult {
  const n = samples.length;
  const start = minTrainSize(n);
  if (n < 16) return { preds: [], oosStart: start };
  if (id === "gam-logistic") return { preds: walkLogistic(samples, 48), oosStart: start };
  if (id === "gaussian-nb") return { preds: walkGnb(samples), oosStart: start };
  if (id === "gbdt") return { preds: walkGbdt(samples, 96), oosStart: start };
  return { preds: [], oosStart: start };
}

export function oosStats(
  samples: Sample[],
  walk: WalkResult,
): { predictedPct: number; realizedPct: number; n: number } {
  const { preds, oosStart } = walk;
  const n = preds.length;
  if (n === 0) return { predictedPct: NaN, realizedPct: NaN, n: 0 };
  let pSum = 0;
  let ySum = 0;
  for (let i = 0; i < n; i++) {
    pSum += preds[i] ?? 0;
    ySum += samples[oosStart + i]?.y ?? 0;
  }
  return {
    predictedPct: (pSum / n) * 100,
    realizedPct: (ySum / n) * 100,
    n,
  };
}

export function modelMeta(id: Exclude<CalibModelId, "baseline">): { zh: string; en: string } {
  if (id === "gam-logistic") {
    return { zh: "广义加性逻辑模型", en: "generalized additive logistic" };
  }
  if (id === "gaussian-nb") {
    return { zh: "高斯朴素贝叶斯", en: "Gaussian naive Bayes" };
  }
  return { zh: "梯度提升树", en: "gradient boosting trees" };
}
