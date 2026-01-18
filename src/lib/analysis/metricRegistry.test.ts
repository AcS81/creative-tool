import { describe, expect, it } from "vitest";
import {
  getDerivedMetrics,
  getMetricsByDomain,
  getTier1Metrics,
  getTier2Metrics,
} from "./metricRegistry";

const ids = (metrics: Array<{ id: string }>) => metrics.map((metric) => metric.id);

describe("metricRegistry helpers", () => {
  it("returns correct tier assignments", () => {
    getTier1Metrics().forEach((metric) => expect(metric.tier).toBe(1));
    getTier2Metrics().forEach((metric) => expect(metric.tier).toBe(2));
    getDerivedMetrics().forEach((metric) => expect(metric.tier).toBe(3));
  });

  it("keeps tiered metric IDs unique", () => {
    const all = [...getTier1Metrics(), ...getTier2Metrics(), ...getDerivedMetrics()];
    const uniqueCount = new Set(ids(all)).size;
    expect(uniqueCount).toBe(all.length);
  });

  it("returns the expected core metric count for tier 1", () => {
    expect(getTier1Metrics().length).toBe(23);
  });

  it("filters metrics by domain", () => {
    const voice = getMetricsByDomain("voice");
    expect(voice.length).toBeGreaterThan(0);
    expect(voice.every((metric) => metric.domain === "voice")).toBe(true);
  });
});
