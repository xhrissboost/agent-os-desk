# CONNECT.md — Binance MCP Server (Agent Native)

Official docs: [Agent Native MCP Server](https://developers.binance.com/en/docs/agent-native/mcp-server/agentic)

Public name: **Agent Native / Binance MCP Server**. Campaign name: **Agent OS**.

| | |
|---|---|
| Endpoint | `https://agent.binance.com/mcp/agentic` |
| Transport | Streamable HTTP |
| Auth | OAuth (browser). **No API keys** on the laptop. |
| Market data | Public — tickers, order books, candlesticks, funding, 24h change. No auth. |
| Account / trade / transfer | Binance OAuth + auto-created **Agentic virtual sub** |
| Cannot | Withdraw; pull funds from the main account |
| Writes | Confirm-before-execute |
| Trading surface (when authorized) | Spot, margin, convert, USDⓈ-M futures, COIN-M futures, intra-sub transfers |

Binance does **not** publish MCP tool names. Desk binds whatever `tools/list` returns after connect. Do not invent client IDs beyond what the docs ship for each product.

Desk itself does not need this connection for `npm run demo`.

---

## Claude Code

From [the Agent Native MCP docs](https://developers.binance.com/en/docs/agent-native/mcp-server/agentic):

```bash
claude mcp add binance-mcp-server --transport http https://agent.binance.com/mcp/agentic
```

Then in the session:

```
/mcp
```

Authenticate in the browser. Pick the agent. Enable only the scopes you mean. There is no withdrawal scope.

---

## Codex

From the same docs, Codex uses a pre-registered public client id `codex`:

```bash
codex mcp add binance-mcp-server --url https://agent.binance.com/mcp/agentic --oauth-client-id codex
codex mcp login binance-mcp-server
```

Equivalent `~/.codex/config.toml` fragment:

```toml
[mcp_servers.binance-mcp-server]
url = "https://agent.binance.com/mcp/agentic"

[mcp_servers.binance-mcp-server.oauth]
client_id = "codex"
```

---

## VS Code (HTTP MCP)

From the docs, add a streamable HTTP server (`.vscode/mcp.json` or user MCP settings):

```json
{
  "servers": {
    "binance-mcp-server": {
      "type": "http",
      "url": "https://agent.binance.com/mcp/agentic"
    }
  }
}
```

Older `mcpServers` shape used by some VS Code MCP builds:

```json
{
  "mcpServers": {
    "binance-mcp-server": {
      "url": "https://agent.binance.com/mcp/agentic"
    }
  }
}
```

Sign in when VS Code prompts. No API key field.

---

## Grok Bot

Grok Bot connect snippet from the docs uses `oauth_client_id = grok`:

```toml
[mcp_servers.binance-mcp-server]
url = "https://agent.binance.com/mcp/agentic"
oauth_client_id = "grok"
```

Do not substitute another id.

---

## After connect

1. Fund the **Agentic virtual sub** yourself (Profile → Sub-account Asset Management). The agent cannot pull from main.
2. Treat that balance as the max loss. Binance does not publish a separate MCP max-loss.
3. Every non-read stays confirm-first. Desk additionally requires `DESK_LIVE=1` and `--confirm`.
4. Track B (spot + futures + margin/convert) is the authorized trading surface — not this repo's default demo.

To point Desk at an already-completed OAuth session:

```bash
export DESK_MCP_URL=https://agent.binance.com/mcp/agentic
export DESK_MCP_TOKEN=...   # optional bearer; never commit
npx desk mcp-status
```

---

## Skills Hub (onchain)

```bash
npx skills add https://github.com/binance/binance-skills-hub
```

Write path: `binance-agentic-wallet` (`baw`). Desk's onchain workflow stays dry-run unless you confirm a `baw` command yourself, outside `desk demo`.
