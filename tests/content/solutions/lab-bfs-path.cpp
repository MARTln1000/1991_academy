vector<vector<int>> findPath(vector<vector<int>> grid) {
    int R = grid.size(), C = grid[0].size();
    if (grid[0][0] == 1) return {};
    vector<vector<pair<int, int>>> parent(R, vector<pair<int, int>>(C, {-1, -1}));
    parent[0][0] = {0, 0};
    queue<pair<int, int>> q;
    q.push({0, 0});
    int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        if (r == R - 1 && c == C - 1) {
            vector<vector<int>> path;
            while (true) {
                path.push_back({r, c});
                if (r == 0 && c == 0) break;
                tie(r, c) = parent[r][c];
            }
            reverse(path.begin(), path.end());
            return path;
        }
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nc < 0 || nr >= R || nc >= C || grid[nr][nc] == 1 || parent[nr][nc].first != -1) continue;
            parent[nr][nc] = {r, c};
            q.push({nr, nc});
        }
    }
    return {};
}
