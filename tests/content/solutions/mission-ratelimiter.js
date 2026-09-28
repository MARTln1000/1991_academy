function createLimiter(maxCalls, windowMs) {
  const allowed = [];
  return function allow(t) {
    while (allowed.length && allowed[0] <= t - windowMs) allowed.shift();
    if (allowed.length >= maxCalls) return false;
    allowed.push(t);
    return true;
  };
}
