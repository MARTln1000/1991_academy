function shortestPath(grid) {
  const R = grid.length, C = grid[0].length;
  if (grid[0][0] === 1) return -1;
  const seen = grid.map((row) => row.map(() => false));
  seen[0][0] = true;
  const queue = [[0, 0, 0]];
  for (let head = 0; head < queue.length; head++) {
    const [r, c, d] = queue[head];
    if (r === R - 1 && c === C - 1) return d;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= R || nc >= C || grid[nr][nc] === 1 || seen[nr][nc]) continue;
      seen[nr][nc] = true;
      queue.push([nr, nc, d + 1]);
    }
  }
  return -1;
}
