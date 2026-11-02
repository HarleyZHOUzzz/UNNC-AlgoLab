import assert from "node:assert/strict";
import test from "node:test";
import { workspaceFiles, findAlgorithms, findText } from "../src/search/workspaceSearch.ts";
import { EditorState } from "@codemirror/state";

const doc = (path, content) => ({ id: "open", name: "main.algo", path, content, savedContent: "old" });
const file = (name, path) => ({ name, path, isDirectory: false, children: [] });

test("merges open documents with nested workspace files without duplicates", () => {
  const entries = [{ name: "src", path: "/work/src", isDirectory: true, children: [file("main.algo", "/work/src/main.algo"), file("other.ALGO", "/work/src/other.ALGO"), file("notes.txt", "/work/src/notes.txt")] }];
  const files = workspaceFiles([doc("/work/src/main.algo", "unsaved")], entries);
  assert.equal(files.length, 2);
  assert.equal(files[0].content, "unsaved");
  assert.equal(files[0].relativePath, "src/main.algo");
  assert.equal(files[1].relativePath, "src/other.ALGO");
});

test("finds algorithm headers despite unfinished bodies and retains navigation offsets", () => {
  const content = "1: Algorithm: Algorithm(n)\r\nif n > 0\r\nSub-Algorithm: Double(x)\r\nreturn";
  const files = workspaceFiles([doc(null, content)]);
  const matches = findAlgorithms(files, "");
  const editor = EditorState.create({ doc: content });
  assert.equal(matches.length, 2);
  assert.equal(content.slice(matches[0].from, matches[0].to), "Algorithm");
  assert.equal(matches[0].from, content.indexOf("Algorithm(n)"));
  assert.equal(matches[1].line, 3);
  assert.equal(editor.doc.sliceString(matches[1].from, matches[1].to), "Double");
  assert.equal(findAlgorithms(files, "dou")[0].label, "Double(x)");
});

test("text search treats special characters literally and uses exact CRLF offsets", () => {
  const content = "# first\r\nprint a+b + A+B\r\nreturn a";
  const matches = findText(workspaceFiles([doc(null, content)]), "a+b");
  const editor = EditorState.create({ doc: content });
  assert.equal(matches.length, 2);
  assert.equal(matches[0].line, 2);
  assert.equal(editor.doc.sliceString(matches[0].from, matches[0].to), "a+b");
  assert.equal(editor.doc.sliceString(matches[1].from, matches[1].to), "A+B");
});

test("search supports untitled documents and caps large result sets", () => {
  const files = workspaceFiles([doc(null, "x ".repeat(250))]);
  assert.equal(files[0].id, "open");
  assert.equal(findText(files, "x").length, 200);
  assert.deepEqual(findText(files, ""), []);
});
