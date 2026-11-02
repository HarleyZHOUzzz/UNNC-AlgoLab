export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditorDocument {
  id: string;
  name: string;
  path: string | null;
  content: string;
  savedContent: string;
}

export function isDocumentDirty(document: EditorDocument): boolean {
  return document.content !== document.savedContent;
}

export function reorderDocuments(documents: EditorDocument[], id: string, targetId: string, side: "before" | "after"): EditorDocument[] {
  const moving = documents.find((document) => document.id === id);
  if (!moving || id === targetId || !documents.some((document) => document.id === targetId)) return documents;
  const remaining = documents.filter((document) => document.id !== id);
  const at = remaining.findIndex((document) => document.id === targetId) + (side === "after" ? 1 : 0);
  remaining.splice(at, 0, moving);
  return remaining;
}
