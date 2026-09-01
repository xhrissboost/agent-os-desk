import {
  B402_BAZAAR_BASE,
  B402_TESTNET_CAIP,
  B402_TESTNET_CHAIN_ID,
  DEMO_COUNTERPARTY_PAY_TO,
  MEMO_PRICE_USD,
  USD1_BSC,
  X402_MAX_USD,
} from "../config.js";
import { asRecord, envelopeOk, fetchJson, str } from "../http.js";
import { iso } from "../format.js";
import type {
  AlphaReport,
  BazaarAccept,
  BazaarResource,
  DataSource,
  GatedMemo,
  PaymentRequired,
  PaymentReceipt,
  PaymentRun,
  PaymentTraceStep,
} from "../types.js";
import { demoPaymentSignature, encodePaymentRequired, merchantRequirement, merchantRespond } from "./merchant.js";

const FIXTURE_BAZAAR: BazaarResource[] = [
  {
    resource: "https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest",
    type: "http",
    x402Version: 2,
    description: "CoinMarketCap quotes (fixture)",
    accepts: [
      {
        scheme: "eip3009",
        network: "eip155:56",
        asset: USD1_BSC,
        maxAmountRequired: "10000000000000000",
        payTo: "0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA",
      },
    ],
  },
];

function parseAccept(raw: unknown): BazaarAccept | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const payTo = str(rec.payTo);
  const asset = str(rec.asset);
  const network = str(rec.network);
  if (!payTo || !asset || !network) return null;
  return {
    scheme: str(rec.scheme, "exact"),
    network,
    asset,
    maxAmountRequired: rec.maxAmountRequired != null ? str(rec.maxAmountRequired) : undefined,
    amount: rec.amount != null ? str(rec.amount) : undefined,
    payTo,
  };
}

export function parseBazaarEnvelope(body: unknown): BazaarResource[] {
  const rec = asRecord(body);
  if (!rec) return [];
  const data = asRecord(rec.data) ?? rec;
  const items = data.items ?? data.resources ?? (Array.isArray(rec.data) ? rec.data : null);
  if (!Array.isArray(items)) return [];
  const out: BazaarResource[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const resource = str(row.resource);
    if (!resource) continue;
    const accepts = Array.isArray(row.accepts)
      ? row.accepts.map(parseAccept).filter((a): a is BazaarAccept => a !== null)
      : [];
    const parsed: BazaarResource = {
      resource,
      type: str(row.type, "http"),
      x402Version: typeof row.x402Version === "number" ? row.x402Version : 2,
      description: str(row.description, resource),
      accepts,
    };
    if (typeof row.lastUpdated === "number") parsed.lastUpdated = row.lastUpdated;
    out.push(parsed);
  }
  return out;
}

export async function fetchBazaarResources(): Promise<{ items: BazaarResource[]; source: DataSource }> {
  try {
    const { json, host } = await fetchJson(`${B402_BAZAAR_BASE}/bazaar/resources`);
    if (!envelopeOk(json) && parseBazaarEnvelope(json).length === 0) {
      throw new Error("bazaar envelope empty");
    }
    const items = parseBazaarEnvelope(json);
    if (items.length === 0) throw new Error("no bazaar items");
    return { items, source: { kind: "bazaar", host } };
  } catch (err) {
    return {
      items: FIXTURE_BAZAAR,
      source: {
        kind: "fixture",
        note: `bazaar unreachable (${err instanceof Error ? err.message : String(err)}); using catalog snapshot`,
      },
    };
  }
}

export async function searchBazaar(query: string): Promise<BazaarResource[]> {
  try {
    const { json } = await fetchJson(
      `${B402_BAZAAR_BASE}/bazaar/search?q=${encodeURIComponent(query)}`,
    );
    return parseBazaarEnvelope(json);
  } catch {
    return [];
  }
}

export async function merchantBazaar(payTo: string): Promise<BazaarResource[]> {
  try {
    const { json } = await fetchJson(
      `${B402_BAZAAR_BASE}/bazaar/merchant?payTo=${encodeURIComponent(payTo)}`,
    );
    return parseBazaarEnvelope(json);
  } catch {
    return [];
  }
}

/**
 * Build an x402 PaymentRequired for Desk → Counterparty.
 * Discovery uses the public B402 bazaar. Settlement is remapped to BSC
 * testnet (eip155:97) and paid locally — we do not call authenticated
 * /papi/v2/b402/{supported,verify,settle}.
 */
export function buildPaymentRequired(
  resource: BazaarResource,
  opts?: { amount?: string; description?: string },
): PaymentRequired {
  const listed = resource.accepts[0];
  const amount = opts?.amount ?? listed?.maxAmountRequired ?? listed?.amount ?? "10000000000000000";
  return {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: resource.resource,
      description:
        opts?.description ??
        resource.description ??
        "Desk counterparty receipt for a risk-limited signal",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: listed?.scheme ?? "eip3009",
        network: B402_TESTNET_CAIP,
        amount,
        asset: listed?.asset ?? USD1_BSC,
        payTo: DEMO_COUNTERPARTY_PAY_TO,
        maxTimeoutSeconds: 60,
        extra: {
          name: "USD1",
          originalNetwork: listed?.network ?? "eip155:56",
          settlement: "local-mock",
          chain: "bsc-testnet",
        },
      },
    ],
    extensions: {
      b402: {
        bazaar: B402_BAZAAR_BASE,
        authenticatedPapiSkipped: true,
      },
    },
  };
}

export function amountUsdFromAccept(accept: BazaarAccept): number | null {
  const atomic = Number(accept.maxAmountRequired ?? accept.amount ?? "");
  if (!Number.isFinite(atomic) || atomic <= 0) return null;
  return atomic / 1e18;
}

export function cheapBazaarListings(items: BazaarResource[]): BazaarResource[] {
  return items.filter((item) =>
    item.accepts.some((a) => {
      const usd = amountUsdFromAccept(a);
      return usd != null && usd > 0 && usd <= X402_MAX_USD;
    }),
  );
}

export function mockSettle(requirement: PaymentRequired, amountUsd = MEMO_PRICE_USD): PaymentReceipt {
  const accept = requirement.accepts[0]!;
  const seed = `${requirement.resource.url}:${accept.amount}:${iso()}`;
  const txHash = `0x${Buffer.from(seed).toString("hex").slice(0, 64).padEnd(64, "0")}`;
  return {
    settlement: "mock",
    chainId: B402_TESTNET_CHAIN_ID,
    network: accept.network,
    payer: "Desk",
    payee: "Counterparty",
    amount: accept.amount,
    amountUsd,
    asset: accept.asset,
    txHash,
    settledAt: iso(),
    resource: requirement.resource.url,
  };
}

export function paymentTrace(
  requirement: PaymentRequired,
  receipt: PaymentReceipt | null,
): PaymentTraceStep[] {
  const encoded = encodePaymentRequired(requirement);
  const steps: PaymentTraceStep[] = [
    {
      status: 200,
      title: "Desk GET /alpha-memo",
      detail: "Counterparty merchant: gated Alpha Memo. No PAYMENT-SIGNATURE yet.",
    },
    {
      status: 402,
      title: "HTTP 402 Payment Required",
      detail: `PAYMENT-REQUIRED (${encoded.length} b64 bytes). x402 v2 · ${requirement.accepts[0]?.network ?? ""} · $${MEMO_PRICE_USD}.`,
      body: requirement,
    },
    {
      status: "PAY",
      title: "Desk attaches PAYMENT-SIGNATURE",
      detail: "Local merchant only. Authenticated /papi/v2/b402/settle is not used (no partner key).",
    },
  ];
  if (receipt) {
    steps.push({
      status: 200,
      title: "Counterparty returns gated memo + receipt",
      detail: `PAYMENT-RESPONSE ${receipt.txHash.slice(0, 18)}…`,
      body: receipt,
    });
  }
  return steps;
}

function buildMemo(report?: AlphaReport): GatedMemo {
  const row = report?.row;
  const body = row
    ? [
        `${row.symbol} last ${row.ticker.lastPrice}`,
        `24h ${row.ticker.priceChangePercent}%`,
        `imb ${row.book.imbalance.toFixed(3)}`,
        `fund ${row.funding ? row.funding.lastFundingRate : "n/a"}`,
        `S ${row.levels.support} R ${row.levels.resistance}`,
        `audit ${report?.audit.riskLevelEnum ?? "n/a"}`,
        report?.skillSignal.summary ?? "",
      ].join(" · ")
    : "Alpha Memo placeholder";
  return {
    title: `ScoutPay Alpha Memo · ${report?.symbol ?? "BNBUSDT"}`,
    body,
    symbol: report?.symbol ?? "BNBUSDT",
  };
}

export async function runPaymentWorkflow(report?: AlphaReport): Promise<PaymentRun> {
  const { items, source } = await fetchBazaarResources();
  const cheap = cheapBazaarListings(items);
  const memo = buildMemo(report);
  const requirement = merchantRequirement();
  const amountUsd = MEMO_PRICE_USD;
  const readyToSign = amountUsd > 0 && amountUsd <= X402_MAX_USD;
  const signatureHeader = demoPaymentSignature(requirement);
  const fulfilled = merchantRespond(signatureHeader, memo);
  const receipt: PaymentReceipt | null =
    fulfilled.status === 200 && fulfilled.receiptHash
      ? {
          settlement: "merchant",
          chainId: B402_TESTNET_CHAIN_ID,
          network: B402_TESTNET_CAIP,
          payer: "Desk",
          payee: "Counterparty",
          amount: requirement.accepts[0]!.amount,
          amountUsd,
          asset: requirement.accepts[0]!.asset,
          txHash: fulfilled.receiptHash,
          settledAt: iso(),
          resource: requirement.resource.url,
        }
      : null;

  const trace = paymentTrace(requirement, receipt);
  trace.splice(1, 0, {
    status: "SCAN",
    title: "B402 bazaar scan",
    detail:
      cheap.length > 0
        ? `${cheap.length}/${items.length} public listings ≤ $${X402_MAX_USD} — still using in-repo merchant so the gated memo works without a partner settle key.`
        : `${items.length} bazaar listings scanned; none ≤ $${X402_MAX_USD} with parseable amount. In-repo merchant is the demo.`,
  });

  return {
    rail: "merchant",
    bazaarSource: source,
    listed: items.length,
    cheapListings: cheap.length,
    picked: cheap[0] ?? null,
    requirement,
    amountUsd,
    readyToSign,
    signatureHeader,
    memo: fulfilled.memo ?? null,
    trace,
    receipt,
  };
}
