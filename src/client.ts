/**
 * HTTP client construction for the MCP server.
 *
 * The server makes plain HTTP calls to the seven agentic-jp.com APIs. Free
 * endpoints (health, /.well-known/*, list endpoints) need no payment. Paid
 * endpoints answer with HTTP 402; when a wallet is configured, @x402/axios
 * intercepts the 402, signs a USDC payment, and retries — transparently.
 *
 * Wallet configuration is the *operator's* responsibility: x402 is a
 * buyer-pays protocol, so whoever runs this MCP server pays for the calls it
 * makes. Without EVM_PRIVATE_KEY the server still runs, but paid tools fail
 * with a clear "payment not configured" message instead of charging anyone.
 */
import axios, { type AxiosInstance } from "axios";
import { wrapAxiosWithPayment, x402Client } from "@x402/axios";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const REQUEST_TIMEOUT_MS = 30_000;

export interface HttpClient {
  /** Axios instance — payment-enabled when a wallet is configured. */
  axios: AxiosInstance;
  /** True when a wallet is configured and paid endpoints are usable. */
  paymentEnabled: boolean;
  /** The payer address, when known — surfaced for transparency. */
  payerAddress: string | null;
}

/**
 * Build the shared HTTP client. Reads EVM_PRIVATE_KEY from the environment;
 * when absent or invalid, returns a plain (free-endpoint-only) client.
 */
export function createHttpClient(): HttpClient {
  const rawKey = process.env.EVM_PRIVATE_KEY?.trim();

  if (!rawKey) {
    // No wallet: never throw on status — runTool inspects res.status itself.
    return {
      axios: axios.create({ timeout: REQUEST_TIMEOUT_MS, validateStatus: () => true }),
      paymentEnabled: false,
      payerAddress: null,
    };
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    process.stderr.write(
      "[japan-data-mcp] EVM_PRIVATE_KEY is set but malformed; paid tools disabled.\n",
    );
    return {
      axios: axios.create({ timeout: REQUEST_TIMEOUT_MS, validateStatus: () => true }),
      paymentEnabled: false,
      payerAddress: null,
    };
  }

  // Payment-enabled: @x402/axios installs a *response-error* interceptor that
  // only fires when a 402 arrives as a rejected promise. So 402 must NOT be a
  // "valid" status — let axios reject it, the interceptor pays and retries,
  // and a successful retry resolves with 2xx. Any other status still resolves
  // so runTool can report it. A 402 that survives the interceptor (payment
  // failed) surfaces to runTool's catch block.
  const base = axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: (status) => status !== 402,
  });

  const account = privateKeyToAccount(key as `0x${string}`);
  // Register the Exact EVM scheme for every EVM network the APIs settle on
  // (Base mainnet eip155:8453, Polygon eip155:137). "eip155:*" covers both.
  const client = new x402Client().register("eip155:*", new ExactEvmScheme(account));

  return {
    axios: wrapAxiosWithPayment(base, client),
    paymentEnabled: true,
    payerAddress: account.address,
  };
}
