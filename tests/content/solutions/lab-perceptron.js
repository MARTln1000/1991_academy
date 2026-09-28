function trainPerceptron(data, epochs) {
  let w1 = 0, w2 = 0, b = 0;
  const lr = 0.1, history = [];
  for (let e = 0; e < epochs; e++) {
    for (const p of data) {
      const pred = w1 * p.x + w2 * p.y + b >= 0 ? 1 : 0;
      const err = p.label - pred;
      w1 += lr * err * p.x;
      w2 += lr * err * p.y;
      b += lr * err;
    }
    history.push({ w1, w2, b });
  }
  return history;
}
