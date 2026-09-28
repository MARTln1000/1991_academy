function knnPredict(train, x, y, k) {
  const near = train
    .map((p) => ({ d: (p.x - x) ** 2 + (p.y - y) ** 2, label: p.label }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  const ones = near.reduce((s, p) => s + p.label, 0);
  return ones > k / 2 ? 1 : 0;
}
