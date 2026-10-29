import {
  StreamLanguage,
  indentOnInput,
  type StreamParser,
} from "@codemirror/language";
import { lintGutter, linter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
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

const NUMBER_PREFIX = /\d+\s*[:.,·]?\s*/;
const CLOSING_KEYWORD = /(?:endif|end\s+if|endwhile|end\s+while)\b/i;
const BRANCH_KEYWORD = /(?:elseif|else(?:\s+if)?)\b/i;

function contentWithoutLineNumber(text: string): string {
  return text.replace(/^\s*\d+\s*[:.,·]?\s*/, "").trimStart();
}

const pseudocodeParser: StreamParser<PseudocodeState> = {
  startState: () => ({ depth: 0, lineStart: true }),
  copyState: (state) => ({ ...state }),
  blankLine: (state) => {
    state.lineStart = true;
  },
  indent: (state, textAfter, context) => {
    const content = contentWithoutLineNumber(textAfter);
    if (/^(?:Algorithm|Sub-?Algorithm)\b/i.test(content)) {
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
      /^\s*(?:\d+\s*[:.,·]?\s*)?(?:else(?:\s+if)?|elseif|endif|end\s+if|endwhile|end\s+while)\b/i,
  },
  token: (stream, state) => {
    if (stream.sol()) {
      state.lineStart = true;
    }
    if (stream.eatSpace()) {
      return null;
    }
    if (stream.match("#") || stream.match("//")) {
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
    if (isLineStart && stream.match(/(?:Algorithm|Sub-?Algorithm)\b/i)) {
      state.depth = 0;
      return "keyword";
    }
    if (isLineStart && stream.match(CLOSING_KEYWORD)) {
      state.depth = Math.max(0, state.depth - 1);
      return "keyword";
    }
    if (isLineStart && stream.match(BRANCH_KEYWORD)) {
      return "keyword";
    }
    if (isLineStart && stream.match(/(?:if|while)\b/i)) {
      state.depth += 1;
      return "keyword";
    }
    if (
      stream.match(
        /(?:Requires?|Returns?)\b|(?:then|do|let|return|print|and|or|not|mod)\b/i,
      )
    ) {
      return "keyword";
    }
    if (stream.match(/(?:true|false)\b/i)) {
      return "bool";
    }
    if (stream.match(/[\p{L}_][\p{L}\p{N}_]*/u)) {
      return "variableName";
    }
    if (stream.match(/(?:==|!=|<>|<=|>=|&&|\|\||←|[≤≥≠+\-*/%=<>])/)) {
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
  indentOnInput(),
  lintGutter(),
  pseudocodeLinter,
];
