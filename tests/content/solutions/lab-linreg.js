function fitLine(points) {
  let w = 0, b = 0;
  const lr = 0.05, steps = 200, history = [];
  for (let s = 0; s < steps; s++) {
    let dw = 0, db = 0;
    for (const [x, y] of points) {
      const err = w * x + b - y;
      dw += 2 * err * x;
      db += 2 * err;
    }
    w -= lr * dw / points.length;
    b -= lr * db / points.length;
    if (s % 10 === 0) history.push({ w, b });
  }
  history.push({ w, b });
  return history;
}
