def train_perceptron(data, epochs):
    w1, w2, b = 0.0, 0.0, 0.0
    lr = 0.1
    history = []
    for e in range(epochs):
        for p in data:
            pred = 1 if w1 * p["x"] + w2 * p["y"] + b >= 0 else 0
            err = p["label"] - pred
            w1 += lr * err * p["x"]
            w2 += lr * err * p["y"]
            b += lr * err
        history.append({"w1": w1, "w2": w2, "b": b})
    return history
