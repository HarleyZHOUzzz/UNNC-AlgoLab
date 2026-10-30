import { useEffect, useRef, useState } from "react";
import type { EditorDocument } from "../types/editor";

export interface QuickCommand {
  label: string;
  detail?: string;
  action: () => void;
}

interface CommandCenterProps {
  mode: "files" | "commands" | "line" | "indent" | "indent-size";
  documents: EditorDocument[];
  commands: QuickCommand[];
  indentActions: QuickCommand[];
  indentSizeActions: QuickCommand[];
  onOpenFile: (id: string) => void;
  onClose: () => void;
  onGoToLine: (line: number) => void;
}

export function CommandCenter({ mode, documents, commands, indentActions, indentSizeActions, onOpenFile, onClose, onGoToLine }: CommandCenterProps) {
  const [query, setQuery] = useState(mode === "commands" ? ">" : mode === "line" ? ":" : "");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const indentMode = mode === "indent" || mode === "indent-size";
  const commandMode = !indentMode && query.startsWith(">");
  const lineMode = !indentMode && query.startsWith(":");
  const lineText = query.slice(1).trim();
  const lineNumber = /^[1-9]\d*$/.test(lineText) ? Number(lineText) : 0;
  const term = (commandMode ? query.slice(1) : query).trim().toLowerCase();
  const items = indentMode
    ? (mode === "indent" ? indentActions : indentSizeActions).filter((item) => item.label.toLowerCase().includes(term)).map((item) => ({ label: item.label, detail: item.detail ?? "", action: item.action }))
    : lineMode
    ? (Number.isSafeInteger(lineNumber) && lineNumber > 0 ? [{ label: `Go to line ${lineNumber}`, detail: "Active file", action: () => onGoToLine(lineNumber) }] : [])
    : commandMode
    ? commands.filter((command) => command.label.toLowerCase().includes(term)).map((command) => ({ label: command.label, detail: "", action: command.action }))
    : documents.filter((item) => item.name.toLowerCase().includes(term)).map((item) => ({ label: item.name, detail: item.path ?? "Open editor", action: () => onOpenFile(item.id) }));
  const currentIndex = Math.min(selected, Math.max(items.length - 1, 0));

  useEffect(() => {
    inputRef.current?.focus();
    return () => previousFocus.current?.focus();
  }, []);

  const execute = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div className="quick-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`quick-picker${indentMode ? " quick-picker--indent" : ""}`} role="dialog" aria-label="Command center" aria-modal="true">
        <input
          ref={inputRef}
          className="quick-picker__input"
          role="combobox"
          aria-label="Search open files or commands"
          aria-expanded="true"
          aria-controls="quick-results"
          aria-activedescendant={items.length ? `quick-result-${currentIndex}` : undefined}
          autoComplete="off"
          placeholder={indentMode ? (mode === "indent" ? "Select Action" : "Select Indentation Size") : "Search files, > commands, : line"}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
            else if (event.key === "ArrowDown" && items.length) { event.preventDefault(); setSelected((currentIndex + 1) % items.length); }
            else if (event.key === "ArrowUp" && items.length) { event.preventDefault(); setSelected((currentIndex + items.length - 1) % items.length); }
            else if (event.key === "Enter" && items[currentIndex]) { event.preventDefault(); execute(items[currentIndex].action); }
          }}
        />
        {!indentMode && <div className="quick-picker__hint">{lineMode ? "Go to line in the active file" : commandMode ? "Commands" : "Open editors · > Commands · : Go to line"}</div>}
        <div className="quick-picker__results" id="quick-results" role="listbox" aria-label={indentMode ? "Indentation options" : lineMode ? "Go to line" : commandMode ? "Commands" : "Open editors"}>
          {items.length ? items.map((item, index) => (
            <button id={`quick-result-${index}`} type="button" role="option" aria-selected={index === currentIndex} key={`${item.label}-${index}`} onMouseEnter={() => setSelected(index)} onClick={() => execute(item.action)}>
              <span>{item.label}</span>{item.detail && <small title={item.detail}>{item.detail}</small>}
            </button>
          )) : <p className="quick-picker__empty">{indentMode ? "No matching options." : lineMode ? "Enter a line number." : `No ${commandMode ? "commands" : "open files"} found.`}</p>}
        </div>
      </div>
    </div>
  );
}
