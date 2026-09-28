function kmeans(points, k, iters) {
  let centroids = points.slice(0, k).map((p) => p.slice());
  const history = [];
  for (let it = 0; it < iters; it++) {
    const labels = points.map((p) => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    });
    centroids = centroids.map((c, i) => {
      const mine = points.filter((_, j) => labels[j] === i);
      if (!mine.length) return c.slice();
      return [mine.reduce((s, p) => s + p[0], 0) / mine.length, mine.reduce((s, p) => s + p[1], 0) / mine.length];
    });
    history.push({ centroids: centroids.map((c) => c.slice()), labels: labels.slice() });
  }
  return history;
}
