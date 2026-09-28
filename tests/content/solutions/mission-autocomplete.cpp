vector<string> autocomplete(const vector<string>& sortedWords, const string& prefix) {
    vector<string> out;
    for (auto it = lower_bound(sortedWords.begin(), sortedWords.end(), prefix);
         it != sortedWords.end() && it->compare(0, prefix.size(), prefix) == 0; ++it)
        out.push_back(*it);
    return out;
}
