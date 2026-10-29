export const DEFAULT_ALGORITHM = `Algorithm: F(n)
Requires: non-negative integer n
Returns: the n-th Fibonacci number
if n == 0 or n == 1 then
  return n
else
  return F(n - 1) + F(n - 2)
endif`;
