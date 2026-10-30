import type { CursorPosition } from "../types/editor";

interface StatusBarProps {
  cursorPosition: CursorPosition;
  problemCount: number;
  autoSaveEnabled: boolean;
  autoSaveError: string | null;
  onToggleAutoSave: () => void;
  onShowProblems: () => void;
  indentSize: number;
  onSelectIndentation: () => void;
}

export function StatusBar({ cursorPosition, indentSize, onSelectIndentation, problemCount, onShowProblems, autoSaveEnabled, autoSaveError, onToggleAutoSave }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar__group">
        <button className="status-autosave" type="button" onClick={onToggleAutoSave} aria-pressed={autoSaveEnabled} title={autoSaveError ?? (autoSaveEnabled ? "Auto save enabled for saved files" : "Auto save disabled")}>
          {autoSaveError ? "Auto Save Error" : autoSaveEnabled ? "Auto Save" : "Auto Save Off"}
        </button>
        <button className="status-problems" type="button" onClick={onShowProblems} aria-label={`${problemCount} errors, show problems`} title="Show Problems">
          <span aria-hidden="true">⊗</span> {problemCount}
        </button>
      </div>
      <div className="status-bar__group status-bar__group--right">
        <span>
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
        <button className="indent-setting__trigger" type="button" onClick={onSelectIndentation} title="Select indentation">
          Spaces: {indentSize}
        </button>
        <span>UTF-8</span>
        <span>Pseudocode</span>
      </div>
    </footer>
  );
}
