vector<string> recommend(const vector<double>& userVec, const vector<Item>& items, int k) {
    auto dot = [](const vector<double>& a, const vector<double>& b) {
        double s = 0;
        for (size_t i = 0; i < a.size(); i++) s += a[i] * b[i];
        return s;
    };
    vector<pair<double, string>> scored;
    for (const Item& it : items)
        scored.push_back({dot(userVec, it.vec) / (sqrt(dot(userVec, userVec)) * sqrt(dot(it.vec, it.vec))), it.name});
    sort(scored.begin(), scored.end(), [](const auto& a, const auto& b) { return a.first > b.first; });
    vector<string> out;
    for (int i = 0; i < k && i < (int)scored.size(); i++) out.push_back(scored[i].second);
    return out;
}
