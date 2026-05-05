// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

interface Thought {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  timestamp: string;
  // Advanced fields
  hypothesis?: string;
  evidence?: string[];
  confidence?: number; // 0-1
  contradictions?: number[]; // thought numbers this contradicts
  supportedBy?: number[]; // thought numbers that support this
}

interface ReasoningGraph {
  nodes: Array<{
    id: number;
    text: string;
    branchId?: string;
    confidence: number;
    hasHypothesis: boolean;
    contradictions: number[];
    supportedBy: number[];
  }>;
  edges: Array<{ from: number; to: number; type: "supports" | "contradicts" | "revises" | "branches" }>;
  branches: Record<string, number[]>;
  conclusions: Array<{ id: number; text: string; confidence: number; supportedBy: number[] }>;
  divergences: Array<{ thoughtA: number; thoughtB: number; reason: string }>;
}

interface ThinkingQuality {
  totalThoughts: number;
  avgConfidence: number;
  hypothesisCount: number;
  revisionCount: number;
  branchCount: number;
  contradictionCount: number;
  conclusionCount: number;
  depth: number;
  breadth: number;
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

const THINKING_FILE = path.join(os.homedir(), ".mcp-devkit", "thinking.json");

async function loadThinking(): Promise<Thought[]> {
  try {
    const data = await fs.readFile(THINKING_FILE, "utf-8");
    const parsed = JSON.parse(data);
    // Migrate old thoughts without new fields
    for (const t of parsed) {
      if (!t.timestamp) t.timestamp = new Date().toISOString();
      if (!t.evidence) t.evidence = [];
      if (!t.confidence) t.confidence = 0.5;
      if (!t.contradictions) t.contradictions = [];
      if (!t.supportedBy) t.supportedBy = [];
    }
    return parsed;
  } catch {
    return [];
  }
}

async function saveThinking(thoughts: Thought[]) {
  await fs.mkdir(path.dirname(THINKING_FILE), { recursive: true });
  await fs.writeFile(THINKING_FILE, JSON.stringify(thoughts, null, 2), "utf-8");
}

function extractHypothesis(text: string): string | undefined {
  const patterns = [
    /hypothesis[:\s]+(.+?)(?:\.|\n|$)/i,
    /i (?:believe|think|suspect|hypothesize) (that )?(.+?)(?:\.|\n|$)/i,
    /(?:assumption|premise)[:\s]+(.+?)(?:\.|\n|$)/i,
    /(?:theory|proposition)[:\s]+(.+?)(?:\.|\n|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return (m[1] || m[2] || m[3] || m[0]).trim();
  }
  return undefined;
}

function extractEvidence(text: string): string[] {
  const evidence: string[] = [];
  const patterns = [
    /because (.+?)(?:\.|;|\n|$)/gi,
    /evidence[:\s]+(.+?)(?:\.|;|\n|$)/gi,
    /since (.+?)(?:\.|;|\n|$)/gi,
    /given that (.+?)(?:\.|;|\n|$)/gi,
    /data[:\s]+(.+?)(?:\.|;|\n|$)/gi,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      evidence.push(m[1].trim());
    }
  }
  return evidence.slice(0, 5);
}

function estimateConfidence(text: string): number {
  const lower = text.toLowerCase();
  let confidence = 0.5;

  // High confidence markers
  const highMarkers = ["certainly", "definitely", "proven", "verified", "confirmed", "always", "must", "necessarily"];
  const lowMarkers = ["maybe", "possibly", "perhaps", "uncertain", "unclear", "might", "could", "probably", "likely", "seems"];
  const negation = ["not", "no", "never", "unlikely", "impossible"];

  for (const m of highMarkers) if (lower.includes(m)) confidence += 0.15;
  for (const m of lowMarkers) if (lower.includes(m)) confidence -= 0.1;
  for (const m of negation) if (lower.includes(m)) confidence -= 0.05;

  // Evidence increases confidence
  if (extractEvidence(text).length > 0) confidence += 0.1;
  if (extractEvidence(text).length > 2) confidence += 0.1;

  return Math.max(0, Math.min(1, confidence));
}

function detectContradictions(current: Thought, allThoughts: Thought[]): number[] {
  const contradictions: number[] = [];
  const currentLower = current.thought.toLowerCase();
  const contradictionWords = ["not", "no", "never", "impossible", "contradict", "opposite", "unlike", "rather than"];
  const hasNegation = contradictionWords.some((w) => currentLower.includes(w));

  for (const t of allThoughts) {
    if (t.thoughtNumber === current.thoughtNumber) continue;
    const otherLower = t.thought.toLowerCase();
    // Direct negation patterns
    if (hasNegation && t.hypothesis && currentLower.includes(t.hypothesis.toLowerCase())) {
      contradictions.push(t.thoughtNumber);
      continue;
    }
    // Semantic contradiction: key phrases present in opposite forms
    const sharedWords = current.thought.split(/\s+/).filter((w) => w.length > 4 && otherLower.includes(w.toLowerCase()));
    if (sharedWords.length >= 2) {
      const otherNegation = contradictionWords.some((w) => otherLower.includes(w));
      if (hasNegation !== otherNegation) {
        contradictions.push(t.thoughtNumber);
      }
    }
  }
  return contradictions.slice(0, 3);
}

function detectSupport(current: Thought, allThoughts: Thought[]): number[] {
  const supported: number[] = [];
  const currentLower = current.thought.toLowerCase();
  for (const t of allThoughts) {
    if (t.thoughtNumber === current.thoughtNumber) continue;
    const otherLower = t.hypothesis?.toLowerCase() || t.thought.toLowerCase();
    // Shared significant words without contradiction
    const sharedWords = current.thought.split(/\s+/).filter((w) => w.length > 4 && otherLower.includes(w.toLowerCase()));
    if (sharedWords.length >= 3) {
      supported.push(t.thoughtNumber);
    }
  }
  return supported.slice(0, 5);
}

export async function think(
  thought: string,
  thoughtNumber: number,
  totalThoughts: number,
  nextThoughtNeeded = true,
  isRevision = false,
  revisesThought?: number,
  branchFromThought?: number,
  branchId?: string
): Promise<string> {
  const thoughts = await loadThinking();

  const hypothesis = extractHypothesis(thought);
  const evidence = extractEvidence(thought);
  const confidence = estimateConfidence(thought);

  const t: Thought = {
    thought,
    thoughtNumber,
    totalThoughts,
    nextThoughtNeeded,
    isRevision,
    revisesThought,
    branchFromThought,
    branchId,
    timestamp: new Date().toISOString(),
    hypothesis,
    evidence,
    confidence,
    contradictions: detectContradictions({ thought, thoughtNumber, totalThoughts, nextThoughtNeeded, timestamp: "", confidence, evidence: [], contradictions: [], supportedBy: [] }, thoughts),
    supportedBy: detectSupport({ thought, thoughtNumber, totalThoughts, nextThoughtNeeded, timestamp: "", confidence, evidence: [], contradictions: [], supportedBy: [] }, thoughts),
  };

  thoughts.push(t);
  await saveThinking(thoughts);

  const lines: string[] = [
    `## Thought ${thoughtNumber}${isRevision ? ` (revises #${revisesThought})` : ""}${branchId ? ` [branch: ${branchId}]` : ""}`,
    `${thought}`,
    "",
    `Progress: ${thoughtNumber}/${totalThoughts}`,
    nextThoughtNeeded ? "Next thought needed: yes" : "Next thought needed: no",
    `Total chain thoughts: ${thoughts.length}`,
    hypothesis ? `Hypothesis: ${hypothesis}` : "",
    evidence.length > 0 ? `Evidence: ${evidence.join("; ")}` : "",
    `Confidence: ${Math.round(confidence * 100)}%`,
    (t.contradictions ?? []).length > 0 ? `Contradicts thoughts: ${(t.contradictions ?? []).join(", ")}` : "",
    (t.supportedBy ?? []).length > 0 ? `Supported by thoughts: ${(t.supportedBy ?? []).join(", ")}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

export async function getThoughts(filter?: string): Promise<string> {
  const thoughts = await loadThinking();

  if (!filter) {
    const lines: string[] = [`# Thinking Session (${thoughts.length} thoughts)`, ""];
    for (const t of thoughts) {
      const confidenceStr = t.confidence !== undefined ? ` [${Math.round(t.confidence * 100)}%]` : "";
      const hypStr = t.hypothesis ? ` [H: ${t.hypothesis.slice(0, 30)}${t.hypothesis.length > 30 ? "..." : ""}]` : "";
      lines.push(`## ${t.thoughtNumber}${t.isRevision ? `r` : ""}${t.branchId ? ` [${t.branchId}]` : ""}${confidenceStr}${hypStr}: ${t.thought.slice(0, 100)}${t.thought.length > 100 ? "..." : ""}`);
    }
    return lines.join("\n");
  }

  // Filter by branch, keyword, or hypothesis
  const filtered = thoughts.filter(
    (t) =>
      t.branchId?.includes(filter) ||
      t.thought.toLowerCase().includes(filter.toLowerCase()) ||
      t.hypothesis?.toLowerCase().includes(filter.toLowerCase())
  );

  const lines: string[] = [
    `# Filtered Thoughts (${filtered.length}/${thoughts.length})`,
    "",
  ];
  for (const t of filtered) {
    const confidenceStr = t.confidence !== undefined ? ` [${Math.round(t.confidence * 100)}%]` : "";
    lines.push(
      `## ${t.thoughtNumber}${confidenceStr}: ${t.thought.slice(0, 200)}${t.thought.length > 200 ? "..." : ""}`
    );
  }
  return lines.join("\n");
}

export async function getReasoningGraph(): Promise<string> {
  const thoughts = await loadThinking();
  if (thoughts.length === 0) return "No thoughts yet. Start with `think`.";

  const nodes = thoughts.map((t) => ({
    id: t.thoughtNumber,
    text: t.thought.slice(0, 60),
    branchId: t.branchId,
    confidence: t.confidence ?? 0.5,
    hasHypothesis: !!t.hypothesis,
    contradictions: t.contradictions ?? [],
    supportedBy: t.supportedBy ?? [],
  }));

  const edges: ReasoningGraph["edges"] = [];
  for (const t of thoughts) {
    if (t.revisesThought) {
      edges.push({ from: t.thoughtNumber, to: t.revisesThought, type: "revises" });
    }
    if (t.branchFromThought) {
      edges.push({ from: t.thoughtNumber, to: t.branchFromThought, type: "branches" });
    }
    for (const s of t.supportedBy ?? []) {
      edges.push({ from: s, to: t.thoughtNumber, type: "supports" });
    }
    for (const c of t.contradictions ?? []) {
      edges.push({ from: t.thoughtNumber, to: c, type: "contradicts" });
    }
  }

  const branches: Record<string, number[]> = {};
  for (const t of thoughts) {
    if (t.branchId) {
      if (!branches[t.branchId]) branches[t.branchId] = [];
      branches[t.branchId].push(t.thoughtNumber);
    }
  }

  // Find conclusions: thoughts with high confidence that aren't revised and have no outgoing nextThoughtNeeded=false
  const conclusions = thoughts
    .filter((t) => !t.nextThoughtNeeded && (t.confidence ?? 0) > 0.6)
    .map((t) => ({
      id: t.thoughtNumber,
      text: t.thought.slice(0, 80),
      confidence: t.confidence ?? 0.5,
      supportedBy: t.supportedBy ?? [],
    }));

  // Find divergences: branches that contradict each other
  const divergences: ReasoningGraph["divergences"] = [];
  const branchList = Object.entries(branches);
  for (let i = 0; i < branchList.length; i++) {
    for (let j = i + 1; j < branchList.length; j++) {
      const [nameA, idsA] = branchList[i];
      const [nameB, idsB] = branchList[j];
      for (const a of idsA) {
        for (const b of idsB) {
          const thoughtA = thoughts.find((t) => t.thoughtNumber === a);
          const thoughtB = thoughts.find((t) => t.thoughtNumber === b);
          if (thoughtA && thoughtB && (thoughtA.contradictions?.includes(b) || thoughtB.contradictions?.includes(a))) {
            divergences.push({
              thoughtA: a,
              thoughtB: b,
              reason: `Branch "${nameA}" contradicts branch "${nameB}"`,
            });
          }
        }
      }
    }
  }

  const lines = [
    "# Reasoning Graph",
    "",
    `## Nodes (${nodes.length})`,
    ...nodes.map((n) => `- #${n.id}${n.branchId ? ` [${n.branchId}]` : ""} ${n.hasHypothesis ? "[H]" : ""} [${Math.round(n.confidence * 100)}%] "${n.text}"`),
    "",
    `## Edges (${edges.length})`,
    ...edges.map((e) => `- #${e.from} → #${e.to} (${e.type})`),
    "",
    `## Branches (${Object.keys(branches).length})`,
    ...Object.entries(branches).map(([name, ids]) => `- ${name}: ${ids.join(", ")}`),
    "",
    `## Conclusions (${conclusions.length})`,
    ...conclusions.map((c) => `- #${c.id} [${Math.round(c.confidence * 100)}%] "${c.text}" (supported by ${c.supportedBy.length})`),
    "",
    divergences.length > 0 ? `## Divergences (${divergences.length})` : "",
    ...divergences.map((d) => `- #${d.thoughtA} ↔ #${d.thoughtB}: ${d.reason}`),
  ];

  return lines.filter(Boolean).join("\n");
}

export async function analyzeThinkingQuality(): Promise<string> {
  const thoughts = await loadThinking();
  if (thoughts.length === 0) return "No thoughts to analyze. Start with `think`.";

  const totalThoughts = thoughts.length;
  const confidences = thoughts.map((t) => t.confidence ?? 0.5);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const hypothesisCount = thoughts.filter((t) => !!t.hypothesis).length;
  const revisionCount = thoughts.filter((t) => t.isRevision).length;
  const branchCount = new Set(thoughts.map((t) => t.branchId).filter(Boolean)).size;
  const contradictionCount = thoughts.reduce((sum, t) => sum + (t.contradictions?.length ?? 0), 0);
  const conclusionCount = thoughts.filter((t) => !t.nextThoughtNeeded).length;

  // Depth = max chain without branching
  const maxThoughtNumber = Math.max(...thoughts.map((t) => t.thoughtNumber));
  const depth = maxThoughtNumber;

  // Breadth = number of branches + unique branch IDs
  const breadth = branchCount + (thoughts.some((t) => !t.branchId) ? 1 : 0);

  // Score calculation
  let score = 50;
  score += avgConfidence * 20;
  score += Math.min(hypothesisCount, 5) * 3;
  score += Math.min(revisionCount, 3) * 2; // Revisions show refinement
  score += Math.min(branchCount, 3) * 3; // Branching shows exploration
  score += Math.min(contradictionCount, 3) * 2; // Contradictions show critical thinking
  score -= Math.max(0, contradictionCount - 3) * 5; // Too many contradictions is bad
  score += Math.min(conclusionCount, 3) * 5;
  score += Math.min(totalThoughts / 5, 10); // More thoughts up to a point
  score = Math.max(0, Math.min(100, Math.round(score)));

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (hypothesisCount >= 2) strengths.push("Multiple hypotheses formulated");
  else weaknesses.push("Few explicit hypotheses — try stating assumptions clearly");

  if (avgConfidence > 0.7) strengths.push("High average confidence in reasoning");
  else if (avgConfidence < 0.4) weaknesses.push("Low confidence — evidence or clarity may be lacking");

  if (revisionCount >= 1) strengths.push("Iterative refinement through revisions");
  else recommendations.push("Consider revising earlier thoughts as you learn more");

  if (branchCount >= 2) strengths.push("Explored multiple reasoning branches");
  else if (totalThoughts > 5) recommendations.push("Try branching to explore alternative paths");

  if (contradictionCount >= 1 && contradictionCount <= 3) strengths.push("Critical thinking through contradiction detection");
  else if (contradictionCount > 5) weaknesses.push("Too many contradictions — reasoning may be inconsistent");

  if (conclusionCount >= 1) strengths.push("Reached at least one conclusion");
  else recommendations.push("Try to reach a final concluding thought");

  if (totalThoughts < 3) recommendations.push("Chain is short — expand with more reasoning steps");

  const analysis: ThinkingQuality = {
    totalThoughts,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    hypothesisCount,
    revisionCount,
    branchCount,
    contradictionCount,
    conclusionCount,
    depth,
    breadth,
    score,
    strengths,
    weaknesses,
    recommendations,
  };

  const lines = [
    "# Thinking Quality Analysis",
    "",
    `Score: ${analysis.score}/100`,
    "",
    `## Metrics`,
    `- Total Thoughts: ${analysis.totalThoughts}`,
    `- Avg Confidence: ${Math.round(analysis.avgConfidence * 100)}%`,
    `- Hypotheses: ${analysis.hypothesisCount}`,
    `- Revisions: ${analysis.revisionCount}`,
    `- Branches: ${analysis.branchCount}`,
    `- Contradictions: ${analysis.contradictionCount}`,
    `- Conclusions: ${analysis.conclusionCount}`,
    `- Depth: ${analysis.depth}`,
    `- Breadth: ${analysis.breadth}`,
    "",
    `## Strengths`,
    ...analysis.strengths.map((s) => `- ${s}`),
    analysis.strengths.length === 0 ? "- (none identified)" : "",
    "",
    `## Weaknesses`,
    ...analysis.weaknesses.map((w) => `- ${w}`),
    analysis.weaknesses.length === 0 ? "- (none identified)" : "",
    "",
    `## Recommendations`,
    ...analysis.recommendations.map((r) => `- ${r}`),
    analysis.recommendations.length === 0 ? "- (none identified)" : "",
  ];

  return lines.filter(Boolean).join("\n");
}

export async function getHypotheses(): Promise<string> {
  const thoughts = await loadThinking();
  const hypotheses = thoughts.filter((t) => !!t.hypothesis);

  if (hypotheses.length === 0) return "No hypotheses found. Try including 'Hypothesis: ...' or 'I believe that...' in your thoughts.";

  const lines = [
    "# Hypotheses",
    "",
    ...hypotheses.map((h) => {
      const confidence = Math.round((h.confidence ?? 0.5) * 100);
      const evidence = h.evidence?.length ? `\n  Evidence: ${h.evidence.join("; ")}` : "";
      const contradictions = h.contradictions?.length ? `\n  Contradicted by: #${h.contradictions.join(", #")}` : "";
      const supported = h.supportedBy?.length ? `\n  Supported by: #${h.supportedBy.join(", #")}` : "";
      return `- Thought #${h.thoughtNumber} [${confidence}%]: ${h.hypothesis}${evidence}${contradictions}${supported}`;
    }),
  ];
  return lines.join("\n");
}

export async function clearThinking(): Promise<string> {
  await fs.writeFile(THINKING_FILE, "[]", "utf-8");
  return "Thinking session cleared.";
}
