import {
  StreamLanguage,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
  type StreamParser,
} from "@codemirror/language";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { toDiagnostic } from "../interpreter/errors.ts";
import { parseProgram } from "../interpreter/parser.ts";

interface PseudocodeState {
  depth: number;
  lineStart: boolean;
}

interface LocatedDiagnostic {
  diagnostic: Diagnostic;
  lineNumber: number;
  columnNumber: number;
}

const NUMBER_PREFIX = /\d+\s*[:.,]?\s*/;
const CLOSING_KEYWORD = /(?:endif|end\s+if|endwhile|end\s+while)\b/i;
const BRANCH_KEYWORD = /(?:elseif|else(?:\s+if)?)\b/i;

function contentWithoutLineNumber(text: string): string {
  return text.replace(/^\s*\d+\s*[:.,]?\s*/, "").trimStart();
}

const pseudocodeParser: StreamParser<PseudocodeState> = {
  startState: () => ({ depth: 0, lineStart: true }),
  copyState: (state) => ({ ...state }),
  blankLine: (state) => {
    state.lineStart = true;
  },
  indent: (state, textAfter, context) => {
    const content = contentWithoutLineNumber(textAfter);
    if (/^(?:Algorithm|Sub(?:-|\s+)?Algorithm)\b/i.test(content)) {
      return 0;
    }
    if (CLOSING_KEYWORD.test(content) || BRANCH_KEYWORD.test(content)) {
      return Math.max(0, state.depth - 1) * context.unit;
    }
    return state.depth * context.unit;
  },
  languageData: {
    commentTokens: { line: "#" },
    indentOnInput:
      /^\s*(?:\d+\s*[:.,]?\s*)?(?:else(?:\s+if)?|elseif|endif|end\s+if|endwhile|end\s+while)\b/i,
  },
  token: (stream, state) => {
    if (stream.sol()) {
      state.lineStart = true;
    }
    if (stream.eatSpace()) {
      return null;
    }
    if (stream.match("#")) {
      stream.skipToEnd();
      return "comment";
    }
    if (state.lineStart && stream.match(NUMBER_PREFIX)) {
      return "meta";
    }

    const isLineStart = state.lineStart;
    state.lineStart = false;

    if (stream.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/)) {
      return "string";
    }
    if (stream.match(/\d+(?:\.\d+)?/)) {
      return "number";
    }
    if (isLineStart && stream.match(/(?:Algorithm|Sub(?:-|\s+)?Algorithm)\b/i)) {
      state.depth = 0;
      return "keyword";
    }
    if (isLineStart && stream.match(CLOSING_KEYWORD)) {
      state.depth = Math.max(0, state.depth - 1);
      return "controlKeyword";
    }
    if (isLineStart && stream.match(BRANCH_KEYWORD)) {
      return "controlKeyword";
    }
    if (isLineStart && stream.match(/(?:if|while)\b/i)) {
      state.depth += 1;
      return "controlKeyword";
    }
    if (isLineStart && stream.match(/(?:Requires?|Returns?)\b(?=\s*:)/i)) {
      return "keyword";
    }
    if (stream.match(/(?:then|do|return|and|or|not|mod)\b/i)) {
      return "controlKeyword";
    }
    if (
      stream.match(
        /(?:Requires?|Returns?)\b|(?:let|print)\b/i,
      )
    ) {
      return "keyword";
    }
    if (stream.match(/(?:true|false|nil|leaf)\b/i)) {
      return "bool";
    }
    if (stream.match(/[\p{L}_][\p{L}\p{N}_]*(?=\s*\()/u)) {
      return "variableName.function";
    }
    if (stream.match(/[\p{L}_][\p{L}\p{N}_]*/u)) {
      return "variableName";
    }
    if (stream.match(/(?:==|!=|<>|<=|>=|&&|\|\||\/\/|←|[≤≥≠+\-*/%=<>])/)) {
      return "operator";
    }
    if (stream.match(/[()[\],:]/)) {
      return "punctuation";
    }

    stream.next();
    return "invalid";
  },
};

const pseudocodeLanguage = StreamLanguage.define(pseudocodeParser);

const pseudocodeHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#569cd6" },
  { tag: tags.controlKeyword, color: "#c586c0" },
  { tag: tags.function(tags.variableName), color: "#dcdcaa" },
  { tag: tags.variableName, color: "#9cdcfe" },
  { tag: tags.number, color: "#b5cea8" },
  { tag: tags.bool, color: "#569cd6" },
  { tag: tags.string, color: "#d7ba7d" },
  { tag: tags.comment, color: "#6a9955" },
  { tag: tags.operator, color: "#d4d4d4" },
  { tag: tags.punctuation, color: "#cccccc" },
  { tag: tags.meta, color: "#858585" },
  { tag: tags.invalid, color: "#d4d4d4" },
]);

function syntaxDiagnostics(
  source: string,
  lineCount: number,
): LocatedDiagnostic[] {
  if (!source.trim()) {
    return [];
  }

  try {
    parseProgram(source);
    return [];
  } catch (error) {
    const diagnostic = toDiagnostic(error);
    const lineNumber = Math.min(Math.max(diagnostic.line, 1), lineCount);
    return [
      {
        diagnostic: {
          from: 0,
          to: 0,
          severity: "error",
          source: "UNNC AlgoLab",
          message: diagnostic.message,
        },
        lineNumber,
        columnNumber: Math.max(diagnostic.column, 1),
      },
    ];
  }
}

const pseudocodeLinter = linter(
  (view) => {
    const diagnostics = syntaxDiagnostics(
      view.state.doc.toString(),
      view.state.doc.lines,
    );
    return diagnostics.map(({ diagnostic, lineNumber, columnNumber }) => {
      const line = view.state.doc.line(lineNumber);
      const from = Math.min(
        line.to,
        line.from + Math.max(0, columnNumber - 1),
      );
      return {
        ...diagnostic,
        from,
        to: Math.min(line.to, from + 1),
      };
    });
  },
  { delay: 350 },
);

export const pseudocodeExtensions: Extension[] = [
  pseudocodeLanguage,
  syntaxHighlighting(pseudocodeHighlight),
  indentOnInput(),
  pseudocodeLinter,
];
