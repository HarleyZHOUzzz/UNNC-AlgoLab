import type { FolderEntry } from "../services/fileService.ts";
import type { EditorDocument } from "../types/editor.ts";

export interface SearchFile {
  id?: string;
  path: string | null;
  name: string;
  relativePath: string;
  content?: string;
}

export interface SearchMatch {
  file: SearchFile;
  label: string;
  line: number;
  from: number;
  to: number;
}

export function workspaceFiles(documents: EditorDocument[], entries: FolderEntry[] = []): SearchFile[] {
  const files: SearchFile[] = documents.map((doc) => ({ id: doc.id, path: doc.path, name: doc.name, relativePath: doc.name, content: doc.content }));
  const byPath = new Map(files.filter((file) => file.path).map((file) => [file.path, file]));
  const visit = (nodes: FolderEntry[], prefix = "") => {
    for (const node of nodes) {
      const relativePath = prefix + node.name;
      if (node.isDirectory) visit(node.children, relativePath + "/");
      else if (node.name.toLowerCase().endsWith(".algo")) {
        const existing = byPath.get(node.path);
        if (existing) existing.relativePath = relativePath;
        else {
          const file = { path: node.path, name: node.name, relativePath };
          files.push(file);
          byPath.set(node.path, file);
        }
      }
    }
  };
  visit(entries);
  return files;
}

export function findAlgorithms(files: SearchFile[], term: string): SearchMatch[] {
  const results: SearchMatch[] = [];
  for (const file of files) {
    let offset = 0;
    for (const [index, line] of (file.content ?? "").replace(/\r\n?/g, "\n").split("\n").entries()) {
      const match = /^\s*(?:\d+\s*[:.,]?\s*)?(?:Algorithm|Sub-?Algorithm)\s*:\s*([\p{L}_][\p{L}\p{N}_]*)\s*\(([^)]*)\)/iu.exec(line);
      if (match && match[1].toLowerCase().includes(term.toLowerCase())) {
        const start = match[0].lastIndexOf(match[1], match[0].indexOf("("));
        results.push({ file, label: `${match[1]}(${match[2].trim()})`, line: index + 1, from: offset + start, to: offset + start + match[1].length });
      }
      offset += line.length + 1;
    }
  }
  return results;
}

export function findText(files: SearchFile[], term: string, limit = 200): SearchMatch[] {
  if (!term.trim()) return [];
  const results: SearchMatch[] = [];
  const needle = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  for (const file of files) {
    let offset = 0;
    for (const [index, line] of (file.content ?? "").replace(/\r\n?/g, "\n").split("\n").entries()) {
      needle.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = needle.exec(line))) {
        results.push({ file, label: line.trim(), line: index + 1, from: offset + match.index, to: offset + match.index + match[0].length });
        if (results.length >= limit) return results;
      }
      offset += line.length + 1;
    }
  }
  return results;
}
