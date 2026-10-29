import type { ReactNode } from "react";
import type { VariableSnapshot } from "../interpreter/runtime.ts";

interface InspectorPanelProps {
  output: string;
  variables: VariableSnapshot[];
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

export function InspectorPanel({ output, variables }: InspectorPanelProps) {
  return (
    <aside className="inspector" aria-label="Program information">
      <PanelSection title="Output">
        {output ? (
          <pre className="output-message" aria-live="polite">
            {output}
          </pre>
        ) : (
          <p className="empty-state">Run the algorithm to see output.</p>
        )}
      </PanelSection>

      <PanelSection title="Variables">
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
