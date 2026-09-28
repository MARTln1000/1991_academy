from collections import deque


def find_path(grid):
    R, C = len(grid), len(grid[0])
    if grid[0][0] == 1:
        return []
    parent = {(0, 0): None}
    queue = deque([(0, 0)])
    while queue:
        r, c = queue.popleft()
        if (r, c) == (R - 1, C - 1):
            path, cell = [], (r, c)
            while cell is not None:
                path.append(list(cell))
                cell = parent[cell]
            return path[::-1]
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == 0 and (nr, nc) not in parent:
                parent[(nr, nc)] = (r, c)
                queue.append((nr, nc))
    return []
