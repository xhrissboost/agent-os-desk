import { MCP_ENDPOINT } from "../config.js";
import { asRecord } from "../http.js";
import type { McpStatus, TradeIntent, Venue } from "../types.js";

export type DiscoveredTool = {
  name: string;
  description?: string;
};

const CAPABILITY_HINTS: Record<keyof McpStatus["capabilities"], RegExp> = {
  market: /ticker|depth|kline|candle|book|funding|market/i,
  account: /balance|account|position|wallet/i,
  trade: /order|trade|spot|futures|margin|convert/i,
  transfer: /transfer/i,
};

function classify(tools: DiscoveredTool[]): McpStatus["capabilities"] {
  const caps: McpStatus["capabilities"] = {
    market: false,
    account: false,
    trade: false,
    transfer: false,
  };
  for (const tool of tools) {
    const hay = `${tool.name} ${tool.description ?? ""}`;
    for (const key of Object.keys(caps) as Array<keyof McpStatus["capabilities"]>) {
      if (CAPABILITY_HINTS[key].test(hay)) caps[key] = true;
    }
  }
  return caps;
}

function disconnected(note: string, reachable = false): McpStatus {
  return {
    endpoint: MCP_ENDPOINT,
    reachable,
    authenticated: false,
    tools: [],
    capabilities: { market: false, account: false, trade: false, transfer: false },
    note,
  };
}

/**
 * Thin MCP client. Binance does not publish tool names — we only bind to
 * whatever `tools/list` returns after OAuth. Public market data never depends
 * on this client; REST fallback always exists.
 */
export class BinanceMcpClient {
  constructor(
    readonly endpoint = MCP_ENDPOINT,
    readonly token = process.env.DESK_MCP_TOKEN,
  ) {}

  async status(): Promise<McpStatus> {
    if (!this.token) {
      const reachable = await this.ping();
      return disconnected(
        reachable
          ? "MCP endpoint reachable; no OAuth token. Market data uses public REST. Account/trade unbound."
          : "MCP not connected (no OAuth). Demo continues on public REST.",
        reachable,
      );
    }
    try {
      const tools = await this.listTools();
      const capabilities = classify(tools);
      return {
        endpoint: this.endpoint,
        reachable: true,
        authenticated: true,
        tools: tools.map((t) => t.name),
        capabilities,
        note: tools.length
          ? `bound ${tools.length} discovered tool(s); names not assumed in advance`
          : "authenticated but tools/list was empty",
      };
    } catch (err) {
      return disconnected(
        `MCP token present but session failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "desk", version: "1.0.0" },
          },
        }),
        signal: AbortSignal.timeout(8000),
      });
      return res.status !== 404 && res.status < 500;
    } catch {
      return false;
    }
  }

  async listTools(): Promise<DiscoveredTool[]> {
    if (!this.token) return [];
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json: unknown = await res.json().catch(() => null);
    const rec = asRecord(json);
    const result = asRecord(rec?.result);
    const tools = result?.tools;
    if (!Array.isArray(tools)) return [];
    const out: DiscoveredTool[] = [];
    for (const t of tools) {
      const row = asRecord(t);
      if (!row || typeof row.name !== "string") continue;
      const tool: DiscoveredTool = { name: row.name };
      if (typeof row.description === "string") tool.description = row.description;
      out.push(tool);
    }
    return out;
  }

  bind(tools: DiscoveredTool[], capability: keyof McpStatus["capabilities"]): DiscoveredTool | null {
    const re = CAPABILITY_HINTS[capability];
    return tools.find((t) => re.test(`${t.name} ${t.description ?? ""}`)) ?? null;
  }

  /**
   * Never invents a tool name. If no trade tool was discovered, returns the
   * payload that *would* be sent after bind.
   */
  tradePayload(intent: Omit<TradeIntent, "capability" | "confirmBeforeExecute">): TradeIntent {
    return {
      capability: "trade",
      confirmBeforeExecute: true,
      ...intent,
    };
  }
}

export function defaultVenue(): Venue {
  return "spot";
}

export async function mcpStatus(): Promise<McpStatus> {
  return new BinanceMcpClient().status();
}
