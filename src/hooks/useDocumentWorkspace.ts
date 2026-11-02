import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { basename, join } from "@tauri-apps/api/path";
import { NEW_ALGORITHM_TEMPLATE } from "../constants/editor";
import {
  confirmCloseAllEditors,
  confirmDiscardChanges,
  confirmSwitchFolder,
  createAlgoFile,
  createFolder,
  listAlgoFolder,
  readFile,
  renameDocumentFile,
  selectAndReadFiles,
  selectFolder,
  selectSavePath,
  writeDocument,
  type OpenedFolder,
} from "../services/fileService";
import {
  isDocumentDirty,
  reorderDocuments,
  type EditorDocument,
} from "../types/editor";

function createDocument(
  id: string,
  name: string,
  content = "",
  path: string | null = null,
  savedContent = content,
): EditorDocument {
  return { id, name, path, content, savedContent };
}

const EMPTY_DOCUMENT = createDocument("", "");

export function useDocumentWorkspace(autoSaveEnabled: boolean) {
  const [documents, setDocuments] = useState<EditorDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [status, setStatus] = useState("Ready");
  const [folder, setFolder] = useState<OpenedFolder | null>(null);
  const [pendingFolder, setPendingFolder] = useState<OpenedFolder | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const nextDocumentNumber = useRef(1);
  const autoSaveInFlight = useRef(new Set<string>());
  const openingPaths = useRef(new Set<string>());
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    void invoke<string | null>("take_startup_folder").then(async (path) => {
      if (!path) return;
      const selected = { name: await basename(path), path, entries: await listAlgoFolder(path) };
      setFolder(selected);
      setStatus(`Opened folder ${selected.name}`);
    }).catch((error) => setFolderError(`Open folder failed: ${String(error)}`));
  }, []);

  useEffect(() => {
    if (!autoSaveEnabled || !isTauri()) return;
    const timers = documents.filter((document) => document.path && isDocumentDirty(document) && !autoSaveInFlight.current.has(document.id)).map((document) =>
      window.setTimeout(async () => {
        if (!document.path || autoSaveInFlight.current.has(document.id)) return;
        autoSaveInFlight.current.add(document.id);
        try {
          await writeDocument(document.path, document.content);
          setDocuments((current) => current.map((item) => item.id === document.id && item.path === document.path
            ? { ...item, savedContent: document.content }
            : item));
          setAutoSaveError(null);
        } catch (error) {
          setAutoSaveError(`Auto save failed for ${document.name}: ${String(error)}`);
        } finally {
          autoSaveInFlight.current.delete(document.id);
        }
      }, 1000),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [autoSaveEnabled, documents]);

  const activeDocument = useMemo(
    () =>
      documents.find((document) => document.id === activeDocumentId) ??
      documents[0] ?? EMPTY_DOCUMENT,
    [activeDocumentId, documents],
  );

  const updateDocument = useCallback(
    (id: string, update: Partial<EditorDocument>) => {
      setDocuments((current) =>
        current.map((document) =>
          document.id === id ? { ...document, ...update } : document,
        ),
      );
    },
    [],
  );

  const newDocument = useCallback(() => {
    const number = nextDocumentNumber.current;
    nextDocumentNumber.current += 1;
    const document = createDocument(
      `untitled-${number}-${Date.now()}`,
      `untitled-${number}.algo`,
      NEW_ALGORITHM_TEMPLATE,
      null,
      "",
    );

    setDocuments((current) => [...current, document]);
    setActiveDocumentId(document.id);
    setStatus("New file");
  }, []);

  const openDocuments = useCallback(async () => {
    try {
      const openedFiles = await selectAndReadFiles();
      if (openedFiles.length === 0) {
        return;
      }

      const existingPaths = new Map(
        documents
          .filter((document) => document.path)
          .map((document) => [document.path, document.id]),
      );
      const newDocuments: EditorDocument[] = [];
      let lastDocumentId = activeDocumentId;

      for (const file of openedFiles) {
        const existingId = existingPaths.get(file.path);
        if (existingId) {
          lastDocumentId = existingId;
          continue;
        }

        const document = createDocument(
          `file-${Date.now()}-${newDocuments.length}`,
          file.name,
          file.content,
          file.path,
        );
        newDocuments.push(document);
        existingPaths.set(file.path, document.id);
        lastDocumentId = document.id;
      }

      if (newDocuments.length > 0) {
        setDocuments((current) => [...current, ...newDocuments]);
      }
      setActiveDocumentId(lastDocumentId);
      setStatus(
        openedFiles.length === 1
          ? `Opened ${openedFiles[0].name}`
          : `Opened ${openedFiles.length} files`,
      );
    } catch (error) {
      setStatus(`Open failed: ${String(error)}`);
    }
  }, [activeDocumentId, documents]);

  const openFolder = useCallback(async () => {
    try {
      const selected = await selectFolder();
      if (!selected) return;
      if (folder) setPendingFolder(selected);
      else {
        setFolder(selected);
        setFolderError(null);
        setStatus(`Opened folder ${selected.name}`);
      }
    } catch (error) {
      setFolderError(`Open folder failed: ${String(error)}`);
    }
  }, [folder]);

  const openPendingFolder = useCallback(async (newWindow: boolean) => {
    if (!pendingFolder) return;
    try {
      if (newWindow) await invoke("open_folder_window", { path: pendingFolder.path });
      else {
        if (pendingFolder.path !== folder?.path) {
          const unsavedFileCount = documents.filter(isDocumentDirty).length;
          if (unsavedFileCount > 0 && !(await confirmSwitchFolder(unsavedFileCount))) return;
          setDocuments([]);
          setActiveDocumentId("");
        }
        setFolder(pendingFolder);
        setStatus(`Opened folder ${pendingFolder.name}`);
      }
      setFolderError(null);
      setPendingFolder(null);
    } catch (error) {
      setFolderError(`Open folder failed: ${String(error)}`);
      setPendingFolder(null);
    }
  }, [pendingFolder, folder, documents]);

  const refreshFolder = useCallback(async () => {
    if (!folder) return;
    try {
      const entries = await listAlgoFolder(folder.path);
      setFolder((current) => current?.path === folder.path ? { ...current, entries } : current);
      setFolderError(null);
    } catch (error) {
      setFolderError(`Refresh failed: ${String(error)}`);
    }
  }, [folder]);

  const openFilePath = useCallback(async (path: string) => {
    const existing = documents.find((document) => document.path === path);
    if (existing) {
      setActiveDocumentId(existing.id);
      return existing.id;
    }
    if (openingPaths.current.has(path)) return;
    openingPaths.current.add(path);
    try {
      const file = await readFile(path);
      const document = createDocument(`file-${nextDocumentNumber.current++}-${Date.now()}`, file.name, file.content, file.path);
      setDocuments((current) => [...current, document]);
      setActiveDocumentId(document.id);
      setFolderError(null);
      setStatus(`Opened ${file.name}`);
      return document.id;
    } catch (error) {
      setFolderError(`Open file failed: ${String(error)}`);
    } finally {
      openingPaths.current.delete(path);
    }
  }, [documents]);

  const createWorkspaceFolder = useCallback(async (name: string): Promise<string | null> => {
    if (!folder) return "Open a folder first.";
    try {
      await createFolder(folder.path, name);
      await refreshFolder();
      return null;
    } catch (error) {
      return `Create folder failed: ${String(error)}`;
    }
  }, [folder, refreshFolder]);

  const createWorkspaceFile = useCallback(async (name: string): Promise<string | null> => {
    if (!folder) return "Open a folder first.";
    try {
      const path = await createAlgoFile(folder.path, name, NEW_ALGORITHM_TEMPLATE);
      await refreshFolder();
      await openFilePath(path);
      return null;
    } catch (error) {
      return `Create file failed: ${String(error)}`;
    }
  }, [folder, refreshFolder, openFilePath]);

  const saveDocumentAs = useCallback(
    async (documentId = activeDocumentId): Promise<boolean> => {
      const document = documents.find((item) => item.id === documentId);
      if (!document) {
        return false;
      }

      try {
        const defaultPath = document.path ?? (folder ? await join(folder.path, document.name) : document.name);
        const path = await selectSavePath(defaultPath);
        if (!path) {
          return false;
        }

        await writeDocument(path, document.content);
        const name = await basename(path);
        updateDocument(document.id, {
          name,
          path,
          savedContent: document.content,
        });
        setStatus(`Saved ${name}`);
        void refreshFolder();
        return true;
      } catch (error) {
        setStatus(`Save failed: ${String(error)}`);
        return false;
      }
    },
    [activeDocumentId, documents, folder, refreshFolder, updateDocument],
  );

  const saveDocument = useCallback(
    async (documentId = activeDocumentId): Promise<boolean> => {
      const document = documents.find((item) => item.id === documentId);
      if (!document) {
        return false;
      }

      if (!document.path) {
        return saveDocumentAs(document.id);
      }

      try {
        await writeDocument(document.path, document.content);
        updateDocument(document.id, { savedContent: document.content });
        setStatus(`Saved ${document.name}`);
        return true;
      } catch (error) {
        setStatus(`Save failed: ${String(error)}`);
        return false;
      }
    },
    [activeDocumentId, documents, saveDocumentAs, updateDocument],
  );

  const saveAllDocuments = useCallback(async () => {
    const dirtyDocuments = documents.filter(isDocumentDirty);
    if (dirtyDocuments.length === 0) {
      setStatus("All files are saved");
      return;
    }

    for (const document of dirtyDocuments) {
      if (!(await saveDocument(document.id))) {
        setStatus("Save all canceled");
        return;
      }
    }

    setStatus(
      dirtyDocuments.length === 1
        ? `Saved ${dirtyDocuments[0].name}`
        : `Saved ${dirtyDocuments.length} files`,
    );
  }, [documents, saveDocument]);

  const closeDocument = useCallback(
    async (documentId = activeDocumentId) => {
      const document = documents.find((item) => item.id === documentId);
      if (!document) {
        return;
      }

      if (
        isDocumentDirty(document) &&
        !(await confirmDiscardChanges(document.name))
      ) {
        return;
      }

      const documentIndex = documents.findIndex(
        (item) => item.id === documentId,
      );
      const remainingDocuments = documents.filter(
        (item) => item.id !== documentId,
      );

      if (remainingDocuments.length === 0) {
        setDocuments([]);
        setActiveDocumentId("");
      } else {
        setDocuments(remainingDocuments);
        if (activeDocumentId === documentId) {
          const nextIndex = Math.min(
            documentIndex,
            remainingDocuments.length - 1,
          );
          setActiveDocumentId(remainingDocuments[nextIndex].id);
        }
      }

      setStatus(`Closed ${document.name}`);
    },
    [activeDocumentId, documents],
  );

  const closeAllDocuments = useCallback(async () => {
    const unsavedFileCount = documents.filter(isDocumentDirty).length;
    if (
      unsavedFileCount > 0 &&
      !(await confirmCloseAllEditors(unsavedFileCount))
    ) {
      return;
    }

    setDocuments([]);
    setActiveDocumentId("");
    setStatus("Closed all editors");
  }, [documents]);

  const activateAdjacentDocument = useCallback(
    (direction: -1 | 1) => {
      if (documents.length < 2) {
        return;
      }

      const currentIndex = documents.findIndex(
        (document) => document.id === activeDocumentId,
      );
      const nextIndex =
        (currentIndex + direction + documents.length) % documents.length;
      setActiveDocumentId(documents[nextIndex].id);
      setStatus(`Active editor: ${documents[nextIndex].name}`);
    },
    [activeDocumentId, documents],
  );

  const renameDocument = useCallback(
    async (documentId: string, requestedName: string): Promise<string | null> => {
      const document = documents.find((item) => item.id === documentId);
      if (!document) {
        return "File is no longer open.";
      }

      let name = requestedName.trim();
      if (!name) {
        return "Enter a file name.";
      }
      if (/[\\/]/.test(name)) {
        return "Use a file name without folders.";
      }
      if (!name.includes(".")) {
        name += ".algo";
      }

      try {
        const path = document.path
          ? await renameDocumentFile(document.path, name)
          : null;
        updateDocument(document.id, { name, path });
        setStatus(`Renamed to ${name}`);
        void refreshFolder();
        return null;
      } catch (error) {
        return `Rename failed: ${String(error)}`;
      }
    },
    [documents, refreshFolder, updateDocument],
  );

  return {
    documents,
    activeDocument,
    activeDocumentId,
    status,
    autoSaveError,
    folder,
    pendingFolder,
    cancelOpenFolder: () => setPendingFolder(null),
    openPendingFolder,
    folderError,
    setActiveDocumentId,
    reorderDocument: (id: string, targetId: string, side: "before" | "after") =>
      setDocuments((current) => reorderDocuments(current, id, targetId, side)),
    setDocumentContent: (id: string, content: string) =>
      updateDocument(id, { content }),
    newDocument,
    openDocuments,
    openFolder,
    openFilePath,
    refreshFolder,
    createWorkspaceFolder,
    createWorkspaceFile,
    saveDocument,
    saveDocumentAs,
    saveAllDocuments,
    closeDocument,
    closeAllDocuments,
    activateAdjacentDocument,
    renameDocument,
  };
}
