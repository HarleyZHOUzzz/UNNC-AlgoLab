import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { CommandCenter } from "./components/CommandCenter";
import { EditorPane } from "./components/EditorPane";
import { InspectorPanel } from "./components/InspectorPanel";
import { RenameDialog } from "./components/RenameDialog";
import { RunDialog } from "./components/RunDialog";
import { StatusBar } from "./components/StatusBar";
import { Sidebar } from "./components/Sidebar";
import { Toolbar, ToolbarActions } from "./components/Toolbar";
import { useDocumentWorkspace } from "./hooks/useDocumentWorkspace";
import { useInterpreter } from "./hooks/useInterpreter";
import {
  getEntryFunction,
  toDiagnostic,
} from "./interpreter/index.ts";
import { parseProgram } from "./interpreter/parser.ts";
import type { InterpreterDiagnostic } from "./interpreter/errors.ts";
import type { VariableSnapshot } from "./interpreter/runtime.ts";
import { confirmDiscardWorkspace } from "./services/fileService";
import {
  isDocumentDirty,
  type CursorPosition,
} from "./types/editor";

const INITIAL_CURSOR_POSITION: CursorPosition = { line: 1, column: 1 };

interface RunConfiguration {
  source: string;
  algorithmName: string;
  parameters: string[];
  defaultCall: string;
  documentId: string;
}

function defaultArgument(parameter: string): string {
  const normalized = parameter.toLowerCase();
  if (normalized === "l" || normalized.includes("list")) {
    return "[]";
  }
  if (normalized === "t" || normalized.includes("tree")) {
    return "leaf";
  }
  return normalized === "n" ? "10" : "0";
}

function App() {
  const workspace = useDocumentWorkspace();
  const interpreter = useInterpreter();
  const [searchTarget, setSearchTarget] = useState<{ id: string; from: number; to: number; sequence: number } | null>(null);
  const [quickMode, setQuickMode] = useState<"files" | "commands" | "line" | "indent" | "indent-size" | null>(null);
  const [output, setOutput] = useState("");
  const [runtimeProblem, setRuntimeProblem] = useState<{ documentId: string; source: string; diagnostic: InterpreterDiagnostic } | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"problems" | "output">("output");
  const problems = useMemo(() => {
    const found: { documentId: string; name: string; diagnostic: InterpreterDiagnostic }[] = [];
    for (const document of workspace.documents) {
      if (!document.content.trim()) continue;
      try {
        parseProgram(document.content);
      } catch (error) {
        found.push({ documentId: document.id, name: document.name, diagnostic: toDiagnostic(error) });
      }
    }
    const runtimeDocument = workspace.documents.find((document) => document.id === runtimeProblem?.documentId && document.content === runtimeProblem.source);
    if (runtimeProblem && runtimeDocument && !found.some((problem) => problem.documentId === runtimeDocument.id)) {
      found.push({ documentId: runtimeDocument.id, name: runtimeDocument.name, diagnostic: runtimeProblem.diagnostic });
    }
    return found;
  }, [workspace.documents, runtimeProblem]);
  const [indentSize, setIndentSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("unnc-algolab.indentSize"));
      return [2, 4, 8].includes(saved) ? saved : 2;
    } catch {
      return 2;
    }
  });
  const [variables, setVariables] = useState<VariableSnapshot[]>([]);
  const [cursorPosition, setCursorPosition] = useState(
    INITIAL_CURSOR_POSITION,
  );
  const [renameDocumentId, setRenameDocumentId] = useState<string | null>(
    null,
  );
  const [runConfiguration, setRunConfiguration] =
    useState<RunConfiguration | null>(null);
  const [isInspectorVisible, setIsInspectorVisible] = useState(true);
  const cursorPositionsRef = useRef<Record<string, CursorPosition>>({});
  const documentsRef = useRef(workspace.documents);
  const quitInProgressRef = useRef(false);

  documentsRef.current = workspace.documents;

  const renameDocument = workspace.documents.find(
    (document) => document.id === renameDocumentId,
  );

  const handleRun = useCallback(() => {
    if (interpreter.isRunning) {
      interpreter.stop();
      return;
    }

    try {
      const entry = getEntryFunction(workspace.activeDocument.content);
      const args = entry.parameters.map(defaultArgument).join(", ");
      setRunConfiguration({
        source: workspace.activeDocument.content,
        documentId: workspace.activeDocumentId,
        algorithmName: entry.name,
        parameters: entry.parameters,
        defaultCall: `${entry.name}(${args})`,
      });
    } catch (error) {
      setVariables([]);
      setRuntimeProblem({ documentId: workspace.activeDocumentId, source: workspace.activeDocument.content, diagnostic: toDiagnostic(error) });
      setInspectorTab("problems");
      setIsInspectorVisible(true);
    }
  }, [interpreter, workspace.activeDocument.content, workspace.activeDocumentId]);

  const executeRunConfiguration = useCallback(
    async (call: string) => {
      if (!runConfiguration) {
        return;
      }

      const source = runConfiguration.source;
      setRunConfiguration(null);
      setVariables([]);
      setRuntimeProblem(null);
      setInspectorTab("output");
      setIsInspectorVisible(true);
      setOutput(`Running ${call}…`);

      try {
        const result = await interpreter.run(source, call);
        setOutput(
          result.output.length > 0
            ? result.output.join("\n")
            : result.formattedResult,
        );
        setVariables(result.variables);
      } catch (error) {
        const diagnostic = error as InterpreterDiagnostic;
        if (diagnostic.message === "Execution was stopped.") {
          setOutput("Execution stopped.");
        } else {
          setOutput("");
          setRuntimeProblem({ documentId: runConfiguration.documentId, source, diagnostic });
          setInspectorTab("problems");
        }
        setVariables([]);
      }
    },
    [interpreter, runConfiguration],
  );

  const revealProblem = useCallback((problem: { documentId: string; diagnostic: InterpreterDiagnostic }) => {
    const document = workspace.documents.find((item) => item.id === problem.documentId);
    if (!document) return;
    const lines = document.content.split("\n");
    const lineIndex = Math.min(Math.max(problem.diagnostic.line - 1, 0), lines.length - 1);
    const lineStart = lines.slice(0, lineIndex).reduce((total, line) => total + line.length + 1, 0);
    const offset = lineStart + Math.min(Math.max(problem.diagnostic.column - 1, 0), lines[lineIndex].length);
    workspace.setActiveDocumentId(document.id);
    setSearchTarget((previous) => ({ id: document.id, from: offset, to: offset, sequence: (previous?.sequence ?? 0) + 1 }));
  }, [workspace.documents, workspace.setActiveDocumentId]);

  const showProblems = useCallback(() => {
    setIsInspectorVisible(true);
    setInspectorTab("problems");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        showProblems();
      } else if (event.key === "F8" && problems.length) {
        event.preventDefault();
        const current = problems.findIndex((problem) => problem.documentId === workspace.activeDocumentId && problem.diagnostic.line === cursorPosition.line && problem.diagnostic.column === cursorPosition.column);
        const next = current < 0 ? (event.shiftKey ? problems.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + problems.length) % problems.length;
        revealProblem(problems[next]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [problems, revealProblem, showProblems, workspace.activeDocumentId, cursorPosition]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if ((modifier && ["p", "g"].includes(event.key.toLowerCase())) || event.key === "F1") {
        event.preventDefault();
        event.stopPropagation();
        setQuickMode(event.key.toLowerCase() === "g" ? "line" : event.key === "F1" || event.shiftKey ? "commands" : "files");
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const changeIndentSize = useCallback((size: number) => {
    setIndentSize(size);
    try {
      localStorage.setItem("unnc-algolab.indentSize", String(size));
    } catch {
      // The setting remains available for the current session.
    }
  }, []);

  const goToLine = useCallback((requestedLine: number) => {
    const lines = workspace.activeDocument.content.split("\n");
    const line = Math.min(requestedLine, lines.length);
    const offset = lines.slice(0, line - 1).reduce((total, text) => total + text.length + 1, 0);
    setSearchTarget((previous) => ({ id: workspace.activeDocumentId, from: offset, to: offset, sequence: (previous?.sequence ?? 0) + 1 }));
  }, [workspace.activeDocument.content, workspace.activeDocumentId]);

  const beginRename = useCallback(() => {
    setRenameDocumentId(workspace.activeDocumentId);
  }, [workspace.activeDocumentId]);

  const requestQuit = useCallback(async () => {
    if (quitInProgressRef.current) {
      return;
    }

    quitInProgressRef.current = true;
    try {
      const unsavedFileCount = documentsRef.current.filter(
        isDocumentDirty,
      ).length;
      if (
        unsavedFileCount > 0 &&
        !(await confirmDiscardWorkspace(unsavedFileCount))
      ) {
        return;
      }

      await invoke("exit_app");
    } catch (error) {
      console.error("Unable to quit UNNC AlgoLab.", error);
    } finally {
      quitInProgressRef.current = false;
    }
  }, []);

  const handleMenuAction = useCallback(
    (action: string) => {
      switch (action) {
        case "new_file":
          workspace.newDocument();
          break;
        case "open_file":
          void workspace.openDocuments();
          break;
        case "save_file":
          void workspace.saveDocument();
          break;
        case "save_as":
          void workspace.saveDocumentAs();
          break;
        case "save_all":
          void workspace.saveAllDocuments();
          break;
        case "rename_file":
          beginRename();
          break;
        case "close_tab":
          void workspace.closeDocument();
          break;
        case "close_all_tabs":
          void workspace.closeAllDocuments();
          break;
        case "close_window":
          void getCurrentWindow().close();
          break;
        case "next_editor":
          workspace.activateAdjacentDocument(1);
          break;
        case "previous_editor":
          workspace.activateAdjacentDocument(-1);
          break;
        case "toggle_inspector":
          setIsInspectorVisible((visible) => !visible);
          break;
        case "run_algorithm":
          handleRun();
          break;
        case "stop_algorithm":
          interpreter.stop();
          break;
        case "quit_app":
          void requestQuit();
          break;
      }
    },
    [beginRename, handleRun, requestQuit, workspace],
  );
  const handleMenuActionRef = useRef(handleMenuAction);

  handleMenuActionRef.current = handleMenuAction;

  useEffect(() => {
    setCursorPosition(
      cursorPositionsRef.current[workspace.activeDocumentId] ?? INITIAL_CURSOR_POSITION,
    );
  }, [workspace.activeDocumentId]);

  useEffect(() => {
    const title = `${isDocumentDirty(workspace.activeDocument) ? "● " : ""}${workspace.activeDocument.name} — UNNC AlgoLab`;
    document.title = title;
    if (isTauri()) {
      void getCurrentWindow().setTitle(title);
    }
  }, [workspace.activeDocument]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    const unlistenPromise = listen<string>("menu-action", (event) => {
      handleMenuActionRef.current(event.payload);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (isTauri() && !/Windows/.test(navigator.userAgent)) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.key === "F2") {
        event.preventDefault();
        beginRename();
      } else if (modifier && event.altKey && key === "s") {
        event.preventDefault();
        void workspace.saveAllDocuments();
      } else if (modifier && event.shiftKey && key === "s") {
        event.preventDefault();
        void workspace.saveDocumentAs();
      } else if (modifier && key === "n") {
        event.preventDefault();
        workspace.newDocument();
      } else if (modifier && key === "o") {
        event.preventDefault();
        void workspace.openDocuments();
      } else if (modifier && key === "s") {
        event.preventDefault();
        void workspace.saveDocument();
      } else if (modifier && event.shiftKey && key === "w" && isTauri()) {
        event.preventDefault();
        void getCurrentWindow().close();
      } else if (event.ctrlKey && key === "tab") {
        event.preventDefault();
        workspace.activateAdjacentDocument(event.shiftKey ? -1 : 1);
      } else if (modifier && key === ".") {
        event.preventDefault();
        interpreter.stop();
      } else if (modifier && key === "w") {
        event.preventDefault();
        void workspace.closeDocument();
      } else if (modifier && key === "j") {
        event.preventDefault();
        setIsInspectorVisible((visible) => !visible);
      } else if (modifier && key === "r") {
        event.preventDefault();
        handleRun();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [beginRename, handleRun, interpreter, workspace]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    const unlistenPromise = getCurrentWindow().onCloseRequested(
      (event) => {
        const unsavedFileCount = documentsRef.current.filter(
          isDocumentDirty,
        ).length;
        if (unsavedFileCount === 0) {
          return;
        }

        event.preventDefault();
        void requestQuit();
      },
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [requestQuit]);

  return (
    <div className="ide-shell">
      <Toolbar
        isInspectorVisible={isInspectorVisible}
        onOpenCommandCenter={() => setQuickMode("files")}
        onToggleInspector={() => setIsInspectorVisible((visible) => !visible)}
      />

      <div className="workbench">
        <Sidebar
          documents={workspace.documents}
          activeDocumentId={workspace.activeDocumentId}
          onActivate={workspace.setActiveDocumentId}
          onNew={workspace.newDocument}
          onOpen={() => void workspace.openDocuments()}
          onSearchResult={(id, from, to) => {
            workspace.setActiveDocumentId(id);
            setSearchTarget((previous) => ({ id, from, to, sequence: (previous?.sequence ?? 0) + 1 }));
          }}
        />
      <main
        className={`workspace${
          isInspectorVisible ? "" : " workspace--inspector-hidden"
        }`}
      >
        <EditorPane
          indentSize={indentSize}
          searchTarget={searchTarget}
          actions={
<ToolbarActions
                    onNew={workspace.newDocument}
                    onOpen={() => void workspace.openDocuments()}
                    onSave={() => void workspace.saveDocument()}
                    onRename={beginRename}
                    onSaveAs={() => void workspace.saveDocumentAs()}
                    onSaveAll={() => void workspace.saveAllDocuments()}
                    onCloseEditor={() => void workspace.closeDocument()}
                    onCloseAll={() => void workspace.closeAllDocuments()}
                    onRun={handleRun}
                    onStop={interpreter.stop}
                    isRunning={interpreter.isRunning}
                  />
          }
          documents={workspace.documents}
          activeDocumentId={workspace.activeDocumentId}
          onActivateDocument={workspace.setActiveDocumentId}
          onCloseDocument={(id) => void workspace.closeDocument(id)}
          onChange={workspace.setDocumentContent}
          onCursorChange={(position) => {
            cursorPositionsRef.current[workspace.activeDocumentId] = position;
            setCursorPosition(position);
          }}
        />
        {isInspectorVisible && (
          <InspectorPanel output={output} variables={variables} problems={problems} selectedTab={inspectorTab} onSelectTab={setInspectorTab} onRevealProblem={revealProblem} />
        )}
      </main>
      </div>

      <StatusBar
        cursorPosition={cursorPosition}
        problemCount={problems.length}
        onShowProblems={showProblems}
        indentSize={indentSize}
        onSelectIndentation={() => setQuickMode("indent")}
      />

      {quickMode && (
        <CommandCenter
          key={quickMode}
          mode={quickMode}
          documents={workspace.documents}
          onOpenFile={workspace.setActiveDocumentId}
          onGoToLine={goToLine}
          indentActions={[
            { label: "Indent Using Spaces", detail: "change view", action: () => setQuickMode("indent-size") },
            { label: "Trim Trailing Whitespace", detail: "edit file", action: () => workspace.setDocumentContent(workspace.activeDocumentId, workspace.activeDocument.content.replace(/[\t ]+$/gm, "")) },
          ]}
          indentSizeActions={[2, 4, 8].map((size) => ({ label: `${size} Spaces${size === indentSize ? "  ✓" : ""}`, action: () => changeIndentSize(size) }))}
          onClose={() => setQuickMode(null)}
          commands={[
            { label: "File: New File", action: workspace.newDocument },
            { label: "File: Open File…", action: () => void workspace.openDocuments() },
            { label: "File: Save", action: () => void workspace.saveDocument() },
            { label: "File: Save As…", action: () => void workspace.saveDocumentAs() },
            { label: "File: Save All", action: () => void workspace.saveAllDocuments() },
            { label: "File: Rename…", action: beginRename },
            { label: "File: Close Editor", action: () => void workspace.closeDocument() },
            { label: "File: Close All Editors", action: () => void workspace.closeAllDocuments() },
            { label: "Editor: Go to Line…", action: () => setQuickMode("line") },
            { label: "Indentation: Select Indentation", action: () => setQuickMode("indent") },
            { label: "Indentation: 2 Spaces", action: () => changeIndentSize(2) },
            { label: "Indentation: 4 Spaces", action: () => changeIndentSize(4) },
            { label: "Indentation: 8 Spaces", action: () => changeIndentSize(8) },
            { label: "View: Show Problems", action: showProblems },
            { label: "View: Toggle Inspector", action: () => setIsInspectorVisible((visible) => !visible) },
            { label: "Run: Run Algorithm…", action: handleRun },
            { label: "Run: Stop", action: interpreter.stop },
          ]}
        />
      )}

      {renameDocument && (
        <RenameDialog
          currentName={renameDocument.name}
          onCancel={() => setRenameDocumentId(null)}
          onRename={async (name) => {
            const error = await workspace.renameDocument(
              renameDocument.id,
              name,
            );
            if (!error) {
              setRenameDocumentId(null);
            }
            return error;
          }}
        />
      )}

      {runConfiguration && (
        <RunDialog
          algorithmName={runConfiguration.algorithmName}
          parameters={runConfiguration.parameters}
          defaultCall={runConfiguration.defaultCall}
          onCancel={() => setRunConfiguration(null)}
          onRun={(call) => void executeRunConfiguration(call)}
        />
      )}
    </div>
  );
}

export default App;
