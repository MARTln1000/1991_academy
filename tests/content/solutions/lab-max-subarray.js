function maxSubarraySum(nums) {
  let here = nums[0], best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    here = Math.max(nums[i], here + nums[i]);
    best = Math.max(best, here);
  }
  return best;
}
