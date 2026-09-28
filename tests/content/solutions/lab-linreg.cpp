vector<Snapshot> fitLine(vector<vector<double>> points) {
    double w = 0, b = 0;
    const double lr = 0.05;
    const int steps = 200;
    vector<Snapshot> history;
    for (int s = 0; s < steps; s++) {
        double dw = 0, db = 0;
        for (const auto& p : points) {
            double err = w * p[0] + b - p[1];
            dw += 2 * err * p[0];
            db += 2 * err;
        }
        w -= lr * dw / points.size();
        b -= lr * db / points.size();
        if (s % 10 == 0) history.push_back({w, b});
    }
    history.push_back({w, b});
    return history;
}
