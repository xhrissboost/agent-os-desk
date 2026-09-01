import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { B402_TESTNET_CHAIN_ID, SKILLS_HUB_REPO, USDT_BSC, WEB3_API, WEB3_AUDIT_UA, WEB3_SKILL_UA } from "../config.js";
import { asRecord, envelopeOk, fetchJson, num, str } from "../http.js";
import type { DataSource, DefiIntent, OnchainRun, TokenAudit, TokenInspect } from "../types.js";

export const PUBLISHED_READ_SKILLS = [
  "query-token-info",
  "query-token-audit",
  "query-address-info",
  "crypto-market-rank",
  "meme-rush",
  "trading-signal",
  "binance-tokenized-securities-info",
] as const;

export const WRITE_SKILL = "binance-agentic-wallet";

function skillsRoots(): string[] {
  const extra = process.env.DESK_SKILLS_DIR;
  return [
    extra,
    join(process.cwd(), "skills"),
    join(homedir(), ".agents", "skills"),
    join(homedir(), ".claude", "skills"),
  ].filter((p): p is string => Boolean(p));
}

export function skillCliPath(name: string): string | null {
  for (const root of skillsRoots()) {
    const candidate = join(root, "binance-web3", name, "scripts", "cli.mjs");
    if (existsSync(candidate)) return candidate;
    const alt = join(root, name, "scripts", "cli.mjs");
    if (existsSync(alt)) return alt;
  }
  return null;
}

export function walletSkillInstalled(): boolean {
  if (skillCliPath(WRITE_SKILL)) return true;
  const which = spawnSync("which", ["baw"], { encoding: "utf8" });
  return which.status === 0;
}

async function invokeSkillOrHttp(
  skill: string,
  command: string,
  params: Record<string, unknown>,
  httpFallback: () => Promise<{ json: unknown; source: DataSource }>,
): Promise<{ json: unknown; source: DataSource }> {
  const cli = skillCliPath(skill);
  if (cli) {
    const result = spawnSync(process.execPath, [cli, command, JSON.stringify(params)], {
      encoding: "utf8",
      timeout: 15_000,
    });
    if (result.status === 0 && result.stdout) {
      try {
        return {
          json: JSON.parse(result.stdout),
          source: { kind: "skills-hub", note: `${skill} ${command} via ${cli}` },
        };
      } catch {
        /* fall through to HTTP */
      }
    }
  }
  return httpFallback();
}

export async function inspectToken(symbol = "USDT"): Promise<TokenInspect> {
  const { json, source } = await invokeSkillOrHttp(
    "query-token-info",
    "search",
    { keyword: symbol, chainIds: "56" },
    async () => {
      const { json: body, host } = await fetchJson(
        `${WEB3_API}/bapi/defi/v5/public/wallet-direct/buw/wallet/market/token/search/ai?keyword=${encodeURIComponent(symbol)}&chainIds=56`,
        { headers: { "user-agent": WEB3_SKILL_UA, "accept-encoding": "identity" } },
      );
      return { json: body, source: { kind: "skills-hub", host, note: "query-token-info HTTP adapter" } };
    },
  );

  const rec = asRecord(json);
  const list = Array.isArray(rec?.data) ? rec.data : Array.isArray(json) ? json : [];
  const first = asRecord(list[0]) ?? asRecord(asRecord(rec?.data)?.data);
  if (!first) {
    return {
      chainId: "56",
      contractAddress: USDT_BSC,
      symbol,
      source: { kind: "fixture", note: "token search empty; USDT BSC canonical" },
    };
  }
  return {
    chainId: str(first.chainId, "56"),
    contractAddress: str(first.contractAddress, USDT_BSC),
    name: str(first.name) || undefined,
    symbol: str(first.symbol, symbol) || undefined,
    priceUsd: num(first.price, NaN) || undefined,
    change24hPct: num(first.percentChange24h, NaN) || undefined,
    liquidityUsd: num(first.liquidity, NaN) || undefined,
    source,
  };
}

export async function auditToken(chainId: string, contractAddress: string): Promise<TokenAudit> {
  const requestId = crypto.randomUUID();
  try {
    const { json, host } = await fetchJson(
      `${WEB3_API}/bapi/defi/v1/public/wallet-direct/security/token/audit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          source: "agent",
          "accept-encoding": "identity",
          "user-agent": WEB3_AUDIT_UA,
        },
        body: JSON.stringify({
          binanceChainId: chainId,
          contractAddress,
          requestId,
        }),
      },
    );
    const rec = asRecord(json);
    const data = asRecord(rec?.data);
    if (!envelopeOk(json) || !data) {
      return {
        hasResult: false,
        isSupported: false,
        hits: [],
        source: { kind: "skills-hub", host, note: "audit envelope empty" },
      };
    }
    const extra = asRecord(data.extraInfo);
    const hits: string[] = [];
    if (Array.isArray(data.riskItems)) {
      for (const item of data.riskItems) {
        const row = asRecord(item);
        const details = Array.isArray(row?.details) ? row.details : [];
        for (const d of details) {
          const det = asRecord(d);
          if (det?.isHit) hits.push(str(det.title, "hit"));
        }
      }
    }
    return {
      hasResult: Boolean(data.hasResult),
      isSupported: Boolean(data.isSupported),
      riskLevelEnum: str(data.riskLevelEnum) || undefined,
      riskLevel: typeof data.riskLevel === "number" ? data.riskLevel : undefined,
      buyTax: extra ? str(extra.buyTax) || undefined : undefined,
      sellTax: extra ? str(extra.sellTax) || undefined : undefined,
      hits,
      source: { kind: "skills-hub", host, note: "query-token-audit HTTP adapter" },
    };
  } catch (err) {
    return {
      hasResult: false,
      isSupported: false,
      hits: [],
      source: {
        kind: "fixture",
        note: `audit unavailable (${err instanceof Error ? err.message : String(err)})`,
      },
    };
  }
}

export function proposeDefiIntent(token: TokenInspect, audit: TokenAudit): DefiIntent {
  const installed = walletSkillInstalled();
  const blocked = audit.hasResult && audit.isSupported && (audit.riskLevel ?? 0) >= 4;
  const summary = blocked
    ? `BLOCKED: audit ${audit.riskLevelEnum ?? audit.riskLevel} — no LP/stake intent`
    : `Add LP on BSC testnet (chain ${B402_TESTNET_CHAIN_ID}) for ${token.symbol ?? token.contractAddress} / USD1 after Desk receipt. Not mainnet.`;
  return {
    action: "lp-add",
    chain: "bsc-testnet",
    chainId: B402_TESTNET_CHAIN_ID,
    dryRun: true,
    walletSkillInstalled: installed,
    summary,
    bawCommand: `baw defi preview --json --chain ${B402_TESTNET_CHAIN_ID} --action lp-add --token ${token.contractAddress}`,
    note: installed
      ? "binance-agentic-wallet / baw detected — still dry-run unless the operator confirms outside this demo."
      : `Write skill not installed. Install via: npx skills add ${SKILLS_HUB_REPO} — demo stays dry-run.`,
  };
}

export async function runOnchainWorkflow(): Promise<OnchainRun> {
  const token = await inspectToken("USDT");
  const audit = await auditToken(token.chainId, token.contractAddress);
  const intent = proposeDefiIntent(token, audit);
  const adapters = [
    ...PUBLISHED_READ_SKILLS.map((s) => `${s}${skillCliPath(s) ? " (cli)" : " (http/docs adapter)"}`),
    `${WRITE_SKILL}${intent.walletSkillInstalled ? " (present, unused)" : " (absent)"}`,
  ];
  return { token, audit, intent, adapters };
}
