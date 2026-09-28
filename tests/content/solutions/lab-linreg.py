def fit_line(points):
    w, b = 0.0, 0.0
    lr, steps = 0.05, 200
    history = []
    for s in range(steps):
        dw = sum(2 * (w * x + b - y) * x for x, y in points) / len(points)
        db = sum(2 * (w * x + b - y) for x, y in points) / len(points)
        w -= lr * dw
        b -= lr * db
        if s % 10 == 0:
            history.append({"w": w, "b": b})
    history.append({"w": w, "b": b})
    return history
