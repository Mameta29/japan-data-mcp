import { describe, it, expect } from "vitest";
import { z } from "zod";
import { TOOLS } from "../src/tools.js";
import { APIS } from "../src/apis.js";

describe("tool catalog", () => {
  it("has unique tool names", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tool targets a known API", () => {
    for (const t of TOOLS) {
      expect(APIS[t.api], `tool ${t.name}`).toBeDefined();
    }
  });

  it("tool names are namespaced by their API id", () => {
    for (const t of TOOLS) {
      expect(t.name.startsWith(`${APIS[t.api]!.id}_`), `tool ${t.name}`).toBe(true);
    }
  });

  it("every tool has a non-trivial description", () => {
    for (const t of TOOLS) {
      expect(t.description.length, `tool ${t.name}`).toBeGreaterThan(20);
    }
  });

  it("buildRequest produces a valid method and absolute-style path", () => {
    for (const t of TOOLS) {
      // Feed each input field a type-appropriate placeholder.
      const args: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(t.input)) {
        args[key] = sampleFor(schema as z.ZodTypeAny);
      }
      const spec = t.buildRequest(args);
      expect(["GET", "POST"]).toContain(spec.method);
      expect(spec.path.startsWith("/"), `tool ${t.name}`).toBe(true);
      if (spec.method === "GET") {
        expect(spec.body, `GET tool ${t.name} should have no body`).toBeUndefined();
      }
    }
  });

  it("GET path params are URL-encoded (kanji station name stays safe)", () => {
    const status = TOOLS.find((t) => t.name === "transit_station_status")!;
    const spec = status.buildRequest({ name: "新宿" });
    expect(spec.path).toBe(`/station/${encodeURIComponent("新宿")}/status`);
    expect(spec.path).not.toContain("新宿");
  });

  it("optional fields are omitted from the body when not supplied", () => {
    const search = TOOLS.find((t) => t.name === "houjin_search")!;
    const spec = search.buildRequest({ name: "トヨタ" });
    expect(spec.body).toEqual({ name: "トヨタ" });
  });

  // Regression: buildRequest must emit the exact field names the target API's
  // Zod schema accepts. A misnamed field is silently dropped by the API and
  // the call fails (or behaves wrong) with no type error to catch it.
  describe("buildRequest field names match the live API schema", () => {
    it("diet_members_search sends `q`, not `name`", () => {
      const tool = TOOLS.find((t) => t.name === "diet_members_search")!;
      const spec = tool.buildRequest({ q: "岩屋", house: "shugiin", limit: 5 });
      expect(spec.query).toEqual({ q: "岩屋", house: "shugiin", limit: "5" });
      expect(spec.query).not.toHaveProperty("name");
    });

    it("holiday_add_business_days sends `business_days`, not `days`", () => {
      const tool = TOOLS.find((t) => t.name === "holiday_add_business_days")!;
      const spec = tool.buildRequest({ date: "2026-05-19", business_days: 3 });
      expect(spec.body).toEqual({ date: "2026-05-19", business_days: 3 });
      expect(spec.body).not.toHaveProperty("days");
    });

    it("removed LLM-backed diet tools stay removed", () => {
      expect(TOOLS.find((t) => t.name === "diet_minutes_summarize")).toBeUndefined();
      expect(TOOLS.find((t) => t.name === "diet_topic_track")).toBeUndefined();
    });
  });
});

/** Produce a minimal valid value for a Zod schema, for buildRequest smoke tests. */
function sampleFor(schema: z.ZodTypeAny): unknown {
  let s = schema;
  // Unwrap optional/default wrappers.
  while (s instanceof z.ZodOptional || s instanceof z.ZodDefault) {
    s = s._def.innerType as z.ZodTypeAny;
  }
  if (s instanceof z.ZodNumber) return 1;
  if (s instanceof z.ZodEnum) return s._def.values[0];
  return "sample";
}
