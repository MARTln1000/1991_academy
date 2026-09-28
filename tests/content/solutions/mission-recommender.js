function recommend(userVec, items, k) {
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a));
  return items
    .map((it) => ({ name: it.name, score: dot(userVec, it.vec) / (norm(userVec) * norm(it.vec)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.name);
}
