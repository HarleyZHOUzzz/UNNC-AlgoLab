import type {
  FunctionDeclaration,
  Program,
  SourceLocation,
  Statement,
} from "./ast.ts";
import { InterpreterError } from "./errors.ts";
import { parseExpression } from "./expression.ts";

interface SourceLine {
  number: number;
  column: number;
  text: string;
}

interface AlgorithmHeader {
  name: string;
  parameters: string[];
  location: SourceLocation;
}

const PUNCTUATION_REPLACEMENTS: Record<string, string> = {
  "（": "(",
  "）": ")",
  "：": ":",
  "；": ";",
  "，": ",",
  "。": ".",
  "！": "!",
  "【": "[",
  "】": "]",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "←": "=",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
};

function normalizePunctuation(source: string): string {
  return Array.from(source, (character) => {
    return PUNCTUATION_REPLACEMENTS[character] ?? character;
  }).join("");
}

function removeComment(line: string): string {
  let quote = "";

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== "\\") {
      quote = quote === character ? "" : quote ? quote : character;
      continue;
    }
    if (!quote && character === "#") {
      return line.slice(0, index);
    }
    if (!quote && character === "/" && line[index + 1] === "/") {
      return line.slice(0, index);
    }
  }

  return line;
}

function prepareLines(source: string): SourceLine[] {
  return normalizePunctuation(source)
    .split(/\r?\n/)
    .map((rawLine, index) => {
      const withoutComment = removeComment(rawLine);
      const numberPrefix = withoutComment.match(
        /^\s*\d+\s*[:.,·]?\s*/,
      );
      const afterNumber = numberPrefix
        ? withoutComment.slice(numberPrefix[0].length)
        : withoutComment;
      const leadingWhitespace = afterNumber.match(/^\s*/)?.[0].length ?? 0;
      return {
        number: index + 1,
        column: (numberPrefix?.[0].length ?? 0) + leadingWhitespace + 1,
        text: afterNumber.trim().replace(/;$/, "").trim(),
      };
    })
    .filter((line) => line.text.length > 0);
}

function isMetadata(line: string): boolean {
  return /^(Require|Requires|Return|Returns)\s*:/i.test(line);
}

function parseHeader(line: SourceLine): AlgorithmHeader | null {
  const match = line.text.match(
    /^(Algorithm|Sub-Algorithm|SubAlgorithm)\s*:\s*([\p{L}_][\p{L}\p{N}_]*)\s*\((.*)\)\s*$/iu,
  );
  if (!match) {
    return null;
  }

  const parameters = match[3].trim()
    ? match[3].split(",").map((parameter) => parameter.trim())
    : [];
  for (const parameter of parameters) {
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(parameter)) {
      throw new InterpreterError(
        "syntax",
        `Invalid parameter name “${parameter}”.`,
        { line: line.number, column: line.column },
      );
    }
  }
  if (new Set(parameters).size !== parameters.length) {
    throw new InterpreterError(
      "syntax",
      "Function parameters must have unique names.",
      { line: line.number, column: line.column },
    );
  }

  return {
    name: match[2],
    parameters,
    location: { line: line.number, column: line.column },
  };
}

function controlKeyword(text: string): string | null {
  if (/^else\s+if\b/i.test(text)) {
    return "elseif";
  }
  if (/^end\s+if\b/i.test(text)) {
    return "endif";
  }
  if (/^end\s+while\b/i.test(text)) {
    return "endwhile";
  }
  const match = text.match(/^(elseif|else|endif|endwhile)\b/i);
  return match?.[1].toLowerCase() ?? null;
}

function expressionAfterKeyword(
  line: SourceLine,
  keywordPattern: RegExp,
  allowThen: boolean,
): string {
  let expression = line.text.replace(keywordPattern, "").trim();
  if (allowThen) {
    expression = expression.replace(/\s+(then|do)\s*$/i, "").trim();
  }
  if (!expression) {
    throw new InterpreterError(
      "syntax",
      "Expected a condition.",
      { line: line.number, column: line.column },
    );
  }
  return expression;
}

class ProgramParser {
  private index = 0;
  private readonly lines: SourceLine[];

  constructor(lines: SourceLine[]) {
    this.lines = lines;
  }

  parse(): Program {
    const functions: FunctionDeclaration[] = [];

    while (!this.atEnd()) {
      const line = this.current();
      const header = parseHeader(line);
      if (!header) {
        throw new InterpreterError(
          "syntax",
          "Expected an Algorithm header.",
          { line: line.number, column: line.column },
        );
      }
      this.index += 1;

      while (!this.atEnd() && isMetadata(this.current().text)) {
        this.index += 1;
      }

      const body = this.parseBlock(new Set(), true);
      functions.push({ ...header, body });
    }

    if (functions.length === 0) {
      throw new InterpreterError(
        "syntax",
        "The file must contain an Algorithm declaration.",
      );
    }
    const names = new Set<string>();
    for (const declaration of functions) {
      if (names.has(declaration.name)) {
        throw new InterpreterError(
          "syntax",
          `Algorithm “${declaration.name}” is declared more than once.`,
          declaration.location,
        );
      }
      names.add(declaration.name);
    }

    return { functions };
  }

  private parseBlock(stopWords: Set<string>, stopAtHeader = false): Statement[] {
    const statements: Statement[] = [];

    while (!this.atEnd()) {
      const line = this.current();
      if (stopAtHeader && parseHeader(line)) {
        break;
      }
      const control = controlKeyword(line.text);
      if (control && stopWords.has(control)) {
        break;
      }
      if (control) {
        throw new InterpreterError(
          "syntax",
          `Unexpected “${line.text}”.`,
          { line: line.number, column: line.column },
        );
      }

      statements.push(this.parseStatement());
    }

    return statements;
  }

  private parseStatement(): Statement {
    const line = this.current();
    const location = { line: line.number, column: line.column };

    if (/^if\b/i.test(line.text)) {
      return this.parseIf();
    }
    if (/^while\b/i.test(line.text)) {
      return this.parseWhile();
    }

    const returnMatch = line.text.match(/^return\b\s*(.*)$/i);
    if (returnMatch) {
      if (!returnMatch[1].trim()) {
        throw new InterpreterError(
          "syntax",
          "Return requires a value.",
          location,
        );
      }
      this.index += 1;
      return {
        kind: "return",
        expression: parseExpression(returnMatch[1], line.number, line.column + 7),
        location,
      };
    }

    const letMatch = line.text.match(
      /^let\s+([\p{L}_][\p{L}\p{N}_]*)\s*=\s*(.+)$/iu,
    );
    if (letMatch) {
      this.index += 1;
      return {
        kind: "let",
        name: letMatch[1],
        expression: parseExpression(letMatch[2], line.number, line.column),
        location,
      };
    }

    const assignmentMatch = line.text.match(
      /^([\p{L}_][\p{L}\p{N}_]*)\s*=\s*(?!=)(.+)$/u,
    );
    if (assignmentMatch) {
      this.index += 1;
      return {
        kind: "assign",
        name: assignmentMatch[1],
        expression: parseExpression(assignmentMatch[2], line.number, line.column),
        location,
      };
    }

    const printMatch = line.text.match(/^print\b\s*(.*)$/i);
    if (printMatch) {
      this.index += 1;
      return {
        kind: "print",
        expression: parseExpression(printMatch[1], line.number, line.column + 6),
        location,
      };
    }

    this.index += 1;
    return {
      kind: "expression",
      expression: parseExpression(line.text, line.number, line.column),
      location,
    };
  }

  private parseIf(): Statement {
    const start = this.current();
    const location = { line: start.number, column: start.column };
    const branches: Extract<Statement, { kind: "if" }>['branches'] = [];
    const firstConditionText = expressionAfterKeyword(start, /^if\b/i, true);
    this.index += 1;
    branches.push({
      condition: parseExpression(
        firstConditionText,
        start.number,
        start.column + 3,
      ),
      body: this.parseBlock(new Set(["elseif", "else", "endif"])),
      location,
    });

    while (!this.atEnd() && controlKeyword(this.current().text) === "elseif") {
      const branchLine = this.current();
      const conditionText = expressionAfterKeyword(
        branchLine,
        /^(elseif|else\s+if)\b/i,
        true,
      );
      this.index += 1;
      branches.push({
        condition: parseExpression(
          conditionText,
          branchLine.number,
          branchLine.column,
        ),
        body: this.parseBlock(new Set(["elseif", "else", "endif"])),
        location: { line: branchLine.number, column: branchLine.column },
      });
    }

    let elseBody: Statement[] | null = null;
    if (!this.atEnd() && controlKeyword(this.current().text) === "else") {
      this.index += 1;
      elseBody = this.parseBlock(new Set(["endif"]));
    }

    if (this.atEnd() || controlKeyword(this.current().text) !== "endif") {
      throw new InterpreterError(
        "syntax",
        "Expected “endif” to close this if statement.",
        location,
      );
    }
    this.index += 1;
    return { kind: "if", branches, elseBody, location };
  }

  private parseWhile(): Statement {
    const start = this.current();
    const location = { line: start.number, column: start.column };
    const conditionText = expressionAfterKeyword(start, /^while\b/i, true);
    this.index += 1;
    const body = this.parseBlock(new Set(["endwhile"]));

    if (this.atEnd() || controlKeyword(this.current().text) !== "endwhile") {
      throw new InterpreterError(
        "syntax",
        "Expected “endwhile” to close this while loop.",
        location,
      );
    }
    this.index += 1;
    return {
      kind: "while",
      condition: parseExpression(
        conditionText,
        start.number,
        start.column + 6,
      ),
      body,
      location,
    };
  }

  private current(): SourceLine {
    return this.lines[this.index];
  }

  private atEnd(): boolean {
    return this.index >= this.lines.length;
  }
}

export function parseProgram(source: string): Program {
  return new ProgramParser(prepareLines(source)).parse();
}

export function getEntryFunction(source: string): AlgorithmHeader {
  const program = parseProgram(source);
  const entry = program.functions[0];
  return {
    name: entry.name,
    parameters: entry.parameters,
    location: entry.location,
  };
}
