vector<string> retrieve(const string& query, const vector<Doc>& docs, int k) {
    auto words = [](const string& s) {
        set<string> out;
        istringstream in(s);
        string w;
        while (in >> w) {
            for (char& ch : w) ch = tolower((unsigned char)ch);
            out.insert(w);
        }
        return out;
    };
    set<string> q = words(query);
    vector<pair<int, string>> scored;
    for (const Doc& d : docs) {
        set<string> text = words(d.text);
        int score = 0;
        for (const string& w : q) score += text.count(w);
        if (score > 0) scored.push_back({score, d.id});
    }
    stable_sort(scored.begin(), scored.end(), [](const auto& a, const auto& b) { return a.first > b.first; });
    vector<string> out;
    for (int i = 0; i < k && i < (int)scored.size(); i++) out.push_back(scored[i].second);
    return out;
}
