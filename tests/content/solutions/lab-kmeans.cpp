vector<Step> kmeans(vector<vector<double>> points, int k, int iters) {
    vector<vector<double>> centroids(points.begin(), points.begin() + k);
    vector<Step> history;
    for (int it = 0; it < iters; it++) {
        vector<int> labels(points.size());
        for (size_t i = 0; i < points.size(); i++) {
            double best = 1e300;
            for (int c = 0; c < k; c++) {
                double d = hypot(points[i][0] - centroids[c][0], points[i][1] - centroids[c][1]);
                if (d < best) { best = d; labels[i] = c; }
            }
        }
        vector<double> sx(k), sy(k);
        vector<int> n(k);
        for (size_t i = 0; i < points.size(); i++) { sx[labels[i]] += points[i][0]; sy[labels[i]] += points[i][1]; n[labels[i]]++; }
        for (int c = 0; c < k; c++) if (n[c]) centroids[c] = {sx[c] / n[c], sy[c] / n[c]};
        history.push_back({centroids, labels});
    }
    return history;
}
