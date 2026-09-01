const DEFAULT_TIMEOUT_MS = 12_000;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly bodyText: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ json: unknown; host: string; status: number }> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        accept: "application/json",
        "user-agent": "desk-agent/1.0.0",
        ...(rest.headers ?? {}),
      },
    });
    const bodyText = await res.text();
    let json: unknown = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      json = { raw: bodyText.slice(0, 400) };
    }
    if (!res.ok) {
      throw new HttpError(
        `HTTP ${res.status} ${res.statusText} for ${url}`,
        res.status,
        url,
        bodyText.slice(0, 800),
      );
    }
    return { json, host: new URL(url).host, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export function isGeoBlocked(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const rec = body as Record<string, unknown>;
  const msg = String(rec.msg ?? rec.message ?? "");
  return /restricted location/i.test(msg);
}

export function envelopeOk(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const rec = body as Record<string, unknown>;
  if (rec.success === false) return false;
  if (rec.code === "000000" || rec.code === 0 || rec.code === "0") return true;
  if (rec.success === true) return true;
  return rec.data !== undefined && rec.code == null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
