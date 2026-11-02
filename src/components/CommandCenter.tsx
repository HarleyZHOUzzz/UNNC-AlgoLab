import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorDocument } from "../types/editor";
import { readFile, type OpenedFolder } from "../services/fileService";
import { findAlgorithms, findText, workspaceFiles, type SearchFile } from "../search/workspaceSearch";

export interface QuickCommand {
  label: string;
  detail?: string;
  action: () => void;
}

export type QuickMode = "files" | "commands" | "line" | "indent" | "indent-size" | "symbols" | "workspace-symbols" | "text";

interface CommandCenterProps {
  mode: QuickMode;
  documents: EditorDocument[];
  activeDocumentId: string;
  folder: OpenedFolder | null;
  onOpenResult: (file: SearchFile, from?: number, to?: number) => void;
  commands: QuickCommand[];
  indentActions: QuickCommand[];
  indentSizeActions: QuickCommand[];
  onClose: () => void;
  onGoToLine: (line: number) => void;
}

export function CommandCenter({ mode, documents, activeDocumentId, folder, commands, indentActions, indentSizeActions, onOpenResult, onClose, onGoToLine }: CommandCenterProps) {
  const [query, setQuery] = useState(mode === "commands" ? ">" : mode === "line" ? ":" : mode === "symbols" ? "@" : mode === "workspace-symbols" ? "#" : mode === "text" ? "%" : "");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const indentMode = mode === "indent" || mode === "indent-size";
  const commandMode = !indentMode && query.startsWith(">");
  const lineMode = !indentMode && query.startsWith(":");
  const symbolMode = !indentMode && query.startsWith("@");
  const workspaceSymbolMode = !indentMode && query.startsWith("#");
  const textMode = !indentMode && query.startsWith("%");
  const files = useMemo(() => workspaceFiles(documents, folder?.entries), [documents, folder]);
  const [loadedFiles, setLoadedFiles] = useState<SearchFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [readErrors, setReadErrors] = useState(0);
  const needsContents = workspaceSymbolMode || textMode;

  useEffect(() => {
    if (!needsContents) return;
    let cancelled = false;
    setLoading(true);
    setLoadedFiles([]);
    setReadErrors(0);
    void (async () => {
      const loaded: SearchFile[] = [];
      let errors = 0;
      for (let start = 0; start < files.length; start += 8) {
        if (cancelled) return;
        const batch = await Promise.all(files.slice(start, start + 8).map(async (file) => {
          if (file.content !== undefined) return file;
          try {
            return { ...file, content: (await readFile(file.path!)).content };
          } catch {
            errors += 1;
            return null;
          }
        }));
        loaded.push(...batch.filter((file): file is SearchFile & { content: string } => file !== null));
      }
      if (!cancelled) { setLoadedFiles(loaded); setReadErrors(errors); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [files, needsContents]);
  const lineText = query.slice(1).trim();
  const lineNumber = /^[1-9]\d*$/.test(lineText) ? Number(lineText) : 0;
  const term = (commandMode || symbolMode || workspaceSymbolMode || textMode ? query.slice(1) : query).trim().toLowerCase();
  const matches = symbolMode
    ? findAlgorithms(files.filter((file) => file.id === activeDocumentId), term)
    : workspaceSymbolMode ? findAlgorithms(loadedFiles, term)
    : textMode ? findText(loadedFiles, term) : [];
  const items = indentMode
    ? (mode === "indent" ? indentActions : indentSizeActions).filter((item) => item.label.toLowerCase().includes(term)).map((item) => ({ label: item.label, detail: item.detail ?? "", action: item.action }))
    : lineMode
    ? (Number.isSafeInteger(lineNumber) && lineNumber > 0 ? [{ label: `Go to line ${lineNumber}`, detail: "Active file", action: () => onGoToLine(lineNumber) }] : [])
    : commandMode
    ? commands.filter((command) => command.label.toLowerCase().includes(term)).map((command) => ({ label: command.label, detail: "", action: command.action }))
    : symbolMode || workspaceSymbolMode || textMode
    ? matches.map((match) => ({ label: match.label, detail: `${match.file.relativePath}:${match.line}`, action: () => onOpenResult(match.file, match.from, match.to) }))
    : files.filter((file) => file.relativePath.toLowerCase().includes(term)).sort((a, b) => Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term))).map((file) => ({ label: file.name, detail: file.relativePath === file.name ? (file.path ?? "Unsaved file") : file.relativePath, action: () => onOpenResult(file) }));
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
      <div className="quick-picker" role="dialog" aria-label="Command center" aria-modal="true">
        <input
          ref={inputRef}
          className="quick-picker__input"
          role="combobox"
          aria-label="Search files, commands, algorithms, or text"
          aria-expanded="true"
          aria-controls="quick-results"
          aria-activedescendant={items.length ? `quick-result-${currentIndex}` : undefined}
          autoComplete="off"
          placeholder={indentMode ? (mode === "indent" ? "Select Action" : "Select Indentation Size") : "Files · > commands · : line · @ algorithms · # workspace · % text"}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
            else if (event.key === "ArrowDown" && items.length) { event.preventDefault(); setSelected((currentIndex + 1) % items.length); }
            else if (event.key === "ArrowUp" && items.length) { event.preventDefault(); setSelected((currentIndex + items.length - 1) % items.length); }
            else if (event.key === "Enter" && items[currentIndex]) { event.preventDefault(); execute(items[currentIndex].action); }
          }}
        />
        <div className="quick-picker__results" id="quick-results" role="listbox" aria-busy={needsContents && loading} aria-label={indentMode ? "Indentation options" : lineMode ? "Go to line" : commandMode ? "Commands" : textMode ? "Text matches" : symbolMode || workspaceSymbolMode ? "Algorithms" : "Workspace files"}>
          {items.length ? items.map((item, index) => (
            <button id={`quick-result-${index}`} type="button" role="option" aria-selected={index === currentIndex} key={`${item.label}-${index}`} onMouseEnter={() => setSelected(index)} onClick={() => execute(item.action)}>
              <span title={item.label}>{item.label}</span>{item.detail && <small title={item.detail}>{item.detail}</small>}
            </button>
          )) : <p className="quick-picker__empty">{needsContents && loading ? "Searching workspace…" : textMode && !term ? "Type % followed by text to search." : indentMode ? "No matching options." : lineMode ? "Enter a line number." : `No ${commandMode ? "commands" : symbolMode || workspaceSymbolMode ? "algorithms" : textMode ? "text matches" : "files"} found.`}</p>}
        </div>
        {needsContents && readErrors > 0 && <p className="quick-picker__empty" role="status">Could not read {readErrors} file(s). Other results are shown.</p>}
        {textMode && matches.length === 200 && <p className="quick-picker__empty">Showing the first 200 matches. Refine your search for more.</p>}
      </div>
    </div>
  );
}
