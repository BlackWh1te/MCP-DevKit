// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import {
  think, getThoughts, getReasoningGraph,
  analyzeThinkingQuality, getHypotheses, clearThinking,
} from "../src/thinking.js";

describe("thinking", () => {
  it("records a thought", async () => {
    await clearThinking();
    const result = await think("Test thought about architecture", 1, 3, true);
    expect(result).toContain("Thought 1");
    expect(result).toContain("Test thought about architecture");
    expect(result).toContain("Progress: 1/3");
    expect(result).toContain("Next thought needed: yes");
  });

  it("retrieves thoughts", async () => {
    await clearThinking();
    await think("First thought", 1, 2, true);
    await think("Second thought", 2, 2, false);
    const result = await getThoughts();
    expect(result).toContain("Thinking Session");
    expect(result).toContain("First thought");
    expect(result).toContain("Second thought");
  });

  it("returns reasoning graph", async () => {
    await clearThinking();
    await think("Hypothesis: use Redis", 1, 2, true, undefined, undefined, undefined, undefined, "Redis caching", ["fast reads"]);
    await think("Evidence: benchmark shows 10ms", 2, 2, false, undefined, undefined, undefined, undefined, undefined, ["benchmark data"], 0.9);
    const result = await getReasoningGraph();
    expect(result).toContain("Reasoning Graph");
    expect(result).toContain("Nodes");
    expect(result).toContain("Edges");
  });

  it("analyzes thinking quality", async () => {
    await clearThinking();
    await think("Idea A", 1, 1, false, undefined, undefined, undefined, undefined, "test", ["evidence"], 0.8);
    const result = await analyzeThinkingQuality();
    expect(result).toContain("Thinking Quality Analysis");
    expect(result).toContain("Score:");
    expect(result).toContain("Metrics");
  });

  it("returns hypotheses", async () => {
    await clearThinking();
    await think("Hypothesis: microservices scale better because team size is large", 1, 1, false);
    const result = await getHypotheses();
    expect(result).toContain("Hypotheses");
    expect(result).toContain("microservices scale better");
  });

  it("clears thinking", async () => {
    const result = await clearThinking();
    expect(result).toContain("cleared");
    const after = await getThoughts();
    expect(after).toContain("0 thoughts");
  });
});
