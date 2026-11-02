import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { InterpreterDiagnostic } from "../interpreter/errors.ts";
import type { VariableSnapshot } from "../interpreter/runtime.ts";

interface InspectorPanelProps {
  output: string;
  variables: VariableSnapshot[];
  problems: { documentId: string; name: string; diagnostic: InterpreterDiagnostic }[];
  onRevealProblem: (problem: { documentId: string; diagnostic: InterpreterDiagnostic }) => void;
  selectedTab: "problems" | "output";
  onSelectTab: (tab: "problems" | "output") => void;
}

interface PanelSectionProps {
  title: string;
  children: ReactNode;
}

function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <section className="inspector-section">
      <h2 className="inspector-section__title">{title}</h2>
      <div className="inspector-section__content">{children}</div>
    </section>
  );
}

export function InspectorPanel({ output, variables, problems, selectedTab, onSelectTab, onRevealProblem }: InspectorPanelProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());
  const groups = Array.from(problems.reduce((files, problem) => {
    const group = files.get(problem.documentId);
    if (group) group.problems.push(problem);
    else files.set(problem.documentId, { name: problem.name, problems: [problem] });
    return files;
  }, new Map<string, { name: string; problems: typeof problems }>()));

  return (
    <aside className="inspector" aria-label="Program information">
      <section className="inspector-section">
        <div className="inspector-tabs" role="tablist" aria-label="Problems and output">
          <button type="button" role="tab" aria-selected={selectedTab === "problems"} onClick={() => onSelectTab("problems")}>Problems{problems.length > 0 && <span className="problem-count">{problems.length}</span>}</button>
          <button type="button" role="tab" aria-selected={selectedTab === "output"} onClick={() => onSelectTab("output")}>Output</button>
        </div>
        <div className="inspector-section__content" role="tabpanel" aria-label={selectedTab === "problems" ? "Problems" : "Output"}>
          {selectedTab === "problems" ? (
            problems.length ? <div className="problem-list" aria-live="polite">{groups.map(([documentId, group]) => {
              const expanded = !collapsedFiles.has(documentId);
              return <div className="problem-group" key={documentId}>
                <button type="button" className="problem-group__header" aria-expanded={expanded} onClick={() => setCollapsedFiles((current) => {
                  const next = new Set(current);
                  if (next.has(documentId)) next.delete(documentId); else next.add(documentId);
                  return next;
                })}>
                  {expanded ? <ChevronDown className="problem-group__chevron" aria-hidden="true" /> : <ChevronRight className="problem-group__chevron" aria-hidden="true" />}
                  <FileText className="file-icon" aria-hidden="true" />
                  <span className="problem-list__file">{group.name}</span>
                  <span className="problem-group__count" aria-label={`${group.problems.length} errors`}>{group.problems.length}</span>
                </button>
                {expanded && group.problems.map((problem, index) => (
                  <button type="button" className="problem-list__item" key={`${problem.diagnostic.line}-${problem.diagnostic.column}-${index}`} onClick={() => onRevealProblem(problem)} title={`Go to ${problem.name}, line ${problem.diagnostic.line}, column ${problem.diagnostic.column}`}>
                    <span className="codicon codicon-error problem-list__icon" aria-hidden="true" />
                    <span className="problem-list__message">{problem.diagnostic.message}</span>
                    <span className="problem-list__location">[{problem.diagnostic.line}, {problem.diagnostic.column}]</span>
                  </button>
                ))}
              </div>;
            })}</div> : <p className="empty-state">No problems have been detected in open files.</p>
          ) : output ? <pre className="output-message" aria-live="polite">{output}</pre> : <p className="empty-state">Run the algorithm to see output.</p>}
        </div>
      </section>

      <PanelSection title="variables">
        <div className="variable-header" aria-hidden="true">
          <span>Name</span>
          <span>Value</span>
          <span>Type</span>
        </div>
        {variables.length > 0 ? (
          <div className="variable-list" role="table" aria-label="Variables">
            {variables.map((variable) => (
              <div className="variable-row" role="row" key={variable.name}>
                <span role="cell">{variable.name}</span>
                <code role="cell" title={variable.value}>
                  {variable.value}
                </code>
                <span role="cell">{variable.type}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state empty-state--centered">
            No variables to display
          </p>
        )}
      </PanelSection>
    </aside>
  );
}
