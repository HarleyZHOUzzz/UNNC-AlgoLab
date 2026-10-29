import { useEffect, useRef, useState } from "react";
import type { CursorPosition } from "../types/editor";

interface StatusBarProps {
  cursorPosition: CursorPosition;
  status: string;
  indentSize: number;
  onIndentSizeChange: (size: number) => void;
}

export function StatusBar({ cursorPosition, status, indentSize, onIndentSizeChange }: StatusBarProps) {
  const [isIndentMenuOpen, setIsIndentMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isIndentMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsIndentMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsIndentMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isIndentMenuOpen]);

  return (
    <footer className="status-bar">
      <div className="status-bar__group">
        <span className="status-indicator" aria-hidden="true" />
        <span className="status-message" title={status}>
          {status}
        </span>
      </div>
      <div className="status-bar__group status-bar__group--right">
        <span>
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
        <div className="indent-setting" ref={menuRef}>
          <button ref={triggerRef} className="indent-setting__trigger" type="button" aria-expanded={isIndentMenuOpen} aria-controls="indent-options" onClick={() => setIsIndentMenuOpen((open) => !open)} title="Change indentation width">
            Spaces: {indentSize}
          </button>
          {isIndentMenuOpen && (
            <div className="indent-menu" id="indent-options" role="group" aria-label="Indentation width">
              <div className="indent-menu__title">Indentation width</div>
              {[2, 4, 8].map((size) => (
                <button type="button" key={size} aria-pressed={size === indentSize} onClick={() => {
                  onIndentSizeChange(size);
                  setIsIndentMenuOpen(false);
                  triggerRef.current?.focus();
                }}>
                  <span>{size} spaces</span>
                  {size === indentSize && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <span>UTF-8</span>
        <span>Pseudocode</span>
      </div>
    </footer>
  );
}
