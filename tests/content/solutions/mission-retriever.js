function retrieve(query, docs, k) {
  const q = new Set(query.toLowerCase().split(/\s+/).filter(Boolean));
  return docs
    .map((d) => {
      const words = new Set(d.text.toLowerCase().split(/\s+/));
      let score = 0;
      for (const w of q) if (words.has(w)) score++;
      return { id: d.id, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.id);
}
