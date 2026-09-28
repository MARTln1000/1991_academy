function findPath(grid) {
  const R = grid.length, C = grid[0].length;
  if (grid[0][0] === 1) return [];
  const parent = new Map([["0,0", null]]);
  const queue = [[0, 0]];
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === R - 1 && c === C - 1) {
      const path = [];
      for (let k = r + "," + c; k !== null; k = parent.get(k)) path.push(k.split(",").map(Number));
      return path.reverse();
    }
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc, key = nr + "," + nc;
      if (nr < 0 || nc < 0 || nr >= R || nc >= C || grid[nr][nc] === 1 || parent.has(key)) continue;
      parent.set(key, r + "," + c);
      queue.push([nr, nc]);
    }
  }
  return [];
}
