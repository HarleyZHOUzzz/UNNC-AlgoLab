import type { Expression, SourceLocation } from "./ast.ts";
import { InterpreterError } from "./errors.ts";

type TokenKind = "number" | "string" | "identifier" | "operator" | "punctuation" | "eof";

interface Token {
  kind: TokenKind;
  value: string;
  location: SourceLocation;
}

const BINARY_PRECEDENCE: Record<string, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "!=": 3,
  "<": 3,
  "<=": 3,
  ">": 3,
  ">=": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  mod: 5,
};

function isIdentifierStart(character: string): boolean {
  return /[\p{L}_]/u.test(character);
}

function isIdentifierPart(character: string): boolean {
  return /[\p{L}\p{N}_]/u.test(character);
}

class ExpressionLexer {
  private index = 0;
  private readonly source: string;
  private readonly line: number;
  private readonly startColumn: number;

  constructor(
    source: string,
    line: number,
    startColumn: number,
  ) {
    this.source = source;
    this.line = line;
    this.startColumn = startColumn;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    let token: Token;

    do {
      token = this.nextToken();
      tokens.push(token);
    } while (token.kind !== "eof");

    return tokens;
  }

  private nextToken(): Token {
    while (/\s/.test(this.peek())) {
      this.index += 1;
    }

    const location = this.location();
    const character = this.peek();
    if (!character) {
      return { kind: "eof", value: "", location };
    }

    if (/\d/.test(character)) {
      return this.readNumber();
    }
    if (character === '"' || character === "'") {
      return this.readString();
    }
    if (isIdentifierStart(character)) {
      return this.readIdentifier();
    }

    const pair = this.source.slice(this.index, this.index + 2);
    if (["==", "!=", "<>", "<=", ">=", "&&", "||"].includes(pair)) {
      this.index += 2;
      return {
        kind: "operator",
        value:
          pair === "&&"
            ? "and"
            : pair === "||"
              ? "or"
              : pair === "<>"
                ? "!="
                : pair,
        location,
      };
    }

    this.index += 1;
    if (["+", "-", "*", "/", "%", "<", ">"].includes(character)) {
      return {
        kind: "operator",
        value: character === "%" ? "mod" : character,
        location,
      };
    }
    if (["(", ")", "[", "]", ","].includes(character)) {
      return { kind: "punctuation", value: character, location };
    }

    throw new InterpreterError(
      "syntax",
      `Unexpected character “${character}”.`,
      location,
    );
  }

  private readNumber(): Token {
    const location = this.location();
    const start = this.index;
    while (/\d/.test(this.peek())) {
      this.index += 1;
    }
    if (this.peek() === "." && /\d/.test(this.peek(1))) {
      this.index += 1;
      while (/\d/.test(this.peek())) {
        this.index += 1;
      }
    }
    return {
      kind: "number",
      value: this.source.slice(start, this.index),
      location,
    };
  }

  private readString(): Token {
    const location = this.location();
    const quote = this.peek();
    this.index += 1;
    let value = "";

    while (this.peek() && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.index += 1;
        const escaped = this.peek();
        const escapes: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          "\\": "\\",
          '"': '"',
          "'": "'",
        };
        value += escapes[escaped] ?? escaped;
      } else {
        value += this.peek();
      }
      this.index += 1;
    }

    if (this.peek() !== quote) {
      throw new InterpreterError("syntax", "Unterminated string.", location);
    }
    this.index += 1;
    return { kind: "string", value, location };
  }

  private readIdentifier(): Token {
    const location = this.location();
    const start = this.index;
    this.index += 1;
    while (isIdentifierPart(this.peek())) {
      this.index += 1;
    }

    const value = this.source.slice(start, this.index);
    const normalized = value.toLowerCase();
    if (["and", "or", "not", "mod"].includes(normalized)) {
      return { kind: "operator", value: normalized, location };
    }
    return { kind: "identifier", value, location };
  }

  private peek(offset = 0): string {
    return this.source[this.index + offset] ?? "";
  }

  private location(): SourceLocation {
    return { line: this.line, column: this.startColumn + this.index };
  }
}

class ExpressionParser {
  private index = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Expression {
    const expression = this.parseBinary(1);
    const token = this.current();
    if (token.kind !== "eof") {
      throw new InterpreterError(
        "syntax",
        `Unexpected token “${token.value}”.`,
        token.location,
      );
    }
    return expression;
  }

  private parseBinary(minimumPrecedence: number): Expression {
    let left = this.parseUnary();

    while (true) {
      const token = this.current();
      const precedence =
        token.kind === "operator" ? BINARY_PRECEDENCE[token.value] : undefined;
      if (precedence === undefined || precedence < minimumPrecedence) {
        break;
      }

      this.index += 1;
      const right = this.parseBinary(precedence + 1);
      left = {
        kind: "binary",
        operator: token.value as Extract<Expression, { kind: "binary" }>['operator'],
        left,
        right,
        location: token.location,
      };
    }

    return left;
  }

  private parseUnary(): Expression {
    const token = this.current();
    if (
      token.kind === "operator" &&
      ["not", "+", "-"].includes(token.value)
    ) {
      this.index += 1;
      return {
        kind: "unary",
        operator: token.value as "not" | "+" | "-",
        operand: this.parseUnary(),
        location: token.location,
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expression = this.parsePrimary();

    while (this.match("(")) {
      if (expression.kind !== "variable") {
        throw new InterpreterError(
          "syntax",
          "Only named functions can be called.",
          expression.location,
        );
      }

      const args: Expression[] = [];
      if (!this.check(")")) {
        do {
          args.push(this.parseBinary(1));
        } while (this.match(","));
      }
      this.consume(")", "Expected “)” after function arguments.");
      expression = {
        kind: "call",
        callee: expression.name,
        arguments: args,
        location: expression.location,
      };
    }

    return expression;
  }

  private parsePrimary(): Expression {
    const token = this.current();
    this.index += 1;

    if (token.kind === "number") {
      return { kind: "literal", value: Number(token.value), location: token.location };
    }
    if (token.kind === "string") {
      return { kind: "literal", value: token.value, location: token.location };
    }
    if (token.kind === "identifier") {
      const normalized = token.value.toLowerCase();
      if (normalized === "true" || normalized === "false") {
        return {
          kind: "literal",
          value: normalized === "true",
          location: token.location,
        };
      }
      return {
        kind: "variable",
        name: token.value,
        location: token.location,
      };
    }
    if (token.value === "(") {
      const expression = this.parseBinary(1);
      this.consume(")", "Expected “)” after expression.");
      return expression;
    }
    if (token.value === "[") {
      const elements: Expression[] = [];
      if (!this.check("]")) {
        do {
          elements.push(this.parseBinary(1));
        } while (this.match(","));
      }
      this.consume("]", "Expected “]” after list elements.");
      return { kind: "list", elements, location: token.location };
    }

    throw new InterpreterError("syntax", "Expected an expression.", token.location);
  }

  private match(value: string): boolean {
    if (!this.check(value)) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private check(value: string): boolean {
    return this.current().value === value;
  }

  private consume(value: string, message: string): Token {
    const token = this.current();
    if (token.value !== value) {
      throw new InterpreterError("syntax", message, token.location);
    }
    this.index += 1;
    return token;
  }

  private current(): Token {
    return this.tokens[this.index];
  }
}

export function parseExpression(
  source: string,
  line = 1,
  column = 1,
): Expression {
  if (!source.trim()) {
    throw new InterpreterError(
      "syntax",
      "Expected an expression.",
      { line, column },
    );
  }
  const tokens = new ExpressionLexer(source, line, column).tokenize();
  return new ExpressionParser(tokens).parse();
}
