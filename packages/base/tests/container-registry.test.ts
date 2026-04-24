import { describe, expect, it } from "vitest";
import {
  CONTAINER_REGISTRY,
  MD_ALERT_KINDS,
  MD_KNOWN_CONTAINERS,
  MARKDOWN_FEATURES_SCHEMA_VERSION,
} from "../src/document/rendering/container-registry.js";

describe("container-registry", () => {
  it("exposes the six alert kinds", () => {
    expect([...MD_ALERT_KINDS].sort()).toEqual(
      ["danger", "info", "note", "success", "tip", "warning"],
    );
  });

  it("includes all block containers currently dispatched by section-pipeline", () => {
    const expected = [
      "card-grid",
      "heatmap",
      "numbered-grid",
      "quote",
      "stat-tiles",
      "timeline",
    ];
    for (const name of expected) {
      expect(MD_KNOWN_CONTAINERS.has(name)).toBe(true);
    }
  });

  it("every spec has name, description, example", () => {
    for (const spec of CONTAINER_REGISTRY) {
      expect(spec.name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(spec.description.length).toBeGreaterThan(10);
      expect(spec.example.length).toBeGreaterThan(5);
    }
  });

  it("ships schema version for downstream consumers", () => {
    expect(MARKDOWN_FEATURES_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("has no duplicate container names", () => {
    const names = CONTAINER_REGISTRY.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
