import math


def train_xor():
    X = [[0, 0], [0, 1], [1, 0], [1, 1]]
    Y = [0, 1, 1, 0]
    W1 = [[0.5, -0.4], [0.3, 0.8], [-0.6, 0.2], [0.7, -0.3]]
    b1 = [0.1, -0.2, 0.05, 0.15]
    W2 = [0.4, -0.5, 0.6, 0.3]
    b2 = 0.05
    lr, epochs = 0.5, 4000
    loss_history = []

    def forward(x1, x2):
        h = [math.tanh(W1[j][0] * x1 + W1[j][1] * x2 + b1[j]) for j in range(4)]
        z = sum(W2[j] * h[j] for j in range(4)) + b2
        return h, 1 / (1 + math.exp(-z))

    for e in range(epochs):
        loss = 0.0
        for s in range(4):
            x1, x2 = X[s]
            h, p = forward(x1, x2)
            loss += (p - Y[s]) ** 2
            dz = 2 * (p - Y[s]) * p * (1 - p)
            for j in range(4):
                dpre = dz * W2[j] * (1 - h[j] ** 2)
                W2[j] -= lr * dz * h[j]
                W1[j][0] -= lr * dpre * x1
                W1[j][1] -= lr * dpre * x2
                b1[j] -= lr * dpre
            b2 -= lr * dz
        loss_history.append(loss / 4)

    def predict(x1, x2):
        return forward(x1, x2)[1]
    return {"predict": predict, "loss_history": loss_history}
