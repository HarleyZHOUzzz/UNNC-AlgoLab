import type { ReactNode } from "react";
import { formatDiagnostic, type InterpreterDiagnostic } from "../interpreter/errors.ts";
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
  return (
    <aside className="inspector" aria-label="Program information">
      <section className="inspector-section">
        <div className="inspector-tabs" role="tablist" aria-label="Problems and output">
          <button type="button" role="tab" aria-selected={selectedTab === "problems"} onClick={() => onSelectTab("problems")}>Problems{problems.length > 0 && <span className="problem-count">{problems.length}</span>}</button>
          <button type="button" role="tab" aria-selected={selectedTab === "output"} onClick={() => onSelectTab("output")}>Output</button>
        </div>
        <div className="inspector-section__content" role="tabpanel" aria-label={selectedTab === "problems" ? "Problems" : "Output"}>
          {selectedTab === "problems" ? (
            problems.length ? <div className="problem-list" aria-live="polite">{problems.map((problem) => <button type="button" key={problem.documentId} onClick={() => onRevealProblem(problem)}><span className="problem-list__file">{problem.name}</span><span>{formatDiagnostic(problem.diagnostic)}</span></button>)}</div> : <p className="empty-state">No problems detected in open files.</p>
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
