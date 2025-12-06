import { mockAnalyzeVideo } from "./mock";
import type { AnalyzeVideoInput, AnalyzeVideoResult } from "./types";

type AnalyzeOptions = {
  useMock?: boolean;
};

export async function analyzeVideo(
  input: AnalyzeVideoInput,
  options: AnalyzeOptions = { useMock: true },
): Promise<AnalyzeVideoResult> {
  if (options.useMock !== false) {
    return mockAnalyzeVideo(input);
  }

  throw new Error("Real analysis is not implemented in this iteration.");
}
