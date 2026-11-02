import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import { EditorView, placeholder } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { FileText } from "lucide-react";
import { pseudocodeExtensions } from "../editor/pseudocodeLanguage";
import {
  isDocumentDirty,
  type CursorPosition,
  type EditorDocument,
} from "../types/editor";

interface EditorPaneProps {
  views: RefObject<Map<string, EditorView>>;
  actions: ReactNode;
  indentSize: number;
  searchTarget: { id: string; from: number; to: number; sequence: number } | null;
  documents: EditorDocument[];
  activeDocumentId: string;
  onActivateDocument: (id: string) => void;
  onReorderDocument: (id: string, targetId: string, side: "before" | "after") => void;
  onCloseDocument: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onCursorChange: (position: CursorPosition) => void;
}

export function EditorPane({
  views,
  actions,
  indentSize,
  searchTarget,
  documents,
  activeDocumentId,
  onActivateDocument,
  onReorderDocument,
  onCloseDocument,
  onChange,
  onCursorChange,
}: EditorPaneProps) {
  const draggingId = useRef<string | null>(null);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: "before" | "after" } | null>(null);
  const clearDrag = () => { draggingId.current = null; setDraggedTab(null); setDropTarget(null); };
  const extensions = useMemo(
    () => [...pseudocodeExtensions, indentUnit.of(" ".repeat(indentSize)), EditorState.tabSize.of(indentSize), placeholder("Start typing to dismiss")],
    [indentSize],
  );

  useEffect(() => {
    if (!searchTarget || searchTarget.id !== activeDocumentId) return;
    const view = views.current.get(searchTarget.id);
    if (!view) return;
    const from = Math.min(searchTarget.from, view.state.doc.length);
    const to = Math.min(searchTarget.to, view.state.doc.length);
    view.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: "center" }) });
    view.focus();
  }, [activeDocumentId, searchTarget]);

  useEffect(() => {
    const ids = new Set(documents.map((document) => document.id));
    for (const id of views.current.keys()) if (!ids.has(id)) views.current.delete(id);
  }, [documents]);

  return (
    <section className="editor-pane" aria-label="Pseudocode editor">
      <div className="editor-header">
      <div className="pane-tabs" role="tablist" aria-label="Open files" onDragOver={(event) => {
        if (!draggingId.current) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left + 24) event.currentTarget.scrollLeft -= 16;
        else if (event.clientX > bounds.right - 24) event.currentTarget.scrollLeft += 16;
        if (!(event.target as HTMLElement).closest(".file-tab")) {
          const last = documents[documents.length - 1];
          setDropTarget(last && last.id !== draggingId.current ? { id: last.id, side: "after" } : null);
        }
      }} onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
      }} onDrop={(event) => {
        if (!draggingId.current || !dropTarget) return;
        event.preventDefault();
        onReorderDocument(draggingId.current, dropTarget.id, dropTarget.side);
        clearDrag();
      }}>
        {documents.map((document) => {
          const isActive = document.id === activeDocumentId;
          const isDirty = isDocumentDirty(document);

          return (
            <div
              className={`file-tab${isActive ? " file-tab--active" : ""}${draggedTab === document.id ? " file-tab--dragging" : ""}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              key={document.id}
              draggable
              onDragStart={(event) => {
                if ((event.target as HTMLElement).closest(".file-tab__close")) { event.preventDefault(); return; }
                draggingId.current = document.id;
                setDraggedTab(document.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-algolab-tab", document.id);
              }}
              onDragEnd={clearDrag}
              onDragOver={(event) => {
                if (!draggingId.current) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                setDropTarget(draggingId.current === document.id ? null : { id: document.id, side: event.clientX < bounds.left + bounds.width / 2 ? "before" : "after" });
              }}
              onClick={() => onActivateDocument(document.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onActivateDocument(document.id);
                }
              }}
              title={document.path ?? document.name}
            >
              {dropTarget?.id === document.id && <span className={`file-tab__drop-marker file-tab__drop-marker--${dropTarget.side}`} aria-hidden="true" />}
              <FileText className="file-icon" aria-hidden="true" />
              <span className={`file-tab__name${document.path === null ? " file-name--untitled" : ""}`}>{document.name}</span>
              {isDirty && (
                <span className="file-tab__dirty" aria-label="Unsaved changes">
                  ●
                </span>
              )}
              <button
                className="file-tab__close"
                type="button"
                draggable={false}
                onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}
                aria-label={`Close ${document.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseDocument(document.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {actions}
      </div>

      {documents.length === 0 && <p className="empty-state">Open or create a file to start editing.</p>}

      {documents.map((document) => (
        <div
          className="editor-surface"
          hidden={document.id !== activeDocumentId}
          key={document.id}
        >
          <CodeMirror
            value={document.content}
            onCreateEditor={(view) => {
              views.current.set(document.id, view);
              if (searchTarget?.id === document.id) {
                const from = Math.min(searchTarget.from, view.state.doc.length);
                const to = Math.min(searchTarget.to, view.state.doc.length);
                view.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: "center" }) });
                view.focus();
              }
            }}
            height="100%"
            theme={oneDarkTheme}
            basicSetup={{
              foldGutter: false,
              highlightActiveLineGutter: true,
              highlightSelectionMatches: true,
            }}
            extensions={extensions}
            onChange={(value) => onChange(document.id, value)}
            onUpdate={(viewUpdate) => {
              if (
                document.id !== activeDocumentId ||
                (!viewUpdate.docChanged && !viewUpdate.selectionSet)
              ) {
                return;
              }

              const offset = viewUpdate.state.selection.main.head;
              const line = viewUpdate.state.doc.lineAt(offset);
              onCursorChange({
                line: line.number,
                column: offset - line.from + 1,
              });
            }}
            aria-label={`Pseudocode source: ${document.name}`}
          />
        </div>
      ))}
    </section>
  );
}
