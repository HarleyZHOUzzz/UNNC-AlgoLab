import type {
  Expression,
  FunctionDeclaration,
  Program,
  SourceLocation,
  Statement,
} from "./ast.ts";
import { InterpreterError } from "./errors.ts";

export interface TreeValue {
  kind: "tree";
  left: RuntimeValue;
  root: RuntimeValue;
  right: RuntimeValue;
  isLeaf: boolean;
}

export type RuntimeValue =
  | number
  | string
  | boolean
  | null
  | RuntimeValue[]
  | TreeValue;

export interface VariableSnapshot {
  name: string;
  type: string;
  value: string;
}

export interface ExecutionResult {
  result: RuntimeValue;
  formattedResult: string;
  output: string[];
  variables: VariableSnapshot[];
  steps: number;
  durationMs: number;
}

export interface RuntimeOptions {
  maxSteps?: number;
  maxCallDepth?: number;
}

const DEFAULT_MAX_STEPS = 100_000;
const DEFAULT_MAX_CALL_DEPTH = 200;
const LEAF: TreeValue = {
  kind: "tree",
  left: null,
  root: null,
  right: null,
  isLeaf: true,
};

class Environment {
  private readonly values = new Map<string, RuntimeValue>();

  define(name: string, value: RuntimeValue): void {
    this.values.set(name, value);
  }

  get(name: string, location: SourceLocation): RuntimeValue {
    if (!this.values.has(name)) {
      throw new InterpreterError(
        "runtime",
        `Variable “${name}” is not defined.`,
        location,
      );
    }
    return this.values.get(name) ?? null;
  }

  snapshot(): VariableSnapshot[] {
    return Array.from(this.values, ([name, value]) => ({
      name,
      type: valueType(value),
      value: formatValue(value),
    }));
  }
}

class ReturnSignal {
  readonly value: RuntimeValue;

  constructor(value: RuntimeValue) {
    this.value = value;
  }
}

function isTree(value: RuntimeValue): value is TreeValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    value.kind === "tree"
  );
}

function isTruthy(value: RuntimeValue): boolean {
  if (value === null || value === false || value === 0 || value === "") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function valuesEqual(left: RuntimeValue, right: RuntimeValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    );
  }
  return left === right;
}

function valueType(value: RuntimeValue): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "list";
  }
  if (isTree(value)) {
    return "tree";
  }
  return typeof value;
}

export function formatValue(value: RuntimeValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (isTree(value)) {
    return value.isLeaf
      ? "leaf"
      : `node(${formatValue(value.left)}, ${formatValue(value.root)}, ${formatValue(value.right)})`;
  }
  return String(value);
}

class Runtime {
  private readonly functions = new Map<string, FunctionDeclaration>();
  private readonly callStack: Environment[] = [];
  private readonly output: string[] = [];
  private topLevelVariables: VariableSnapshot[] = [];
  private steps = 0;
  private readonly maxSteps: number;
  private readonly maxCallDepth: number;

  constructor(
    program: Program,
    options: RuntimeOptions,
  ) {
    for (const declaration of program.functions) {
      this.functions.set(declaration.name, declaration);
    }
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    this.maxCallDepth = options.maxCallDepth ?? DEFAULT_MAX_CALL_DEPTH;
  }

  execute(call: Expression): ExecutionResult {
    if (call.kind !== "call") {
      throw new InterpreterError(
        "runtime",
        "The run configuration must be a function call, such as F(10).",
        call.location,
      );
    }

    const startTime = performance.now();
    const result = this.evaluate(call, new Environment());
    return {
      result,
      formattedResult: formatValue(result),
      output: this.output,
      variables: this.topLevelVariables,
      steps: this.steps,
      durationMs: performance.now() - startTime,
    };
  }

  private executeBlock(statements: Statement[], environment: Environment): void {
    for (const statement of statements) {
      this.executeStatement(statement, environment);
    }
  }

  private executeStatement(statement: Statement, environment: Environment): void {
    this.tick(statement.location);

    switch (statement.kind) {
      case "let":
      case "assign":
        environment.define(
          statement.name,
          this.evaluate(statement.expression, environment),
        );
        return;
      case "return":
        throw new ReturnSignal(this.evaluate(statement.expression, environment));
      case "expression":
        this.evaluate(statement.expression, environment);
        return;
      case "print":
        this.output.push(formatValue(this.evaluate(statement.expression, environment)));
        return;
      case "if":
        for (const branch of statement.branches) {
          if (isTruthy(this.evaluate(branch.condition, environment))) {
            this.executeBlock(branch.body, environment);
            return;
          }
        }
        if (statement.elseBody) {
          this.executeBlock(statement.elseBody, environment);
        }
        return;
      case "while":
        while (isTruthy(this.evaluate(statement.condition, environment))) {
          this.tick(statement.location);
          this.executeBlock(statement.body, environment);
        }
    }
  }

  private evaluate(expression: Expression, environment: Environment): RuntimeValue {
    this.tick(expression.location);

    switch (expression.kind) {
      case "literal":
        return expression.value;
      case "variable":
        return this.getVariable(expression.name, expression.location, environment);
      case "list":
        return expression.elements.map((element) =>
          this.evaluate(element, environment),
        );
      case "unary": {
        const operand = this.evaluate(expression.operand, environment);
        if (expression.operator === "not") {
          return !isTruthy(operand);
        }
        const number = this.requireNumber(operand, expression.location);
        return expression.operator === "-" ? -number : number;
      }
      case "binary":
        return this.evaluateBinary(expression, environment);
      case "call": {
        const args = expression.arguments.map((argument) =>
          this.evaluate(argument, environment),
        );
        return this.callFunction(expression.callee, args, expression.location);
      }
    }
  }

  private evaluateBinary(
    expression: Extract<Expression, { kind: "binary" }>,
    environment: Environment,
  ): RuntimeValue {
    const left = this.evaluate(expression.left, environment);
    if (expression.operator === "and" && !isTruthy(left)) {
      return false;
    }
    if (expression.operator === "or" && isTruthy(left)) {
      return true;
    }

    const right = this.evaluate(expression.right, environment);
    switch (expression.operator) {
      case "and":
        return isTruthy(right);
      case "or":
        return isTruthy(right);
      case "==":
        return valuesEqual(left, right);
      case "!=":
        return !valuesEqual(left, right);
      case "+":
        if (typeof left === "number" && typeof right === "number") {
          return left + right;
        }
        if (typeof left === "string" && typeof right === "string") {
          return left + right;
        }
        if (Array.isArray(left) && Array.isArray(right)) {
          return [...left, ...right];
        }
        throw new InterpreterError(
          "runtime",
          "Operator “+” requires two numbers, strings, or lists.",
          expression.location,
        );
      case "-":
        return (
          this.requireNumber(left, expression.location) -
          this.requireNumber(right, expression.location)
        );
      case "*":
        return (
          this.requireNumber(left, expression.location) *
          this.requireNumber(right, expression.location)
        );
      case "/": {
        const divisor = this.requireNumber(right, expression.location);
        if (divisor === 0) {
          throw new InterpreterError(
            "runtime",
            "Division by zero.",
            expression.location,
          );
        }
        return this.requireNumber(left, expression.location) / divisor;
      }
      case "mod": {
        const divisor = this.requireNumber(right, expression.location);
        if (divisor === 0) {
          throw new InterpreterError(
            "runtime",
            "Modulo by zero.",
            expression.location,
          );
        }
        return this.requireNumber(left, expression.location) % divisor;
      }
      case "<":
      case "<=":
      case ">":
      case ">=":
        return this.compare(left, right, expression.operator, expression.location);
    }
  }

  private compare(
    left: RuntimeValue,
    right: RuntimeValue,
    operator: "<" | "<=" | ">" | ">=",
    location: SourceLocation,
  ): boolean {
    if (
      !(
        (typeof left === "number" && typeof right === "number") ||
        (typeof left === "string" && typeof right === "string")
      )
    ) {
      throw new InterpreterError(
        "runtime",
        "Comparison requires two numbers or two strings.",
        location,
      );
    }
    if (operator === "<") return left < right;
    if (operator === "<=") return left <= right;
    if (operator === ">") return left > right;
    return left >= right;
  }

  private getVariable(
    name: string,
    location: SourceLocation,
    environment: Environment,
  ): RuntimeValue {
    const normalized = name.toLowerCase();
    if (normalized === "nil") {
      return [];
    }
    if (normalized === "leaf") {
      return LEAF;
    }
    return environment.get(name, location);
  }

  private callFunction(
    name: string,
    args: RuntimeValue[],
    location: SourceLocation,
  ): RuntimeValue {
    const builtin = this.callBuiltin(name, args, location);
    if (builtin.handled) {
      return builtin.value;
    }

    const declaration = this.functions.get(name);
    if (!declaration) {
      throw new InterpreterError(
        "runtime",
        `Algorithm “${name}” is not defined.`,
        location,
      );
    }
    if (args.length !== declaration.parameters.length) {
      throw new InterpreterError(
        "runtime",
        `Algorithm “${name}” expects ${declaration.parameters.length} argument(s), but received ${args.length}.`,
        location,
      );
    }
    if (this.callStack.length >= this.maxCallDepth) {
      throw new InterpreterError(
        "runtime",
        `Maximum call depth of ${this.maxCallDepth} exceeded.`,
        location,
      );
    }

    const environment = new Environment();
    declaration.parameters.forEach((parameter, index) => {
      environment.define(parameter, args[index]);
    });
    this.callStack.push(environment);
    let result: RuntimeValue = null;

    try {
      this.executeBlock(declaration.body, environment);
    } catch (error) {
      if (error instanceof ReturnSignal) {
        result = error.value;
      } else {
        throw error;
      }
    } finally {
      if (this.callStack.length === 1) {
        this.topLevelVariables = environment.snapshot();
      }
      this.callStack.pop();
    }

    return result;
  }

  private callBuiltin(
    name: string,
    args: RuntimeValue[],
    location: SourceLocation,
  ): { handled: false } | { handled: true; value: RuntimeValue } {
    const normalized = name.toLowerCase();
    const requireArgs = (count: number) => {
      if (args.length !== count) {
        throw new InterpreterError(
          "runtime",
          `${name} expects ${count} argument(s), but received ${args.length}.`,
          location,
        );
      }
    };
    const requireList = (value: RuntimeValue): RuntimeValue[] => {
      if (!Array.isArray(value)) {
        throw new InterpreterError(
          "runtime",
          `${name} requires a list.`,
          location,
        );
      }
      return value;
    };
    const requireTree = (value: RuntimeValue): TreeValue => {
      if (!isTree(value)) {
        throw new InterpreterError(
          "runtime",
          `${name} requires a tree.`,
          location,
        );
      }
      return value;
    };

    switch (normalized) {
      case "value": {
        requireArgs(1);
        return { handled: true, value: requireList(args[0])[0] ?? null };
      }
      case "tail":
        requireArgs(1);
        return { handled: true, value: requireList(args[0]).slice(1) };
      case "cons":
        requireArgs(2);
        return { handled: true, value: [args[0], ...requireList(args[1])] };
      case "isempty":
        requireArgs(1);
        return { handled: true, value: requireList(args[0]).length === 0 };
      case "length":
        requireArgs(1);
        if (!Array.isArray(args[0]) && typeof args[0] !== "string") {
          throw new InterpreterError(
            "runtime",
            "length requires a list or string.",
            location,
          );
        }
        return { handled: true, value: args[0].length };
      case "node":
        requireArgs(3);
        return {
          handled: true,
          value: {
            kind: "tree",
            left: args[0],
            root: args[1],
            right: args[2],
            isLeaf: false,
          },
        };
      case "left":
        requireArgs(1);
        return { handled: true, value: requireTree(args[0]).left };
      case "right":
        requireArgs(1);
        return { handled: true, value: requireTree(args[0]).right };
      case "root":
        requireArgs(1);
        return { handled: true, value: requireTree(args[0]).root };
      case "isleaf":
        requireArgs(1);
        return { handled: true, value: requireTree(args[0]).isLeaf };
      case "abs":
        requireArgs(1);
        return {
          handled: true,
          value: Math.abs(this.requireNumber(args[0], location)),
        };
      case "min":
      case "max": {
        if (args.length === 0) {
          throw new InterpreterError(
            "runtime",
            `${name} requires at least one argument.`,
            location,
          );
        }
        const numbers = args.map((value) => this.requireNumber(value, location));
        return {
          handled: true,
          value: normalized === "min" ? Math.min(...numbers) : Math.max(...numbers),
        };
      }
      default:
        return { handled: false };
    }
  }

  private requireNumber(value: RuntimeValue, location: SourceLocation): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new InterpreterError("runtime", "Expected a number.", location);
    }
    return value;
  }

  private tick(location: SourceLocation): void {
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      throw new InterpreterError(
        "runtime",
        `Execution stopped after ${this.maxSteps} steps. Check for an infinite loop or excessive recursion.`,
        location,
      );
    }
  }
}

export function executeProgram(
  program: Program,
  call: Expression,
  options: RuntimeOptions = {},
): ExecutionResult {
  return new Runtime(program, options).execute(call);
}
