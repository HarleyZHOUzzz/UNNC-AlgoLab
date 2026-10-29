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
