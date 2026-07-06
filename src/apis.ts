/**
 * The seven agentic-jp.com data APIs this MCP server fronts.
 *
 * Each API is an independent x402-paid HTTP service in production. The MCP
 * server holds one wallet and pays each of them transparently — see client.ts.
 */

export interface ApiDef {
  /** Stable short id, used to prefix tool names. */
  id: string;
  /** Production base URL (no trailing slash). */
  baseUrl: string;
  /** Human description, surfaced in the server instructions. */
  description: string;
}

export const APIS: Record<string, ApiDef> = {
  address: {
    id: "address",
    baseUrl: "https://address.agentic-jp.com",
    description:
      "Japanese address normalization, geocoding, reverse-geocoding, postal-code lookup, and free-form address parsing.",
  },
  furigana: {
    id: "furigana",
    baseUrl: "https://furigana.agentic-jp.com",
    description:
      "Japanese text processing: furigana/reading conversion, text normalization, name readings, and classification.",
  },
  transit: {
    id: "transit",
    baseUrl: "https://transit.agentic-jp.com",
    description:
      "Japanese rail real-time delays, disruptions, station status, and delay-aware route planning (ODPT-sourced).",
  },
  diet: {
    id: "diet",
    baseUrl: "https://diet.agentic-jp.com",
    description:
      "Japanese National Diet data: member profiles, proceedings full-text search, AI summaries, and bill votes.",
  },
  holiday: {
    id: "holiday",
    baseUrl: "https://holiday.agentic-jp.com",
    description:
      "Japanese public holidays and business-day calculation (Cabinet Office holiday data).",
  },
  weather: {
    id: "weather",
    baseUrl: "https://weather.agentic-jp.com",
    description: "Japanese weather forecasts and warnings, sourced from the JMA.",
  },
  houjin: {
    id: "houjin",
    baseUrl: "https://houjin.agentic-jp.com",
    description:
      "Japanese corporate-number (法人番号) registry: lookup, search, and name-matching against National Tax Agency data.",
  },
};
