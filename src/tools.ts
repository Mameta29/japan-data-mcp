/**
 * Tool catalog — one entry per exposed API endpoint.
 *
 * Each tool maps to an HTTP request against one of the seven agentic-jp.com
 * APIs. The `input` Zod shape is what the agent fills in; `buildRequest`
 * turns that into an HTTP method + path (+ body / query). Batch endpoints are
 * intentionally omitted: an agent calls one thing at a time, and per-item
 * pricing is awkward to surface as a single tool.
 *
 * `paid: true` means the endpoint answers 402 until payment — these need a
 * configured wallet. `paid: false` endpoints (discovery / list) are free.
 */
import { z, type ZodRawShape } from "zod";
import { APIS } from "./apis.js";

export interface HttpRequestSpec {
  method: "GET" | "POST";
  /** Path on the API host, already interpolated. */
  path: string;
  /** JSON body for POST requests. */
  body?: unknown;
  /** Query-string params. */
  query?: Record<string, string>;
}

export interface ToolDef {
  /** Tool name exposed to the agent, e.g. "address_normalize". */
  name: string;
  /** API id from APIS. */
  api: keyof typeof APIS;
  /** One-paragraph description shown to the agent. */
  description: string;
  /** Zod shape for the tool's input arguments. */
  input: ZodRawShape;
  /** Whether the endpoint requires an x402 payment. */
  paid: boolean;
  /** Turn validated args into an HTTP request. */
  buildRequest: (args: Record<string, unknown>) => HttpRequestSpec;
}

/** Encode a path segment safely (handles kanji, slashes, etc.). */
const seg = (v: unknown): string => encodeURIComponent(String(v));

export const TOOLS: ToolDef[] = [
  // ---- address-api --------------------------------------------------------
  {
    name: "address_normalize",
    api: "address",
    description:
      "Normalize a Japanese address into clean prefecture/city/town/chome components, fixing fullwidth/halfwidth and old-form kanji, and resolving the postal code. Returns a 0-1 confidence score.",
    input: { address: z.string().describe("A Japanese address string, any common notation.") },
    paid: true,
    buildRequest: (a) => ({ method: "POST", path: "/normalize", body: { address: a.address } }),
  },
  {
    name: "address_geocode",
    api: "address",
    description:
      "Geocode a Japanese address to WGS84 lat/lng coordinates, with a granularity level and confidence score. Japan-only.",
    input: { address: z.string().describe("A Japanese address string.") },
    paid: true,
    buildRequest: (a) => ({ method: "POST", path: "/geocode", body: { address: a.address } }),
  },
  {
    name: "address_reverse_geocode",
    api: "address",
    description: "Reverse-geocode WGS84 lat/lng coordinates within Japan to a normalized address.",
    input: {
      lat: z.number().describe("Latitude (WGS84)."),
      lng: z.number().describe("Longitude (WGS84)."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/reverse-geocode",
      body: { lat: a.lat, lng: a.lng },
    }),
  },
  {
    name: "address_postal_code",
    api: "address",
    description:
      "Look up Japanese address candidates for a 7-digit postal code (郵便番号), backed by Japan Post KEN_ALL data.",
    input: {
      zip: z.string().describe("A 7-digit Japanese postal code; hyphen optional (e.g. 100-0014)."),
    },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/postal-code/${seg(a.zip)}` }),
  },
  {
    name: "address_parse",
    api: "address",
    description:
      "Extract a fully structured Japanese address — including building name, room number, and addressee — from free-form, OCR, or voice-transcribed text.",
    input: { text: z.string().describe("Free-form text containing a Japanese address.") },
    paid: true,
    buildRequest: (a) => ({ method: "POST", path: "/parse", body: { text: a.text } }),
  },

  // ---- furigana-api -------------------------------------------------------
  {
    name: "furigana_convert",
    api: "furigana",
    description:
      "Convert kanji-mixed Japanese text to hiragana, katakana, or romaji, with a per-token reading breakdown.",
    input: {
      text: z.string().describe("Japanese text to read."),
      to: z
        .enum(["hiragana", "katakana", "romaji"])
        .optional()
        .describe("Target script. Default hiragana."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/furigana",
      body: { text: a.text, ...(a.to ? { options: { to: a.to } } : {}) },
    }),
  },
  {
    name: "furigana_name_readings",
    api: "furigana",
    description:
      "List the possible readings of a Japanese name (person, company, or place), each with a probability — names are ambiguous without context.",
    input: {
      name: z.string().describe("A Japanese name."),
      name_type: z
        .enum(["person", "company", "place"])
        .optional()
        .describe("Hint for the kind of name."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/name-readings",
      body: { name: a.name, ...(a.name_type ? { name_type: a.name_type } : {}) },
    }),
  },
  {
    name: "furigana_classify",
    api: "furigana",
    description:
      "Classify a Japanese string as person_name / company_name / place_name / general / mixed, with a probability and character-type breakdown.",
    input: { text: z.string().describe("Japanese text to classify.") },
    paid: true,
    buildRequest: (a) => ({ method: "POST", path: "/classify", body: { text: a.text } }),
  },

  // ---- transit-api --------------------------------------------------------
  {
    name: "transit_station_status",
    api: "transit",
    description:
      "Real-time delay and operational status for a Japanese train station, per line, with a bilingual summary. Sourced from ODPT.",
    input: { name: z.string().describe("Station name (kanji, kana, or romaji).") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/station/${seg(a.name)}/status` }),
  },
  {
    name: "transit_line_disruptions",
    api: "transit",
    description: "Current service disruptions on a specific Japanese train line.",
    input: { line: z.string().describe("Line id from transit_lines (e.g. jr-east-yamanote).") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/line/${seg(a.line)}/disruptions` }),
  },
  {
    name: "transit_route_plan",
    api: "transit",
    description: "Plan a route between two Japanese train stations with transfers, duration, and fare.",
    input: {
      from: z.string().describe("Origin station name."),
      to: z.string().describe("Destination station name."),
    },
    paid: true,
    buildRequest: (a) => ({ method: "POST", path: "/route-plan", body: { from: a.from, to: a.to } }),
  },
  {
    name: "transit_alternative_routes",
    api: "transit",
    description:
      "Suggest delay-aware alternative routes for Japanese train travel — ranked routes that avoid currently-disrupted lines.",
    input: {
      from: z.string().describe("Origin station name."),
      to: z.string().describe("Destination station name."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/alternative-routes",
      body: { from: a.from, to: a.to },
    }),
  },
  {
    name: "transit_lines",
    api: "transit",
    description:
      "Directory of Japanese rail operators and their lines, with canonical ids. Use to discover valid line identifiers.",
    input: {},
    paid: true,
    buildRequest: () => ({ method: "GET", path: "/lines" }),
  },
  {
    name: "transit_stations_search",
    api: "transit",
    description: "Fuzzy-search Japanese train stations by name (kanji, kana, or romaji).",
    input: { q: z.string().min(2).describe("Search query, at least 2 characters.") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: "/stations/search", query: { q: String(a.q) } }),
  },

  // ---- diet-api -----------------------------------------------------------
  {
    name: "diet_member",
    api: "diet",
    description:
      "Full profile of a Japanese National Diet member by canonical id — party, constituency, committees, positions.",
    input: { id: z.string().describe("Canonical member id (from diet_members_search).") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/members/${seg(a.id)}` }),
  },
  {
    name: "diet_members_search",
    api: "diet",
    description:
      "Search current Japanese National Diet members by name (kanji/kana/romaji), party, house, or constituency.",
    input: {
      q: z.string().optional().describe("Member name (kanji, kana, or romaji)."),
      party: z.string().optional().describe("Party name."),
      house: z
        .enum(["shugiin", "sangiin"])
        .optional()
        .describe("Chamber: shugiin (House of Representatives) or sangiin (House of Councillors)."),
      constituency: z.string().optional().describe("Constituency."),
      active_only: z.boolean().optional().describe("Restrict to currently-serving members."),
      limit: z.number().optional().describe("Max results, 1-100. Default 20."),
    },
    paid: true,
    buildRequest: (a) => {
      const query: Record<string, string> = {};
      if (a.q) query.q = String(a.q);
      if (a.party) query.party = String(a.party);
      if (a.house) query.house = String(a.house);
      if (a.constituency) query.constituency = String(a.constituency);
      if (a.active_only !== undefined) query.active_only = String(a.active_only);
      if (a.limit !== undefined) query.limit = String(a.limit);
      return { method: "GET", path: "/members/search", query };
    },
  },
  {
    name: "diet_minutes_search",
    api: "diet",
    description:
      "Full-text search the official Japanese Diet proceedings archive (国会会議録), filterable by date, house, committee, and speaker.",
    input: {
      query: z.string().describe("Search keyword."),
      from_date: z.string().optional().describe("Start date, YYYY-MM-DD."),
      to_date: z.string().optional().describe("End date, YYYY-MM-DD."),
      house: z
        .enum(["shugiin", "sangiin"])
        .optional()
        .describe("Restrict to one chamber: shugiin or sangiin."),
      committee: z.string().optional().describe("Committee name, e.g. 財務金融委員会."),
      speaker: z.string().optional().describe("Restrict to a speaker's remarks."),
      limit: z.number().optional().describe("Max results, 1-100. Default 20."),
      offset: z.number().optional().describe("1-based result offset for pagination. Default 1."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/minutes/search",
      body: {
        query: a.query,
        ...(a.from_date ? { from_date: a.from_date } : {}),
        ...(a.to_date ? { to_date: a.to_date } : {}),
        ...(a.house ? { house: a.house } : {}),
        ...(a.committee ? { committee: a.committee } : {}),
        ...(a.speaker ? { speaker: a.speaker } : {}),
        ...(a.limit ? { limit: a.limit } : {}),
        ...(a.offset ? { offset: a.offset } : {}),
      },
    }),
  },
  // (diet_minutes_summarize / diet_topic_track were removed 2026-07-08 along
  // with the upstream LLM endpoints — the Anthropic cost exceeded revenue.)

  // ---- holiday-api --------------------------------------------------------
  {
    name: "holiday_is_holiday",
    api: "holiday",
    description:
      "Classify a Japanese calendar date as a public holiday, weekend, or business day. Backed by official Cabinet Office data.",
    input: { date: z.string().describe("A date, YYYY-MM-DD.") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/is-holiday/${seg(a.date)}` }),
  },
  {
    name: "holiday_list",
    api: "holiday",
    description: "List all Japanese public holidays for a given year.",
    input: { year: z.number().describe("Four-digit year.") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/holidays/${seg(a.year)}` }),
  },
  {
    name: "holiday_add_business_days",
    api: "holiday",
    description:
      "Add (or subtract) a number of Japanese business days to a date, skipping weekends and public holidays.",
    input: {
      date: z.string().describe("Start date, YYYY-MM-DD."),
      business_days: z
        .number()
        .describe("Business days to add (-3650 to 3650); negative subtracts."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/add-business-days",
      body: { date: a.date, business_days: a.business_days },
    }),
  },
  {
    name: "holiday_business_days_between",
    api: "holiday",
    description: "Count the Japanese business days between two dates (inclusive of neither endpoint by default).",
    input: {
      from: z.string().describe("Start date, YYYY-MM-DD."),
      to: z.string().describe("End date, YYYY-MM-DD."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/business-days",
      body: { from: a.from, to: a.to },
    }),
  },

  // ---- weather-api --------------------------------------------------------
  {
    name: "weather_forecast",
    api: "weather",
    description:
      "Japanese weather forecast for a region — today's conditions, near-term outlook, and a 7-day forecast. Sourced from the JMA.",
    input: {
      area: z.string().describe("A JMA office code or a Japanese/English region name."),
    },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/forecast/${seg(a.area)}` }),
  },
  {
    name: "weather_warnings",
    api: "weather",
    description: "Active Japanese weather warnings and advisories for a region, from the JMA.",
    input: { area: z.string().describe("A JMA office code or region name.") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/warnings/${seg(a.area)}` }),
  },
  {
    name: "weather_areas",
    api: "weather",
    description: "List the valid JMA region codes and names accepted by the weather tools.",
    input: {},
    paid: true,
    buildRequest: () => ({ method: "GET", path: "/areas" }),
  },

  // ---- houjin-api ---------------------------------------------------------
  {
    name: "houjin_corporation",
    api: "houjin",
    description:
      "Look up one Japanese corporation by its 13-digit corporate number (法人番号), against the National Tax Agency registry.",
    input: { number: z.string().describe("A 13-digit Japanese corporate number.") },
    paid: true,
    buildRequest: (a) => ({ method: "GET", path: `/corporation/${seg(a.number)}` }),
  },
  {
    name: "houjin_search",
    api: "houjin",
    description:
      "Search the Japanese corporate registry by trade name and/or location. Matches Japanese and registered English names.",
    input: {
      name: z.string().describe("Trade name, partial match."),
      prefecture: z.string().optional().describe("Prefecture name or JIS code."),
      city: z.string().optional().describe("City / ward substring."),
      corp_kind: z
        .string()
        .optional()
        .describe("3-digit corporation-kind code (法人種別), e.g. 301 for 株式会社."),
      limit: z.number().optional().describe("Max results, 1-50."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/search",
      body: {
        name: a.name,
        ...(a.prefecture ? { prefecture: a.prefecture } : {}),
        ...(a.city ? { city: a.city } : {}),
        ...(a.corp_kind ? { corp_kind: a.corp_kind } : {}),
        ...(a.limit ? { limit: a.limit } : {}),
      },
    }),
  },
  {
    name: "houjin_kyb_report",
    api: "houjin",
    description:
      "One-call KYB report on a Japanese corporation: official registry record, lifecycle status (active/closed), kana + romaji name readings, machine-actionable risk flags, an English summary, and the dataset vintage. Accepts a 13-digit corporate number or a company name. Premium composite ($0.25) — replaces 3-4 separate lookups.",
    input: {
      corporate_number: z.string().optional().describe("13-digit corporate number (法人番号). Either this or name is required."),
      name: z.string().optional().describe("Company trade name when the number is unknown."),
      prefecture: z.string().optional().describe("Optional prefecture filter for name resolution."),
      city: z.string().optional().describe("Optional city/ward filter for name resolution."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/report",
      body: {
        ...(a.corporate_number ? { corporate_number: a.corporate_number } : {}),
        ...(a.name ? { name: a.name } : {}),
        ...(a.prefecture ? { prefecture: a.prefecture } : {}),
        ...(a.city ? { city: a.city } : {}),
      },
    }),
  },
  {
    name: "houjin_verify",
    api: "houjin",
    description:
      "Name-match (名寄せ) a company name plus location against the Japanese corporate registry, returning the most likely corporate number with a confidence score. Closed/dissolved companies are reported as not verified.",
    input: {
      name: z.string().describe("Company name to verify."),
      address: z.string().optional().describe("Company address, improves matching."),
    },
    paid: true,
    buildRequest: (a) => ({
      method: "POST",
      path: "/verify",
      body: { name: a.name, ...(a.address ? { address: a.address } : {}) },
    }),
  },
];
