import assert from "node:assert/strict";
import test from "node:test";
import { interpret } from "../src/interpreter/index.ts";

test("executes recursive factorial", () => {
  const source = `Algorithm: factorial(n)
Requires: an integer n
Returns: an integer
if n == 0 then
  return 1
else
  return n * factorial(n - 1)
endif`;

  const result = interpret(source, "factorial(5)");
  assert.equal(result.result, 120);
  assert.deepEqual(result.variables, [
    { name: "n", type: "number", value: "5" },
  ]);
});

test("accepts numbered lines and executes fibonacci", () => {
  const source = `Algorithm: F(n)
Requires: non-negative integer n
Returns: the n-th Fibonacci number
1. if n == 0 or n == 1 then
2. return n
3. else
4. return F(n - 1) + F(n - 2)
5. endif`;

  assert.equal(interpret(source, "output=F(10)").result, 55);
});

test("captures output from a print-only algorithm", () => {
  const source = `Algorithm: F(n)
Requires: non-negative integer n
Returns: the n-th Fibonacci number
print(n)`;

  const result = interpret(source, "F(10)");
  assert.equal(result.result, null);
  assert.deepEqual(result.output, ["10"]);
});

test("supports list helper functions", () => {
  const source = `Algorithm: sumlist(l)
Requires: a list l
Returns: an integer
if isEmpty(l) then
  return 0
else
  return value(l) + sumlist(tail(l))
endif`;

  assert.equal(interpret(source, "sumlist([1, 3, 5, 7])").result, 16);
});

test("supports tree helper functions", () => {
  const source = `Algorithm: height(t)
if isLeaf(t) then
  return 0
else
  return 1 + max(height(left(t)), height(right(t)))
endif`;

  const call = "height(node(node(leaf, 1, leaf), 2, leaf))";
  assert.equal(interpret(source, call).result, 2);
});

test("supports common pseudocode variants and Chinese punctuation", () => {
  const source = `Algorithm：countEven（n）
let i ← 0
let count ← 0
while i <> n do
  if i mod 2 == 0 then
    count ← count + 1
  end if
  i ← i + 1
end while
print count
return count`;

  const result = interpret(source, "countEven(6)");
  assert.equal(result.result, 3);
  assert.deepEqual(result.output, ["3"]);
  assert.deepEqual(result.variables, [
    { name: "n", type: "number", value: "6" },
    { name: "i", type: "number", value: "6" },
    { name: "count", type: "number", value: "3" },
  ]);
});

test("reports unclosed blocks with source lines", () => {
  assert.throws(
    () => interpret("Algorithm: broken(n)\nif n == 0 then\nreturn 0", "broken(0)"),
    (error) => {
      assert.equal(error.phase, "syntax");
      assert.equal(error.location.line, 2);
      return true;
    },
  );
});

test("stops infinite loops at the configured step limit", () => {
  const source = `Algorithm: forever()
while true then
  let x = 1
endwhile`;

  assert.throws(
    () => interpret(source, "forever()", { maxSteps: 30 }),
    /Execution stopped after 30 steps/,
  );
});
