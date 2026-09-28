function trainXOR() {
  const X = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const Y = [0, 1, 1, 0];
  const W1 = [[0.5, -0.4], [0.3, 0.8], [-0.6, 0.2], [0.7, -0.3]];
  const b1 = [0.1, -0.2, 0.05, 0.15];
  const W2 = [0.4, -0.5, 0.6, 0.3];
  let b2 = 0.05;
  const lr = 0.5, epochs = 4000;
  const lossHistory = [];
  function forward(x1, x2) {
    const h = W1.map((w, j) => Math.tanh(w[0] * x1 + w[1] * x2 + b1[j]));
    const z = h.reduce((s, hj, j) => s + W2[j] * hj, b2);
    return { h, p: 1 / (1 + Math.exp(-z)) };
  }
  for (let e = 0; e < epochs; e++) {
    let loss = 0;
    for (let s = 0; s < 4; s++) {
      const [x1, x2] = X[s];
      const { h, p } = forward(x1, x2);
      loss += (p - Y[s]) ** 2;
      const dz = 2 * (p - Y[s]) * p * (1 - p);
      const dpre = h.map((hj, j) => dz * W2[j] * (1 - hj * hj));
      for (let j = 0; j < 4; j++) {
        W2[j] -= lr * dz * h[j];
        W1[j][0] -= lr * dpre[j] * x1;
        W1[j][1] -= lr * dpre[j] * x2;
        b1[j] -= lr * dpre[j];
      }
      b2 -= lr * dz;
    }
    lossHistory.push(loss / 4);
  }
  return { predict: (x1, x2) => forward(x1, x2).p, lossHistory };
}
