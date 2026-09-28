vector<Weights> trainPerceptron(vector<Point> data, int epochs) {
    double w1 = 0, w2 = 0, b = 0;
    const double lr = 0.1;
    vector<Weights> history;
    for (int e = 0; e < epochs; e++) {
        for (const Point& p : data) {
            int pred = w1 * p.x + w2 * p.y + b >= 0 ? 1 : 0;
            int err = p.label - pred;
            w1 += lr * err * p.x;
            w2 += lr * err * p.y;
            b += lr * err;
        }
        history.push_back({w1, w2, b});
    }
    return history;
}
