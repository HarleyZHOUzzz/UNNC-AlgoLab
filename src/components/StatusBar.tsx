import type { CursorPosition } from "../types/editor";

interface StatusBarProps {
  cursorPosition: CursorPosition;
  status: string;
  indentSize: number;
  onIndentSizeChange: (size: number) => void;
}

export function StatusBar({ cursorPosition, status, indentSize, onIndentSizeChange }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar__group">
        <span className="status-indicator" aria-hidden="true" />
        <span className="status-message" title={status}>
          {status}
        </span>
      </div>
      <div className="status-bar__group status-bar__group--right">
        <span>
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
        <label className="indent-setting" title="Indentation width">
          <span>Spaces:</span>
          <select aria-label="Indentation width in spaces" value={indentSize} onChange={(event) => onIndentSizeChange(Number(event.target.value))}>
            {[2, 4, 8].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <span>UTF-8</span>
        <span>Pseudocode</span>
      </div>
    </footer>
  );
}
