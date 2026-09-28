def retrieve(query, docs, k):
    q = set(query.lower().split())
    scored = [(d["id"], len(q & set(d["text"].lower().split()))) for d in docs]
    ranked = sorted((s for s in scored if s[1] > 0), key=lambda s: s[1], reverse=True)
    return [doc_id for doc_id, score in ranked[:k]]
