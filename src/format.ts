export function usd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "n/a";
  const abs = Math.abs(n);
  const d = abs >= 1000 || abs === 0 ? digits : abs < 1 ? 4 : digits;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function pct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "n/a";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function fundingPct(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`;
}

export function signed(n: number, digits = 3): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}`;
}

export function truncate(s: string, n = 96): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

export function iso(ms = Date.now()): string {
  return new Date(ms).toISOString();
}

export function rule(title: string): string {
  const pad = Math.max(0, 64 - title.length);
  return `── ${title} ${"─".repeat(pad)}`;
}

export function banner(title: string, subtitle?: string): string {
  const lines = [
    "════════════════════════════════════════════════════════════════",
    ` ${title}`,
  ];
  if (subtitle) lines.push(` ${subtitle}`);
  lines.push("════════════════════════════════════════════════════════════════");
  return lines.join("\n");
}
