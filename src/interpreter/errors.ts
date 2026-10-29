import type { SourceLocation } from "./ast.ts";

export type InterpreterPhase = "syntax" | "runtime";

export interface InterpreterDiagnostic {
  phase: InterpreterPhase;
  message: string;
  line: number;
  column: number;
}

export class InterpreterError extends Error {
  readonly phase: InterpreterPhase;
  readonly location: SourceLocation;

  constructor(
    phase: InterpreterPhase,
    message: string,
    location: SourceLocation = { line: 1, column: 1 },
  ) {
    super(message);
    this.name = "InterpreterError";
    this.phase = phase;
    this.location = location;
  }
}

export function toDiagnostic(error: unknown): InterpreterDiagnostic {
  if (error instanceof InterpreterError) {
    return {
      phase: error.phase,
      message: error.message,
      line: error.location.line,
      column: error.location.column,
    };
  }

  return {
    phase: "runtime",
    message: error instanceof Error ? error.message : String(error),
    line: 1,
    column: 1,
  };
}

export function formatDiagnostic(diagnostic: InterpreterDiagnostic): string {
  const label = diagnostic.phase === "syntax" ? "Syntax error" : "Runtime error";
  return `${label} at line ${diagnostic.line}, column ${diagnostic.column}: ${diagnostic.message}`;
}
