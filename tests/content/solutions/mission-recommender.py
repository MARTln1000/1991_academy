import math


def recommend(user_vec, items, k):
    def dot(a, b):
        return sum(x * y for x, y in zip(a, b))
    scored = [(it["name"], dot(user_vec, it["vec"]) / (math.sqrt(dot(user_vec, user_vec)) * math.sqrt(dot(it["vec"], it["vec"]))))
              for it in items]
    return [name for name, score in sorted(scored, key=lambda s: s[1], reverse=True)[:k]]
