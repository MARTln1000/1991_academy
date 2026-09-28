int maxSubarraySum(vector<int> nums) {
    int here = nums[0], best = nums[0];
    for (size_t i = 1; i < nums.size(); i++) {
        here = max(nums[i], here + nums[i]);
        best = max(best, here);
    }
    return best;
}
