import type { CursorPosition } from "../types/editor";

interface StatusBarProps {
  cursorPosition: CursorPosition;
  problemCount: number;
  onShowProblems: () => void;
  indentSize: number;
  onSelectIndentation: () => void;
}

export function StatusBar({ cursorPosition, indentSize, onSelectIndentation, problemCount, onShowProblems }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar__group">
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
