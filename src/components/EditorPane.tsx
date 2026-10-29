import { useMemo, type ReactNode } from "react";
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import CodeMirror from "@uiw/react-codemirror";
import { pseudocodeExtensions } from "../editor/pseudocodeLanguage";
import {
  isDocumentDirty,
  type CursorPosition,
  type EditorDocument,
} from "../types/editor";

interface EditorPaneProps {
  actions: ReactNode;
  indentSize: number;
  documents: EditorDocument[];
  activeDocumentId: string;
  onActivateDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onCursorChange: (position: CursorPosition) => void;
}

function FileIcon() {
  return (
    <svg
      className="file-tab__icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M3.5 1.5h5l4 4v9h-9z" />
      <path d="M8.5 1.5v4h4" />
    </svg>
  );
}

export function EditorPane({
  actions,
  indentSize,
  documents,
  activeDocumentId,
  onActivateDocument,
  onCloseDocument,
  onChange,
  onCursorChange,
}: EditorPaneProps) {
  const extensions = useMemo(
    () => [...pseudocodeExtensions, indentUnit.of(" ".repeat(indentSize)), EditorState.tabSize.of(indentSize)],
    [indentSize],
  );

  return (
    <section className="editor-pane" aria-label="Pseudocode editor">
      <div className="editor-header">
      <div className="pane-tabs" role="tablist" aria-label="Open files">
        {documents.map((document) => {
          const isActive = document.id === activeDocumentId;
          const isDirty = isDocumentDirty(document);

          return (
            <div
              className={`file-tab${isActive ? " file-tab--active" : ""}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              key={document.id}
              onClick={() => onActivateDocument(document.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onActivateDocument(document.id);
                }
              }}
              title={document.path ?? document.name}
            >
              <FileIcon />
              <span className="file-tab__name">{document.name}</span>
              {isDirty && (
                <span className="file-tab__dirty" aria-label="Unsaved changes">
                  ●
                </span>
              )}
              <button
                className="file-tab__close"
                type="button"
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

      {documents.map((document) => (
        <div
          className="editor-surface"
          hidden={document.id !== activeDocumentId}
          key={document.id}
        >
          <CodeMirror
            value={document.content}
            height="100%"
            theme="dark"
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
