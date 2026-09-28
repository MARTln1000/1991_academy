import bisect


def autocomplete(sorted_words, prefix):
    i = bisect.bisect_left(sorted_words, prefix)
    out = []
    while i < len(sorted_words) and sorted_words[i].startswith(prefix):
        out.append(sorted_words[i])
        i += 1
    return out
