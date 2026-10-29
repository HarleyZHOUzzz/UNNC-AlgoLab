import { toDiagnostic } from "./errors.ts";
import { interpret } from "./index.ts";
import type { RunRequest, RunResponse } from "./protocol.ts";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RunRequest>) => void) | null;
  postMessage: (message: RunResponse) => void;
};

workerScope.onmessage = (event) => {
  if (event.data.type !== "run") {
    return;
  }

  try {
    const result = interpret(event.data.source, event.data.call);
    workerScope.postMessage({ type: "success", result });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      diagnostic: toDiagnostic(error),
    });
  }
};
