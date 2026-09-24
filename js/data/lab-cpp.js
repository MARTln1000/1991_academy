/* 1991 Academy — C++ variants for the pure-algorithm Lab problems.
   Attaches .cpp = { fnName, starter, tests } to the DSA problems whose
   I/O is a clean fit for C++. Compiled + run on the server (needs a
   C++ compiler); the harness prints CHECK| lines the client parses.
   The visual ML/DL builds stay JavaScript/Python (they drive the canvas). */
(function () {
  const CPP = {
    "lab-two-sum": {
      fnName: "twoSum",
      starter: `// Return the indices [i, j] (i < j) with nums[i] + nums[j] == target.
// Return an empty vector if no pair exists.
vector<int> twoSum(vector<int> nums, int target) {
    // hint: unordered_map<int,int> from value -> index, filled as you walk
    return {};
}`,
      tests: `int main() {
    __check("basic pair", twoSum({2, 7, 11, 15}, 9), vector<int>{0, 1});
    __check("pair is later", twoSum({3, 2, 4}, 6), vector<int>{1, 2});
    __check("duplicates", twoSum({3, 3}, 6), vector<int>{0, 1});
    __check("no answer -> empty", twoSum({1, 2, 3}, 100), vector<int>{});
    __check("negatives", twoSum({-3, 4, 3, 90}, 0), vector<int>{0, 2});
    return 0;
}`,
    },

    "lab-valid-parens": {
      fnName: "isValid",
      starter: `// true if every bracket closes in the correct order, false otherwise.
bool isValid(string s) {
    // push openers on a stack; on a closer, the top must match
    return true;
}`,
      tests: `int main() {
    __check("simple", isValid("()"), true);
    __check("sequence", isValid("()[]{}"), true);
    __check("nested", isValid("({[]})"), true);
    __check("wrong pair", isValid("(]"), false);
    __check("interleaved", isValid("([)]"), false);
    __check("unclosed opener", isValid("(("), false);
    __check("closer first", isValid(")("), false);
    __check("empty string", isValid(""), true);
    return 0;
}`,
    },

    "lab-max-subarray": {
      fnName: "maxSubarraySum",
      starter: `// Largest sum of a contiguous, non-empty subarray (Kadane's algorithm).
int maxSubarraySum(vector<int> nums) {
    // best ending at this index vs best seen anywhere
    return 0;
}`,
      tests: `int main() {
    __check("classic", maxSubarraySum({-2, 1, -3, 4, -1, 2, 1, -5, 4}), 6);
    __check("all negative", maxSubarraySum({-3, -1, -2}), -1);
    __check("single element", maxSubarraySum({5}), 5);
    __check("all positive", maxSubarraySum({1, 2, 3}), 6);
    __check("recovery after dip", maxSubarraySum({5, -9, 6, -2, 3}), 7);
    return 0;
}`,
    },
  };

  for (const p of window.MARTINIUM.lab) {
    if (CPP[p.id]) p.cpp = CPP[p.id];
  }
})();
