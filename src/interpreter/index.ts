import type { ExecutionResult, RuntimeOptions } from "./runtime.ts";
import { parseExpression } from "./expression.ts";
import { parseProgram } from "./parser.ts";
import { executeProgram } from "./runtime.ts";

export { formatDiagnostic, toDiagnostic } from "./errors.ts";
export { getEntryFunction, parseProgram } from "./parser.ts";
export type {
  ExecutionResult,
  RuntimeOptions,
  VariableSnapshot,
} from "./runtime.ts";

export function interpret(
  source: string,
  callSource: string,
  options: RuntimeOptions = {},
): ExecutionResult {
  const program = parseProgram(source);
  const normalizedCall = callSource.trim().replace(/^output\s*=\s*/i, "");
  const call = parseExpression(normalizedCall);
  return executeProgram(program, call, options);
}
