import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import appConfig from "../../src-tauri/tauri.conf.json";

export function SettingsMenu() {
  const [menuPosition, setMenuPosition] = useState<{ left: number; bottom: number } | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuPosition) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setMenuPosition(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuPosition(null);
        buttonRef.current?.focus();
      }
    };
    const onResize = () => setMenuPosition(null);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [menuPosition]);

  useEffect(() => {
    if (!showAbout) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAbout(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showAbout]);

  const openAbout = () => {
    setMenuPosition(null);
    setShowAbout(true);
    setVersion(null);
    if (!isTauri()) {
      setVersion(appConfig.version);
    } else {
      void getVersion().then(setVersion).catch(() => setVersion("Unavailable"));
    }
  };

  return <>
    <button ref={buttonRef} type="button" className={`activity-button activity-button--settings${menuPosition ? " activity-button--active" : ""}`} aria-label="Settings" aria-haspopup="menu" aria-expanded={!!menuPosition} title="Settings" onClick={() => {
      if (menuPosition) { setMenuPosition(null); return; }
      const bounds = buttonRef.current?.getBoundingClientRect();
      if (bounds) setMenuPosition({ left: bounds.left, bottom: window.innerHeight - bounds.top + 5 });
    }}>
      <span className="codicon codicon-settings-gear" aria-hidden="true" />
    </button>
    {menuPosition && createPortal(<div ref={menuRef} className="settings-menu" role="menu" style={{ left: menuPosition.left, bottom: menuPosition.bottom }}>
      <button type="button" role="menuitem" autoFocus onClick={openAbout}>About UNNC AlgoLab</button>
    </div>, document.body)}
    {showAbout && createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={() => { setShowAbout(false); buttonRef.current?.focus(); }}>
      <div className="rename-dialog about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="about-title">About UNNC AlgoLab</h2>
        <p>Version: {version ?? "Loading…"}</p>
        <div className="rename-dialog__actions"><button type="button" autoFocus onClick={() => { setShowAbout(false); buttonRef.current?.focus(); }}>Close</button></div>
      </div>
    </div>, document.body)}
  </>;
}
