import { useEffect, useState, type FormEvent } from "react";

interface RunDialogProps {
  algorithmName: string;
  parameters: string[];
  defaultCall: string;
  onCancel: () => void;
  onRun: (call: string) => void;
}

export function RunDialog({
  algorithmName,
  parameters,
  defaultCall,
  onCancel,
  onRun,
}: RunDialogProps) {
  const [call, setCall] = useState(defaultCall);

  useEffect(() => setCall(defaultCall), [defaultCall]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (call.trim()) {
      onRun(call.trim());
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="rename-dialog run-dialog"
        aria-labelledby="run-dialog-title"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="run-dialog-title">Run Algorithm</h2>
        <p className="run-dialog__signature">
          {algorithmName}({parameters.join(", ")})
        </p>
        <label htmlFor="run-call-input">Function call</label>
        <input
          id="run-call-input"
          autoFocus
          spellCheck={false}
          value={call}
          onChange={(event) => setCall(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        <p className="run-dialog__hint">
          Enter values using numbers, strings, lists, or tree constructors.
        </p>
        <div className="rename-dialog__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!call.trim()}>
            Run
          </button>
        </div>
      </form>
    </div>
  );
}
