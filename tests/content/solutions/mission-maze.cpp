int shortestPath(const vector<vector<int>>& grid) {
    int R = grid.size(), C = grid[0].size();
    if (grid[0][0] == 1) return -1;
    vector<vector<bool>> seen(R, vector<bool>(C, false));
    queue<array<int, 3>> q;
    q.push({0, 0, 0});
    seen[0][0] = true;
    int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
    while (!q.empty()) {
        auto [r, c, d] = q.front();
        q.pop();
        if (r == R - 1 && c == C - 1) return d;
        for (int i = 0; i < 4; i++) {
            int nr = r + dr[i], nc = c + dc[i];
            if (nr < 0 || nc < 0 || nr >= R || nc >= C || grid[nr][nc] == 1 || seen[nr][nc]) continue;
            seen[nr][nc] = true;
            q.push({nr, nc, d + 1});
        }
    }
    return -1;
}
