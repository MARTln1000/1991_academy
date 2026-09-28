int knnPredict(vector<Point> train, double x, double y, int k) {
    vector<pair<double, int>> d;
    for (const Point& p : train) d.push_back({(p.x - x) * (p.x - x) + (p.y - y) * (p.y - y), p.label});
    sort(d.begin(), d.end());
    int ones = 0;
    for (int i = 0; i < k && i < (int)d.size(); i++) ones += d[i].second;
    return ones * 2 > k ? 1 : 0;
}
