import { useMemo, useState } from "react";
import { isDocumentDirty, type EditorDocument } from "../types/editor";

type SidebarView = "files" | "search";

interface SidebarProps {
  documents: EditorDocument[];
  activeDocumentId: string;
  onActivate: (id: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSearchResult: (id: string, from: number, to: number) => void;
}

export function Sidebar({ documents, activeDocumentId, onActivate, onNew, onOpen, onSearchResult }: SidebarProps) {
  const [view, setView] = useState<SidebarView | null>("files");
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const needle = query.toLowerCase();
    return documents.flatMap((document) => {
      let offset = 0;
      return document.content.split("\n").flatMap((line, index) => {
        const matches: { id: string; name: string; line: number; text: string; from: number; to: number }[] = [];
        const lower = line.toLowerCase();
        let found = lower.indexOf(needle);
        while (found !== -1) {
          matches.push({ id: document.id, name: document.name, line: index + 1, text: line.trim(), from: offset + found, to: offset + found + query.length });
          found = lower.indexOf(needle, found + needle.length);
        }
        offset += line.length + 1;
        return matches;
      });
    });
  }, [documents, query]);

  const toggle = (next: SidebarView) => setView((current) => current === next ? null : next);
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <nav className="activity-bar" aria-label="Sidebar views">
        <button type="button" className={view === "files" ? "activity-button activity-button--active" : "activity-button"} aria-label="Open files" aria-pressed={view === "files"} title="Open files" onClick={() => toggle("files")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v13H7zM15 3v4h4M4 7v14h11" /></svg>
        </button>
        <button type="button" className={view === "search" ? "activity-button activity-button--active" : "activity-button"} aria-label="Search open files" aria-pressed={view === "search"} title="Search open files" onClick={() => toggle("search")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 5 5" /></svg>
        </button>
      </nav>
      {view && <div className="sidebar-panel">
        <div className="sidebar-heading">{view === "files" ? "explorer" : "search"}</div>
        {view === "files" ? <>
          <div className="sidebar-section-title"><span>openEditors</span><div><button type="button" onClick={onNew} aria-label="New file" title="New file">+</button><button type="button" onClick={onOpen} aria-label="Open file" title="Open file">↗</button></div></div>
          <div className="sidebar-list">{documents.map((document) => <button type="button" key={document.id} className={`sidebar-file${document.id === activeDocumentId ? " sidebar-file--active" : ""}`} onClick={() => onActivate(document.id)} title={document.path ?? document.name}><span className="sidebar-file__icon">◇</span><span className="sidebar-file__name">{document.name}</span>{isDocumentDirty(document) && <span aria-label="Unsaved changes">●</span>}</button>)}</div>
          <p className="sidebar-hint">Files currently open in the editor</p>
        </> : <>
          <div className="sidebar-search"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search open files" aria-label="Search open files" /></div>
          {query.trim() && <p className="sidebar-hint" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"} in open files</p>}
          <div className="sidebar-list">{results.map((result) => <button type="button" className="search-result" key={`${result.id}-${result.from}`} onClick={() => onSearchResult(result.id, result.from, result.to)}><span className="search-result__file">{result.name} <span>Ln {result.line}</span></span><span className="search-result__text">{result.text}</span></button>)}</div>
        </>}
      </div>}
    </aside>
  );
}
