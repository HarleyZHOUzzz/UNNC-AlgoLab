import { useEffect, useState, type FormEvent } from "react";

interface RenameDialogProps {
  currentName: string;
  onCancel: () => void;
  onRename: (name: string) => Promise<string | null>;
}

export function RenameDialog({
  currentName,
  onCancel,
  onRename,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(currentName);
    setError("");
  }, [currentName]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const renameError = await onRename(name);
    setIsSubmitting(false);

    if (renameError) {
      setError(renameError);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="rename-dialog"
        aria-labelledby="rename-dialog-title"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="rename-dialog-title">Rename File</h2>
        <label htmlFor="rename-input">New name</label>
        <input
          id="rename-input"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        {error && <p className="rename-dialog__error">{error}</p>}
        <div className="rename-dialog__actions">
          <button type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Renaming…" : "Rename"}
          </button>
        </div>
      </form>
    </div>
  );
}
