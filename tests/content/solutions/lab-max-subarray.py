def max_subarray_sum(nums):
    here = best = nums[0]
    for x in nums[1:]:
        here = max(x, here + x)
        best = max(best, here)
    return best
