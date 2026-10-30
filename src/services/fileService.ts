import { invoke } from "@tauri-apps/api/core";
import { basename, dirname, join } from "@tauri-apps/api/path";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";

const ALGORITHM_FILTER = {
  name: "Algorithm files",
  extensions: ["algo", "txt"],
};

export interface OpenedFile {
  name: string;
  path: string;
  content: string;
}

export interface FolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FolderEntry[];
}

export interface OpenedFolder {
  name: string;
  path: string;
  entries: FolderEntry[];
}

export async function readFile(path: string): Promise<OpenedFile> {
  return {
    name: await basename(path),
    path,
    content: await invoke<string>("read_text_file", { path }),
  };
}

export async function selectFolder(): Promise<OpenedFolder | null> {
  const path = await open({ directory: true, multiple: false });
  if (!path) return null;
  return { name: await basename(path), path, entries: await listAlgoFolder(path) };
}

export async function listAlgoFolder(path: string): Promise<FolderEntry[]> {
  return invoke<FolderEntry[]>("list_algo_folder", { path });
}

export async function createFolder(parent: string, name: string): Promise<void> {
  await invoke("create_folder", { parent, name });
}

export async function selectAndReadFiles(): Promise<OpenedFile[]> {
  const selection = await open({
    multiple: true,
    directory: false,
    filters: [ALGORITHM_FILTER],
  });

  if (!selection) {
    return [];
  }

  const paths = Array.isArray(selection) ? selection : [selection];
  return Promise.all(
    paths.map(readFile),
  );
}

export async function selectSavePath(defaultName: string): Promise<string | null> {
  return save({
    defaultPath: defaultName,
    filters: [ALGORITHM_FILTER],
  });
}

export async function writeDocument(path: string, content: string): Promise<void> {
  await invoke("write_text_file", { path, content });
}

export async function renameDocumentFile(
  currentPath: string,
  newName: string,
): Promise<string> {
  const newPath = await join(await dirname(currentPath), newName);

  if (newPath !== currentPath) {
    await invoke("rename_text_file", {
      currentPath,
      newPath,
    });
  }

  return newPath;
}

export async function confirmDiscardChanges(name: string): Promise<boolean> {
  return confirm(`Discard unsaved changes to “${name}”?`, {
    title: "UNNC AlgoLab",
    kind: "warning",
    okLabel: "Discard",
    cancelLabel: "Cancel",
  });
}

export async function confirmDiscardWorkspace(
  unsavedFileCount: number,
): Promise<boolean> {
  const description =
    unsavedFileCount === 1
      ? "There is 1 file with unsaved changes. Quit and discard it?"
      : `There are ${unsavedFileCount} files with unsaved changes. Quit and discard them?`;

  return confirm(description, {
    title: "UNNC AlgoLab",
    kind: "warning",
    okLabel: "Quit Without Saving",
    cancelLabel: "Cancel",
  });
}

export async function confirmCloseAllEditors(
  unsavedFileCount: number,
): Promise<boolean> {
  const description =
    unsavedFileCount === 1
      ? "There is 1 file with unsaved changes. Close all editors and discard it?"
      : `There are ${unsavedFileCount} files with unsaved changes. Close all editors and discard them?`;

  return confirm(description, {
    title: "UNNC AlgoLab",
    kind: "warning",
    okLabel: "Close Without Saving",
    cancelLabel: "Cancel",
  });
}
