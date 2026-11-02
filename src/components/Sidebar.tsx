import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@vscode/codicons/dist/codicon.css";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { FolderEntry, OpenedFolder } from "../services/fileService";
import { isDocumentDirty, type EditorDocument } from "../types/editor";

export type SidebarView = "files" | "search";

function FolderContents({ expanded, children, root = false }: { expanded: boolean; children: ReactNode; root?: boolean }) {
  return <div className={`sidebar-collapse${expanded ? " sidebar-collapse--expanded" : ""}${root ? " sidebar-collapse--root" : ""}`} aria-hidden={!expanded} inert={!expanded}>
    <div className="sidebar-collapse__content">{children}</div>
  </div>;
}

interface SidebarProps {
  view: SidebarView | null;
  onViewChange: (view: SidebarView | null) => void;
  documents: EditorDocument[];
  activeDocumentId: string;
  folder: OpenedFolder | null;
  folderError: string | null;
  onActivate: (id: string) => void;
  onOpenFolder: () => void;
  onOpenFolderFile: (path: string) => void;
  onRefreshFolder: () => void;
  onCreateFolder: (name: string) => Promise<string | null>;
  onCreateFile: (name: string) => Promise<string | null>;
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
        style={{ paddingLeft: `${depth * 16}px` }}
        title={entry.path}
        aria-expanded={entry.isDirectory ? expanded : undefined}
        onClick={(event) => {
          if (entry.isDirectory) setExpanded((current) => !current);
          else {
            event.currentTarget.focus();
            onOpen(entry.path);
          }
        }}
      >
        {entry.isDirectory
          ? <><span className="folder-tree-toggle" aria-hidden="true"><ChevronRight className="sidebar-chevron" /></span><span className="folder-tree-icon" aria-hidden="true"><Folder className="folder-tree-icon__closed" /><FolderOpen className="folder-tree-icon__open" /></span></>
          : <><span className="folder-tree-indent" /><FileText className="file-icon" aria-hidden="true" /></>}
        <span className="folder-tree-name">{entry.name}</span>
      </button>
      {entry.isDirectory && <FolderContents expanded={expanded}>{entry.children.map((child) => (
        <FolderTreeItem key={child.path} entry={child} depth={depth + 1} activePath={activePath} onOpen={onOpen} collapseGeneration={collapseGeneration} />
      ))}</FolderContents>}
    </>
  );
}

export function Sidebar({ view, onViewChange, documents, activeDocumentId, folder, folderError, onActivate, onOpenFolder, onOpenFolderFile, onRefreshFolder, onCreateFolder, onCreateFile, onSearchResult }: SidebarProps) {
  const lastView = useRef<SidebarView>("files");
  if (view) lastView.current = view;
  const displayedView = view ?? lastView.current;
  const [editorsExpanded, setEditorsExpanded] = useState(true);
  const [folderExpanded, setFolderExpanded] = useState(true);
  const [collapseGeneration, setCollapseGeneration] = useState(0);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [creatingFolderPending, setCreatingFolderPending] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [creatingFilePending, setCreatingFilePending] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    setFolderExpanded(true);
    setCreatingFolder(false);
    setNewFolderName("");
    setNewFolderError(null);
    setCreatingFile(false);
    setNewFileName("");
    setNewFileError(null);
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

  const toggle = (next: SidebarView) => onViewChange(view === next ? null : next);
  const folderActions = () => (
    <div className="sidebar-section-actions">
      <button type="button" onClick={() => { setFolderExpanded(true); setCreatingFolder(false); setCreatingFile(true); setNewFileName(""); setNewFileError(null); }} aria-label="New file" title="New file"><span className="codicon codicon-new-file" aria-hidden="true" /></button>
      <button type="button" disabled={!folder} onClick={() => { setFolderExpanded(true); setCreatingFile(false); setCreatingFolder(true); setNewFolderName(""); setNewFolderError(null); }} aria-label="New folder" title={folder ? "New folder" : "Open a folder first"}><span className="codicon codicon-new-folder" aria-hidden="true" /></button>
      <button type="button" disabled={!folder} onClick={onRefreshFolder} aria-label="Refresh folder" title={folder ? "Refresh folder" : "Open a folder first"}><span className="codicon codicon-refresh" aria-hidden="true" /></button>
      <button type="button" disabled={!folder} onClick={() => { setFolderExpanded(true); setCollapseGeneration((count) => count + 1); }} aria-label="Collapse folders" title={folder ? "Collapse folders" : "Open a folder first"}><span className="codicon codicon-collapse-all" aria-hidden="true" /></button>
    </div>
  );
  return (
    <aside className={`sidebar${view ? "" : " sidebar--collapsed"}`} aria-label="Sidebar">
      <nav className="activity-bar" aria-label="Sidebar views">
        <button type="button" className={view === "files" ? "activity-button activity-button--active" : "activity-button"} aria-label="Open files" aria-pressed={view === "files"} title="Open files" onClick={() => toggle("files")}>
          <span className="codicon codicon-files" aria-hidden="true" />
        </button>
        <button type="button" className={view === "search" ? "activity-button activity-button--active" : "activity-button"} aria-label="Search open files" aria-pressed={view === "search"} title="Search open files" onClick={() => toggle("search")}>
          <span className="codicon codicon-search" aria-hidden="true" />
        </button>
      </nav>
      <div className="sidebar-panel-clip" aria-hidden={!view} inert={!view}>
      <div className="sidebar-panel">
        <div className="sidebar-heading">{displayedView === "files" ? "explorer" : "search"}</div>
        {displayedView === "files" ? <>
          {!folder && documents.length > 0 && <>
          <div className="sidebar-section-title">
            <button type="button" className="sidebar-section-label" aria-expanded={editorsExpanded} onClick={() => setEditorsExpanded((expanded) => !expanded)}>
              <ChevronRight className="sidebar-chevron" aria-hidden="true" />openEditors
            </button>
          </div>
          <FolderContents expanded={editorsExpanded} root><div className="sidebar-list">{documents.map((document) => (
            <button type="button" key={document.id} className={`sidebar-file${document.id === activeDocumentId ? " sidebar-file--active" : ""}`} onClick={(event) => { event.currentTarget.focus(); onActivate(document.id); }} title={document.path ?? document.name}>
              <FileText className="file-icon" aria-hidden="true" />
              <span className={`sidebar-file__name${document.path === null ? " file-name--untitled" : ""}`}>{document.name}</span>
              {isDocumentDirty(document) && <span className="sidebar-file__dirty" aria-label="Unsaved changes">●</span>}
            </button>
          ))}</div></FolderContents>
          </>}
          {!folder && <>
            <div className="sidebar-section-title">
              <button type="button" className="sidebar-section-label" aria-expanded={folderExpanded} onClick={() => setFolderExpanded((expanded) => !expanded)}>
                <ChevronRight className="sidebar-chevron" aria-hidden="true" />No Folder Opened
              </button>
            </div>
            <FolderContents expanded={folderExpanded} root><div className="sidebar-empty-folder">
              <p>You have not yet opened a folder.</p>
              <button type="button" onClick={onOpenFolder}>Open Folder</button>
            </div></FolderContents>
          </>}
          {folder && <>
            <div className="sidebar-section-title folder-section-title">
              <button type="button" className="sidebar-section-label" aria-expanded={folderExpanded} onClick={() => setFolderExpanded((expanded) => !expanded)} title={folder.path}>
                <ChevronRight className="sidebar-chevron" aria-hidden="true" /><span className="folder-tree-name">{folder.name}</span>
              </button>
              {folderActions()}
            </div>
            <FolderContents expanded={folderExpanded} root><div className="sidebar-list folder-tree">
              {creatingFile && <form className="folder-create" onSubmit={async (event) => {
                event.preventDefault();
                if (!newFileName.trim() || creatingFilePending) return;
                setCreatingFilePending(true);
                try {
                  const error = await onCreateFile(newFileName);
                  if (error) setNewFileError(error);
                  else { setCreatingFile(false); setNewFileName(""); setNewFileError(null); }
                } finally {
                  setCreatingFilePending(false);
                }
              }}>
                <FileText className="file-icon" aria-hidden="true" />
                <input autoFocus aria-label="New file name" placeholder="filename.algo" value={newFileName} onChange={(event) => setNewFileName(event.target.value)} onBlur={() => {
                  if (!newFileName.trim() && !creatingFilePending) { setCreatingFile(false); setNewFileError(null); }
                }} onKeyDown={(event) => {
                  if (event.key === "Escape") { event.stopPropagation(); setCreatingFile(false); setNewFileError(null); }
                }} />
              </form>}
              {newFileError && <p className="sidebar-error" role="alert">{newFileError}</p>}
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
              {folder.entries.length === 0 && !creatingFolder && !creatingFile ? <p className="sidebar-hint">No .algo files</p> : folder.entries.map((entry) => (
                <FolderTreeItem key={entry.path} entry={entry} depth={0} activePath={activePath} onOpen={onOpenFolderFile} collapseGeneration={collapseGeneration} />
              ))}
            </div></FolderContents>
          </>}
          {folderError && <p className="sidebar-error" role="alert">{folderError}</p>}
        </> : <>
          <div className="sidebar-search"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search open files" aria-label="Search open files" /></div>
          {query.trim() && <p className="sidebar-hint" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"} in open files</p>}
          <div className="sidebar-list">{results.map((result) => <button type="button" className="search-result" key={`${result.id}-${result.from}`} onClick={() => onSearchResult(result.id, result.from, result.to)}><span className="search-result__file">{result.name} <span>Ln {result.line}</span></span><span className="search-result__text">{result.text}</span></button>)}</div>
        </>}
      </div>
      </div>
    </aside>
  );
}
