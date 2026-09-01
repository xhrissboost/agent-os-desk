import {
  B402_BAZAAR_BASE,
  B402_TESTNET_CAIP,
  B402_TESTNET_CHAIN_ID,
  DEMO_COUNTERPARTY_PAY_TO,
  USD1_BSC,
} from "../config.js";
import { asRecord, envelopeOk, fetchJson, str } from "../http.js";
import { iso } from "../format.js";
import type {
  BazaarAccept,
  BazaarResource,
  DataSource,
  PaymentRequired,
  PaymentReceipt,
  PaymentRun,
  PaymentTraceStep,
} from "../types.js";

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

export function mockSettle(requirement: PaymentRequired): PaymentReceipt {
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
    asset: accept.asset,
    txHash,
    settledAt: iso(),
    resource: requirement.resource.url,
  };
}

export function paymentTrace(
  requirement: PaymentRequired,
  receipt: PaymentReceipt,
): PaymentTraceStep[] {
  const encoded = Buffer.from(JSON.stringify(requirement)).toString("base64");
  return [
    {
      status: 200,
      title: "Desk GET /signal-receipt",
      detail: "Counterparty agent exposes a paid resource. No PAYMENT-SIGNATURE yet.",
    },
    {
      status: 402,
      title: "HTTP 402 Payment Required",
      detail: `PAYMENT-REQUIRED header (${encoded.length} b64 bytes). Network remapped to ${B402_TESTNET_CAIP}.`,
      body: requirement,
    },
    {
      status: "PAY",
      title: "Desk signs local x402 payload",
      detail: "Authenticated Binance /papi/v2/b402/settle is not used (no partner key). Local mock on chain 97.",
    },
    {
      status: 200,
      title: "Counterparty returns receipt",
      detail: `PAYMENT-RESPONSE settled mock tx ${receipt.txHash.slice(0, 18)}…`,
      body: receipt,
    },
  ];
}

export async function runPaymentWorkflow(): Promise<PaymentRun> {
  const { items, source } = await fetchBazaarResources();
  const searched = await searchBazaar("market");
  const picked =
    searched.find((r) => /market|quote|crypto/i.test(`${r.description} ${r.resource}`)) ??
    items[0] ??
    FIXTURE_BAZAAR[0]!;

  const merchant = picked.accepts[0]?.payTo
    ? await merchantBazaar(picked.accepts[0].payTo)
    : [];

  const requirement = buildPaymentRequired(picked, {
    description: "Agent-to-agent: Counterparty notarizes Desk's signal blotter (demo)",
  });
  const receipt = mockSettle(requirement);
  const trace = paymentTrace(requirement, receipt);

  if (merchant.length) {
    trace[0] = {
      ...trace[0]!,
      detail: `${trace[0]!.detail} Merchant catalog matched ${merchant.length} resource(s) for payTo.`,
    };
  }

  return {
    bazaarSource: source,
    listed: items.length,
    picked,
    requirement,
    trace,
    receipt,
  };
}
