export interface OptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  removed: string[];
  simplified: string[];
  preserved: string[];
  estimatedTokenReduction: number;
  qualityScore: number;
  reason: string;
}

export type OptimizationMode = "balanced" | "aggressive" | "conservative";

export interface HistoryItem {
  id: string;
  timestamp: string;
  mode: OptimizationMode;
  result: OptimizationResult;
}

export interface PresetExample {
  title: string;
  category: string;
  description: string;
  mode: OptimizationMode;
  prompt: string;
}
