import { useEffect, useMemo, useState } from "react";
import "@vscode/codicons/dist/codicon.css";
import {
  ChevronDown,
  ChevronRight,
  FileInput,
  FilePlus2,
  FileText,
  Files,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";
import type { FolderEntry, OpenedFolder } from "../services/fileService";
import { isDocumentDirty, type EditorDocument } from "../types/editor";

type SidebarView = "files" | "search";

interface SidebarProps {
  documents: EditorDocument[];
  activeDocumentId: string;
  folder: OpenedFolder | null;
  folderError: string | null;
  onActivate: (id: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onOpenFolderFile: (path: string) => void;
  onRefreshFolder: () => void;
  onCreateFolder: (name: string) => Promise<string | null>;
  onSearchResult: (id: string, from: number, to: number) => void;
}

function FolderTreeItem({ entry, depth, activePath, onOpen, collapseGeneration }: {
  entry: FolderEntry;
  depth: number;
  activePath: string | null;
  onOpen: (path: string) => void;
  collapseGeneration: number;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [collapseGeneration]);
  return (
    <>
      <button
        type="button"
        className={`folder-tree-item${!entry.isDirectory && entry.path === activePath ? " folder-tree-item--active" : ""}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        title={entry.path}
        aria-expanded={entry.isDirectory ? expanded : undefined}
        onClick={() => entry.isDirectory ? setExpanded((current) => !current) : onOpen(entry.path)}
      >
        {entry.isDirectory
          ? <>{expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}{expanded ? <FolderOpen aria-hidden="true" /> : <Folder aria-hidden="true" />}</>
          : <><span className="folder-tree-indent" /><FileText className="sidebar-file__icon" aria-hidden="true" /></>}
        <span className="folder-tree-name">{entry.name}</span>
      </button>
      {entry.isDirectory && expanded && entry.children.map((child) => (
        <FolderTreeItem key={child.path} entry={child} depth={depth + 1} activePath={activePath} onOpen={onOpen} collapseGeneration={collapseGeneration} />
      ))}
    </>
  );
}

export function Sidebar({ documents, activeDocumentId, folder, folderError, onActivate, onNew, onOpen, onOpenFolder, onOpenFolderFile, onRefreshFolder, onCreateFolder, onSearchResult }: SidebarProps) {
  const [view, setView] = useState<SidebarView | null>("files");
  const [editorsExpanded, setEditorsExpanded] = useState(true);
  const [folderExpanded, setFolderExpanded] = useState(true);
  const [collapseGeneration, setCollapseGeneration] = useState(0);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [creatingFolderPending, setCreatingFolderPending] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    setFolderExpanded(true);
    setCreatingFolder(false);
    setNewFolderName("");
    setNewFolderError(null);
  }, [folder?.path]);
  const activePath = documents.find((document) => document.id === activeDocumentId)?.path ?? null;
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
          <Files aria-hidden="true" />
        </button>
        <button type="button" className={view === "search" ? "activity-button activity-button--active" : "activity-button"} aria-label="Search open files" aria-pressed={view === "search"} title="Search open files" onClick={() => toggle("search")}>
          <Search aria-hidden="true" />
        </button>
      </nav>
      {view && <div className="sidebar-panel">
        <div className="sidebar-heading">{view === "files" ? "explorer" : "search"}</div>
        {view === "files" ? <>
          <div className="sidebar-section-title">
            <button type="button" className="sidebar-section-label" aria-expanded={editorsExpanded} onClick={() => setEditorsExpanded((expanded) => !expanded)}>
              {editorsExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}openEditors
            </button>
            <div className="sidebar-section-actions">
              <button type="button" onClick={onNew} aria-label="New file" title="New file"><FilePlus2 aria-hidden="true" /></button>
              <button type="button" onClick={onOpen} aria-label="Open file" title="Open file"><FileInput aria-hidden="true" /></button>
              <button type="button" onClick={onOpenFolder} aria-label="Open folder" title="Open folder"><FolderOpen aria-hidden="true" /></button>
            </div>
          </div>
          {editorsExpanded && <div className="sidebar-list">{documents.map((document) => (
            <button type="button" key={document.id} className={`sidebar-file${document.id === activeDocumentId ? " sidebar-file--active" : ""}`} onClick={() => onActivate(document.id)} title={document.path ?? document.name}>
              <FileText className="sidebar-file__icon" aria-hidden="true" />
              <span className={`sidebar-file__name${document.path === null ? " file-name--untitled" : ""}`}>{document.name}</span>
              {isDocumentDirty(document) && <span className="sidebar-file__dirty" aria-label="Unsaved changes">●</span>}
            </button>
          ))}</div>}
          {folder && <>
            <div className="sidebar-section-title folder-section-title">
              <button type="button" className="sidebar-section-label" aria-expanded={folderExpanded} onClick={() => setFolderExpanded((expanded) => !expanded)} title={folder.path}>
                {folderExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}<span className="folder-tree-name">{folder.name}</span>
              </button>
              <div className="sidebar-section-actions">
                <button type="button" onClick={onNew} aria-label="New file" title="New file"><span className="codicon codicon-new-file" aria-hidden="true" /></button>
                <button type="button" onClick={() => { setFolderExpanded(true); setCreatingFolder(true); setNewFolderName(""); setNewFolderError(null); }} aria-label="New folder" title="New folder"><span className="codicon codicon-new-folder" aria-hidden="true" /></button>
                <button type="button" onClick={onRefreshFolder} aria-label="Refresh folder" title="Refresh folder"><span className="codicon codicon-refresh" aria-hidden="true" /></button>
                <button type="button" onClick={() => { setFolderExpanded(true); setCollapseGeneration((count) => count + 1); }} aria-label="Collapse folders" title="Collapse folders"><span className="codicon codicon-collapse-all" aria-hidden="true" /></button>
              </div>
            </div>
            {folderExpanded && <div className="sidebar-list folder-tree">
              {creatingFolder && <form className="folder-create" onSubmit={async (event) => {
                event.preventDefault();
                if (!newFolderName.trim() || creatingFolderPending) return;
                setCreatingFolderPending(true);
                try {
                  const error = await onCreateFolder(newFolderName);
                  if (error) setNewFolderError(error);
                  else { setCreatingFolder(false); setNewFolderName(""); setNewFolderError(null); }
                } finally {
                  setCreatingFolderPending(false);
                }
              }}>
                <Folder aria-hidden="true" />
                <input autoFocus aria-label="New folder name" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} onKeyDown={(event) => {
                  if (event.key === "Escape") { event.stopPropagation(); setCreatingFolder(false); setNewFolderError(null); }
                }} />
              </form>}
              {newFolderError && <p className="sidebar-error" role="alert">{newFolderError}</p>}
              {folder.entries.length === 0 && !creatingFolder ? <p className="sidebar-hint">No .algo files</p> : folder.entries.map((entry) => (
                <FolderTreeItem key={entry.path} entry={entry} depth={0} activePath={activePath} onOpen={onOpenFolderFile} collapseGeneration={collapseGeneration} />
              ))}
            </div>}
          </>}
          {folderError && <p className="sidebar-error" role="alert">{folderError}</p>}
        </> : <>
          <div className="sidebar-search"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search open files" aria-label="Search open files" /></div>
          {query.trim() && <p className="sidebar-hint" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"} in open files</p>}
          <div className="sidebar-list">{results.map((result) => <button type="button" className="search-result" key={`${result.id}-${result.from}`} onClick={() => onSearchResult(result.id, result.from, result.to)}><span className="search-result__file">{result.name} <span>Ln {result.line}</span></span><span className="search-result__text">{result.text}</span></button>)}</div>
        </>}
      </div>}
    </aside>
  );
}
