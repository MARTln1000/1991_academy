function autocomplete(sortedWords, prefix) {
  let lo = 0, hi = sortedWords.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedWords[mid] < prefix) lo = mid + 1; else hi = mid;
  }
  const out = [];
  while (lo < sortedWords.length && sortedWords[lo].startsWith(prefix)) out.push(sortedWords[lo++]);
  return out;
}
