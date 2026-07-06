#!/usr/bin/env node
/**
 * japan-data-mcp — an MCP server that exposes the agentic-jp.com suite of
 * x402-paid Japan data APIs (address, furigana, transit, Diet, holiday,
 * weather, corporate-number) as tools for AI agents.
 *
 * Transport: stdio. Designed to be registered in Claude Desktop / Cursor.
 *
 * Payment model: x402 is buyer-pays. This server holds the *operator's*
 * wallet (EVM_PRIVATE_KEY) and pays each API call transparently — the agent
 * never sees a 402. Without a wallet the server still starts and lists every
 * tool, but a paid call fails with a clear, actionable message.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { APIS } from "./apis.js";
import { createHttpClient, type HttpClient } from "./client.js";
import { TOOLS, type ToolDef } from "./tools.js";

const SERVER_NAME = "japan-data-mcp";
const SERVER_VERSION = "1.0.0";

/** Build the human-facing instructions block for the server handshake. */
function buildInstructions(http: HttpClient): string {
  const apiLines = Object.values(APIS)
    .map((a) => `  - ${a.id}: ${a.description}`)
    .join("\n");
  const wallet = http.paymentEnabled
    ? `Payments are ENABLED. Calls are paid in USDC from wallet ${http.payerAddress}.`
    : `Payments are DISABLED — set EVM_PRIVATE_KEY to a funded wallet to use paid tools.`;
  return [
    "Japanese data APIs for AI agents, billed per call over the x402 protocol.",
    "",
    "Covered domains:",
    apiLines,
    "",
    wallet,
    "Each tool's result is the raw JSON returned by the underlying API.",
  ].join("\n");
}

/**
 * Run one tool: build the HTTP request, call the API (paying if needed), and
 * normalize the outcome into MCP tool-result content.
 */
async function runTool(
  tool: ToolDef,
  args: Record<string, unknown>,
  http: HttpClient,
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  if (tool.paid && !http.paymentEnabled) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text:
            `Tool "${tool.name}" requires payment, but no wallet is configured. ` +
            `Set the EVM_PRIVATE_KEY environment variable to a wallet funded with ` +
            `USDC on Base (or Polygon) and restart the MCP server.`,
        },
      ],
    };
  }

  const spec = tool.buildRequest(args);
  const api = APIS[tool.api];
  if (!api) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown API "${tool.api}" for tool "${tool.name}".` }],
    };
  }
  const url = `${api.baseUrl}${spec.path}`;

  try {
    const res = await http.axios.request({
      url,
      method: spec.method,
      ...(spec.body !== undefined ? { data: spec.body } : {}),
      ...(spec.query ? { params: spec.query } : {}),
      headers: { accept: "application/json" },
    });

    if (res.status >= 200 && res.status < 300) {
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    // 402 reaching here means the payment step did not complete — usually an
    // unfunded wallet or an unsupported network. Make that explicit.
    if (res.status === 402) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `Payment required and not completed for "${tool.name}". ` +
              `Check that the wallet has USDC on Base/Polygon and enough gas. ` +
              `API response: ${JSON.stringify(res.data)}`,
          },
        ],
      };
    }

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `API returned HTTP ${res.status} for "${tool.name}": ${JSON.stringify(res.data)}`,
        },
      ],
    };
  } catch (err) {
    // With a wallet configured, axios rejects on 402 so the @x402/axios
    // interceptor can pay. If a 402 still surfaces here, payment did not
    // complete — most often an unfunded wallet or insufficient USDC.
    const status =
      typeof err === "object" && err !== null && "response" in err
        ? (err as { response?: { status?: number; data?: unknown } }).response?.status
        : undefined;
    if (status === 402) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `Payment for "${tool.name}" could not be completed. ` +
              `Check that the configured wallet holds enough USDC on Base or Polygon.`,
          },
        ],
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Request failed for "${tool.name}": ${msg}` }],
    };
  }
}

async function main(): Promise<void> {
  const http = createHttpClient();

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: buildInstructions(http) },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          // Every tool is a read-only data lookup.
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (args: Record<string, unknown>) => runTool(tool, args ?? {}, http),
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[${SERVER_NAME}] ready — ${TOOLS.length} tools, ` +
      `payments ${http.paymentEnabled ? "enabled" : "disabled"}.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[${SERVER_NAME}] fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
