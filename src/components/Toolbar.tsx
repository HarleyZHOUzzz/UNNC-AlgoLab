import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import appIcon from "../../src-tauri/icons/128x128.png";

interface ToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onRename: () => void;
  onRun: () => void;
  onStop: () => void;
  isRunning: boolean;
}

interface ToolbarButtonProps {
  label: string;
  shortcut: string;
  icon: "new" | "open" | "save" | "rename";
  onClick: () => void;
}

function isMacOS(): boolean {
  return /Macintosh|Mac OS X/.test(navigator.userAgent);
}

function ToolbarButton({
  label,
  shortcut,
  icon,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      className="toolbar-button"
      type="button"
      onClick={onClick}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {icon === "new" && <><path d="M3.5 1.5h6l3 3v10h-9z" /><path d="M9.5 1.5v3h3M8 7v4M6 9h4" /></>}
        {icon === "open" && <><path d="M1.5 4h5l1.5 1.5h6.5l-1.5 7h-12z" /><path d="M1.5 4v-1h5l1.5 1.5" /></>}
        {icon === "save" && <><path d="M2.5 1.5h9l2 2v11h-11z" /><path d="M5 1.5v4h6v-4M5 14.5v-6h6v6" /></>}
        {icon === "rename" && <><path d="M3 12.5l1-3 6.8-6.8 2.5 2.5L6.5 12zM9.8 3.7l2.5 2.5M3 12.5l3.5-.5" /></>}
      </svg>
      <span>{label}</span>
    </button>
  );
}

interface RunButtonProps {
  isRunning: boolean;
  shortcut: string;
  onClick: () => void;
}

function RunButton({ isRunning, shortcut, onClick }: RunButtonProps) {
  const label = isRunning ? "Stop" : "Run";

  return (
    <button
      className={`toolbar-run-button${
        isRunning ? " toolbar-run-button--running" : ""
      }`}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {isRunning ? (
          <rect x="4" y="4" width="8" height="8" rx="0.5" />
        ) : (
          <path d="M4.5 2.75 12.5 8l-8 5.25z" />
        )}
      </svg>
      <span>{label}</span>
    </button>
  );
}

export function Toolbar({ isInspectorVisible, onToggleInspector, onOpenCommandCenter, onMenuAction, onRequestClose }: {
  isInspectorVisible: boolean;
  onToggleInspector: () => void;
  onOpenCommandCenter: () => void;
  onMenuAction: (action: string) => void;
  onRequestClose: () => void;
}) {
  const macOS = isMacOS();
  const customWindow = isTauri() && (/Windows/.test(navigator.userAgent) || macOS);
  const windowsWindow = customWindow && !macOS;
  const menusRef = useRef<HTMLElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!windowsWindow) return;
    const window = getCurrentWindow();
    let disposed = false;
    const updateMaximized = () => {
      void window.isMaximized().then((maximized) => {
        if (!disposed) setIsMaximized(maximized);
      }).catch(() => {});
    };
    updateMaximized();
    const unlisten = window.onResized(updateMaximized);
    return () => {
      disposed = true;
      void unlisten.then((stop) => stop()).catch(() => {});
    };
  }, [windowsWindow]);

  useEffect(() => {
    if (!windowsWindow) return;
    const closeMenus = () => menusRef.current?.querySelectorAll("details[open]").forEach((menu) => menu.removeAttribute("open"));
    const onPointerDown = (event: PointerEvent) => {
      if (!menusRef.current?.contains(event.target as Node)) closeMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [windowsWindow]);

  return (
    <header className={`toolbar${windowsWindow ? " toolbar--windows" : ""}`} data-tauri-drag-region={windowsWindow ? undefined : ""}>
      {customWindow && macOS && (
        <div className="mac-window-controls" aria-label="Window controls">
          <button className="mac-window-controls__close" type="button" aria-label="Close window" title="Close" onClick={() => void getCurrentWindow().close()}><span aria-hidden="true">×</span></button>
          <button className="mac-window-controls__minimize" type="button" aria-label="Minimize window" title="Minimize" onClick={() => void getCurrentWindow().minimize()}><span aria-hidden="true">−</span></button>
          <button className="mac-window-controls__maximize" type="button" aria-label="Maximize or restore window" title="Maximize or restore" onClick={() => void getCurrentWindow().toggleMaximize()}><span aria-hidden="true">+</span></button>
        </div>
      )}
      {windowsWindow && (
        <nav ref={menusRef} className="titlebar-menus" aria-label="Application menu">
          <img className="titlebar-app-icon" src={appIcon} alt="" />
          {[
            { label: "File", items: [["New File", "new_file"], ["Open…", "open_file"], ["Save", "save_file"], ["Save As…", "save_as"], ["Save All", "save_all"], ["Rename…", "rename_file"], ["Close Editor", "close_tab"], ["Close All Editors", "close_all_tabs"]] },
            { label: "Edit", items: [["Undo", "undo"], ["Redo", "redo"]] },
            { label: "Selection", items: [["Select All", "select_all"]] },
            { label: "View", items: [["Search Files and Commands", "quick_open"], ["Toggle Output and Variables", "toggle_inspector"]] },
          ].map((menu) => (
            <details className="toolbar-menu" name="titlebar-menu" key={menu.label}>
              <summary>{menu.label}</summary>
              <div className="toolbar-menu__items">
                {menu.items.map(([label, action]) => (
                  <button type="button" key={action} onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    onMenuAction(action);
                  }}>{label}</button>
                ))}
              </div>
            </details>
          ))}
        </nav>
      )}
      <div className="toolbar-drag-region" data-tauri-drag-region={windowsWindow ? undefined : ""} />
      <button type="button" className="command-center-trigger" onClick={onOpenCommandCenter} aria-label="Search open files and commands" title={`Quick Open (${macOS ? "⌘P" : "Ctrl+P"})`}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
        <span>Search files and commands</span>
      </button>
      <div className="toolbar-drag-region" data-tauri-drag-region={windowsWindow ? undefined : ""} />
      <button
        className="titlebar-panel-button"
        type="button"
        onClick={onToggleInspector}
        aria-label="Toggle output and variables panel"
        aria-pressed={isInspectorVisible}
        title={`Toggle output and variables (${macOS ? "⌘J" : "Ctrl+J"})`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
          <rect x="2" y="2.5" width="12" height="11" rx="1" />
          <path d="M9.5 2.5v11" />
        </svg>
      </button>
      {windowsWindow && (
        <div className="window-controls">
          <button type="button" aria-label="Minimize window" title="Minimize" onClick={() => void getCurrentWindow().minimize()}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" /></svg>
          </button>
          <button type="button" aria-label={isMaximized ? "Restore window" : "Maximize window"} title={isMaximized ? "Restore" : "Maximize"} onClick={() => void getCurrentWindow().toggleMaximize()}>
            <svg viewBox="0 0 16 16" aria-hidden="true">{isMaximized ? <><path d="M5.5 4.5v-1a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1" /><rect x="2.5" y="5.5" width="8" height="8" rx="1" /></> : <rect x="3.5" y="3.5" width="9" height="9" rx="1.2" />}</svg>
          </button>
          <button className="window-controls__close" type="button" aria-label="Close window" title="Close" onClick={onRequestClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
      )}
    </header>
  );
}

export function ToolbarActions({
  onNew,
  onOpen,
  onSave,
  onRename,
  onRun,
  onStop,
  isRunning,
}: ToolbarProps) {
  const macOS = isMacOS();
  const showFileActions = !isTauri();

  return (
      <nav className="toolbar-actions" aria-label="File and run actions">
        {showFileActions && (
          <>
            <ToolbarButton label="New" icon="new" shortcut={macOS ? "⌘N" : "Ctrl+N"} onClick={onNew} />
            <ToolbarButton label="Open" icon="open" shortcut={macOS ? "⌘O" : "Ctrl+O"} onClick={onOpen} />
            <ToolbarButton label="Save" icon="save" shortcut={macOS ? "⌘S" : "Ctrl+S"} onClick={onSave} />
            <ToolbarButton label="Rename" icon="rename" shortcut="F2" onClick={onRename} />
          </>
        )}
        <RunButton
          isRunning={isRunning}
          shortcut={isRunning ? "" : macOS ? "⌘R" : "Ctrl+R"}
          onClick={isRunning ? onStop : onRun}
        />
      </nav>
  );
}
