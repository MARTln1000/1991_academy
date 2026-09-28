def knn_predict(train, x, y, k):
    near = sorted(train, key=lambda p: (p["x"] - x) ** 2 + (p["y"] - y) ** 2)[:k]
    return 1 if sum(p["label"] for p in near) > k / 2 else 0
