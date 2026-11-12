export type Priority = "High" | "Medium" | "Low";

export interface Feature {
  id: string;
  priority: Priority;
  effort: number;
}

export const PRIORITY_VALUE: Record<Priority, number> = { Low: 1, Medium: 3, High: 6 };

export const SPRINT_FEATURES: Feature[] = [
  { id: "A", priority: "High", effort: 1 },
  { id: "B", priority: "High", effort: 3 },
  { id: "C", priority: "High", effort: 5 },
  { id: "D", priority: "Medium", effort: 2 },
  { id: "E", priority: "Medium", effort: 3 },
  { id: "F", priority: "Medium", effort: 1 },
  { id: "G", priority: "Low", effort: 0.4 },
  { id: "H", priority: "Low", effort: 0.5 },
  { id: "I", priority: "Low", effort: 0.3 },
  { id: "J", priority: "Low", effort: 0.1 },
];

export const SPRINT_CAPACITY = 10;

/** 0/1 knapsack on effort (to 0.1 precision) maximising priority value. */
export function optimalSelection(features: Feature[], capacity: number) {
  const scale = 10;
  const cap = Math.round(capacity * scale);
  const n = features.length;
  const w = features.map((f) => Math.round(f.effort * scale));
  const v = features.map((f) => PRIORITY_VALUE[f.priority]);
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= cap; c++) {
      dp[i][c] = dp[i - 1][c];
      if (w[i - 1] <= c) dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w[i - 1]] + v[i - 1]);
    }
  }
  const picked: Feature[] = [];
  let c = cap;
  for (let i = n; i >= 1; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      picked.unshift(features[i - 1]);
      c -= w[i - 1];
    }
  }
  const effort = Math.round(picked.reduce((s, f) => s + f.effort, 0) * scale) / scale;
  return { picked, effort, value: dp[n][cap] };
}
