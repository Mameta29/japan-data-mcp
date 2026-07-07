# japan-data-mcp

[![npm version](https://img.shields.io/npm/v/@mameta/japan-data-mcp)](https://www.npmjs.com/package/@mameta/japan-data-mcp)
[![license](https://img.shields.io/npm/l/@mameta/japan-data-mcp)](https://www.apache.org/licenses/LICENSE-2.0)

> npm: [`@mameta/japan-data-mcp`](https://www.npmjs.com/package/@mameta/japan-data-mcp) · MCP Registry: `io.github.Mameta29/japan-data-mcp` · transport: **stdio**

An **MCP server** that gives AI agents (Claude Desktop, Cursor, Cline, …) one-call
access to the [agentic-jp.com](https://agentic-jp.com) suite of Japanese data
APIs. Every call is settled per-use over the **x402** payment protocol — no
account, no subscription, no API key.

## What it covers — 30 tools across 7 APIs

| API | Tools | What it does |
|---|---|---|
| **address** | `address_normalize`, `address_geocode`, `address_reverse_geocode`, `address_postal_code`, `address_parse` | Japanese address normalization, geocoding, postal-code lookup, free-form parsing |
| **furigana** | `furigana_convert`, `furigana_name_readings`, `furigana_classify` | Reading conversion, name readings, text classification |
| **transit** | `transit_station_status`, `transit_line_disruptions`, `transit_route_plan`, `transit_alternative_routes`, `transit_lines`, `transit_stations_search` | Real-time rail delays + delay-aware route planning (ODPT) |
| **diet** | `diet_member`, `diet_members_search`, `diet_minutes_search`, `diet_minutes_summarize`, `diet_topic_track`, | National Diet members, proceedings, AI summaries, votes |
| **holiday** | `holiday_is_holiday`, `holiday_list`, `holiday_add_business_days`, `holiday_business_days_between` | Public holidays + business-day math |
| **weather** | `weather_forecast`, `weather_warnings`, `weather_areas` | JMA forecasts and warnings |
| **houjin** | `houjin_corporation`, `houjin_search`, `houjin_verify` | Corporate-number (法人番号) registry — 5.78M corporations |

## How payment works

x402 is a **buyer-pays** protocol. This MCP server holds **your** wallet and pays
each API call transparently — the agent never sees a payment prompt. Calls cost
roughly **$0.001–$0.10 each** (mostly sub-cent), settled in USDC on Base.

- You fund a wallet with a small amount of USDC.
- You set `EVM_PRIVATE_KEY` to that wallet's key.
- The server pays as it goes; per-call cost is well under a cent for most tools.

Without `EVM_PRIVATE_KEY` the server still starts and lists every tool, but a
paid tool call returns a clear "payment not configured" message — nothing is
charged.

> **Security:** the key in `EVM_PRIVATE_KEY` can spend that wallet's funds. Use a
> dedicated wallet funded with only what you intend to spend — never a primary
> wallet.

## Setup

No install step — `npx` fetches and runs the server on demand.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "japan-data": {
      "command": "npx",
      "args": ["-y", "@mameta/japan-data-mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0xYOUR_FUNDED_WALLET_KEY"
      }
    }
  }
}
```

Without `EVM_PRIVATE_KEY` the server still starts and lists all 30 tools;
the paid tools then return a clear "payments disabled" error instead of
running. Add a USDC-funded wallet key to enable them.

### Cursor / Cline

Point the MCP client at `npx -y @mameta/japan-data-mcp` with the same
`EVM_PRIVATE_KEY` env var. Transport is stdio.

### From source

```bash
git clone https://github.com/Mameta29/japan-data-mcp.git
cd japan-data-mcp
npm install && npm run build
# then point the MCP client at: node /abs/path/to/dist/index.js
```

## Example prompts

Once connected, just ask the agent in natural language:

- "「東京都千代田区丸の内1-1」を正規化して緯度経度も出して" — `address_normalize` + `address_geocode`
- "Is tomorrow a public holiday in Japan? If so, when is the next business day?" — `holiday_is_holiday` + `holiday_add_business_days`
- "山手線いま遅れてる?渋谷から東京駅までの代替ルートは?" — `transit_line_disruptions` + `transit_alternative_routes`
- "Look up the corporation with corporate number 7010401056220" — `houjin_corporation`
- "国会で「デジタル庁」について最近議論された内容を要約して" — `diet_minutes_search` + `diet_minutes_summarize`

## Configuration

| Env var | Required | Description |
|---|---|---|
| `EVM_PRIVATE_KEY` | for paid tools | Private key of a USDC-funded wallet (Base / Polygon). Paid tools are disabled if absent. |

## Development

```bash
npm run dev        # run from source with tsx
npm run typecheck  # tsc --noEmit
npm run build      # compile to dist/
```

## License

Apache-2.0
