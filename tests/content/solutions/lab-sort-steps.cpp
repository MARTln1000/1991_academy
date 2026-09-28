vector<vector<int>> bubbleSortSteps(vector<int> a) {
    vector<vector<int>> steps = {a};
    bool swapped = true;
    while (swapped) {
        swapped = false;
        for (size_t j = 0; j + 1 < a.size(); j++) {
            if (a[j] > a[j + 1]) {
                swap(a[j], a[j + 1]);
                steps.push_back(a);
                swapped = true;
            }
        }
    }
    return steps;
}
