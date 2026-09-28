class RateLimiter {
    int maxCalls, windowMs;
    deque<long long> allowed;
public:
    RateLimiter(int maxCalls, int windowMs) : maxCalls(maxCalls), windowMs(windowMs) {}
    bool allow(long long t) {
        while (!allowed.empty() && allowed.front() <= t - windowMs) allowed.pop_front();
        if ((int)allowed.size() >= maxCalls) return false;
        allowed.push_back(t);
        return true;
    }
};
