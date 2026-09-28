def kmeans(points, k, iters):
    centroids = [list(p) for p in points[:k]]
    history = []
    for it in range(iters):
        labels = [min(range(k), key=lambda i: (p[0] - centroids[i][0]) ** 2 + (p[1] - centroids[i][1]) ** 2)
                  for p in points]
        for i in range(k):
            mine = [p for p, lab in zip(points, labels) if lab == i]
            if mine:
                centroids[i] = [sum(p[0] for p in mine) / len(mine), sum(p[1] for p in mine) / len(mine)]
        history.append({"centroids": [list(c) for c in centroids], "labels": list(labels)})
    return history
