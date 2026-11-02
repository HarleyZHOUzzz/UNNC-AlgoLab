import assert from "node:assert/strict";
import test from "node:test";
import { reorderDocuments, isDocumentDirty } from "../src/types/editor.ts";

const documents = ["a", "b", "c"].map((id) => ({ id, name: id + ".algo", path: null, content: "unsaved " + id, savedContent: "old" }));

test("tab reordering preserves document identities and unsaved contents", () => {
  const result = reorderDocuments(documents, "c", "a", "before");
  assert.deepEqual(result.map((doc) => doc.id), ["c", "a", "b"]);
  assert.strictEqual(result[0], documents[2]);
  assert.ok(result.every(isDocumentDirty));
  assert.deepEqual(documents.map((doc) => doc.id), ["a", "b", "c"]);
});

test("a tab can move right after the final tab", () => {
  assert.deepEqual(reorderDocuments(documents, "a", "c", "after").map((doc) => doc.id), ["b", "c", "a"]);
  assert.deepEqual(reorderDocuments(documents, "a", "b", "before").map((doc) => doc.id), ["a", "b", "c"]);
});

test("stale and self drop targets leave the documents intact", () => {
  assert.strictEqual(reorderDocuments(documents, "a", "a", "after"), documents);
  assert.strictEqual(reorderDocuments(documents, "missing", "a", "before"), documents);
  assert.strictEqual(reorderDocuments(documents, "a", "missing", "before"), documents);
});
