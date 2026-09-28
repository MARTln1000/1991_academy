from collections import deque


def create_limiter(max_calls, window_ms):
    allowed = deque()

    def allow(t):
        while allowed and allowed[0] <= t - window_ms:
            allowed.popleft()
        if len(allowed) >= max_calls:
            return False
        allowed.append(t)
        return True
    return allow
