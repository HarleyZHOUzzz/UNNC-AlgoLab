import { useCallback, useEffect, useRef, useState } from "react";
import type { InterpreterDiagnostic } from "../interpreter/errors.ts";
import type { RunRequest, RunResponse } from "../interpreter/protocol.ts";
import type { ExecutionResult } from "../interpreter/runtime.ts";

interface PendingRun {
  resolve: (result: ExecutionResult) => void;
  reject: (diagnostic: InterpreterDiagnostic) => void;
}

const STOPPED_DIAGNOSTIC: InterpreterDiagnostic = {
  phase: "runtime",
  message: "Execution was stopped.",
  line: 1,
  column: 1,
};

export function useInterpreter() {
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pendingRunRef = useRef<PendingRun | null>(null);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    pendingRunRef.current?.reject(STOPPED_DIAGNOSTIC);
    pendingRunRef.current = null;
    setIsRunning(false);
  }, []);

  const run = useCallback(
    (source: string, call: string): Promise<ExecutionResult> => {
      stop();
      setIsRunning(true);

      return new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL("../interpreter/interpreter.worker.ts", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;
        pendingRunRef.current = { resolve, reject };

        worker.onmessage = (event: MessageEvent<RunResponse>) => {
          const response = event.data;
          worker.terminate();
          workerRef.current = null;
          pendingRunRef.current = null;
          setIsRunning(false);

          if (response.type === "success") {
            resolve(response.result);
          } else {
            reject(response.diagnostic);
          }
        };
        worker.onerror = (event) => {
          worker.terminate();
          workerRef.current = null;
          pendingRunRef.current = null;
          setIsRunning(false);
          reject({
            phase: "runtime",
            message: event.message || "The interpreter worker failed.",
            line: 1,
            column: 1,
          } satisfies InterpreterDiagnostic);
        };

        const request: RunRequest = { type: "run", source, call };
        worker.postMessage(request);
      });
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { isRunning, run, stop };
}
