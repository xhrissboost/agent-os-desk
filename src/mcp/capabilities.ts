import { asRecord } from "../http.js";
import type { DiscoveredTool } from "./client.js";
import type { McpStatus } from "../types.js";

export { BinanceMcpClient, defaultVenue, mcpStatus } from "./client.js";

export type { DiscoveredTool };

export function hasCapability(
  status: McpStatus,
  name: keyof McpStatus["capabilities"],
): boolean {
  return status.capabilities[name];
}

export function toolNames(tools: DiscoveredTool[]): string[] {
  return tools.map((t) => t.name);
}

export function looksLikeJsonRpc(body: unknown): boolean {
  const rec = asRecord(body);
  return Boolean(rec && rec.jsonrpc === "2.0");
}
