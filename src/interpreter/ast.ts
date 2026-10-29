export interface SourceLocation {
  line: number;
  column: number;
}

export type LiteralValue = number | string | boolean | null;

export type Expression =
  | {
      kind: "literal";
      value: LiteralValue;
      location: SourceLocation;
    }
  | {
      kind: "variable";
      name: string;
      location: SourceLocation;
    }
  | {
      kind: "list";
      elements: Expression[];
      location: SourceLocation;
    }
  | {
      kind: "unary";
      operator: "not" | "+" | "-";
      operand: Expression;
      location: SourceLocation;
    }
  | {
      kind: "binary";
      operator:
        | "or"
        | "and"
        | "=="
        | "!="
        | "<"
        | "<="
        | ">"
        | ">="
        | "+"
        | "-"
        | "*"
        | "/"
        | "mod";
      left: Expression;
      right: Expression;
      location: SourceLocation;
    }
  | {
      kind: "call";
      callee: string;
      arguments: Expression[];
      location: SourceLocation;
    };

export type Statement =
  | {
      kind: "let" | "assign";
      name: string;
      expression: Expression;
      location: SourceLocation;
    }
  | {
      kind: "return";
      expression: Expression;
      location: SourceLocation;
    }
  | {
      kind: "expression" | "print";
      expression: Expression;
      location: SourceLocation;
    }
  | {
      kind: "if";
      branches: Array<{
        condition: Expression;
        body: Statement[];
        location: SourceLocation;
      }>;
      elseBody: Statement[] | null;
      location: SourceLocation;
    }
  | {
      kind: "while";
      condition: Expression;
      body: Statement[];
      location: SourceLocation;
    };

export interface FunctionDeclaration {
  name: string;
  parameters: string[];
  body: Statement[];
  location: SourceLocation;
}

export interface Program {
  functions: FunctionDeclaration[];
}
