def bubble_sort_steps(arr):
    a = list(arr)
    steps = [list(a)]
    swapped = True
    while swapped:
        swapped = False
        for j in range(len(a) - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                steps.append(list(a))
                swapped = True
    return steps
