import type { InterpreterDiagnostic } from "./errors.ts";
import type { ExecutionResult } from "./runtime.ts";

export interface RunRequest {
  type: "run";
  source: string;
  call: string;
}

export type RunResponse =
  | {
      type: "success";
      result: ExecutionResult;
    }
  | {
      type: "error";
      diagnostic: InterpreterDiagnostic;
    };
