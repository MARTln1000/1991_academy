function bubbleSortSteps(arr) {
  const a = arr.slice();
  const steps = [a.slice()];
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let j = 0; j + 1 < a.length; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        steps.push(a.slice());
        swapped = true;
      }
    }
  }
  return steps;
}
