from collections import deque


def shortest_path(grid):
    R, C = len(grid), len(grid[0])
    if grid[0][0] == 1:
        return -1
    seen = {(0, 0)}
    queue = deque([(0, 0, 0)])
    while queue:
        r, c, d = queue.popleft()
        if (r, c) == (R - 1, C - 1):
            return d
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == 0 and (nr, nc) not in seen:
                seen.add((nr, nc))
                queue.append((nr, nc, d + 1))
    return -1
