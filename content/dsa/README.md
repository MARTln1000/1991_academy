# DSA content authoring

`catalog.json` contains the topic graph, paths, curated resources and recognition patterns. `lessons/<topic-id>.json` contains a complete lesson, including language implementations, assessments, practice contracts and trace configuration. These are editable declarative content files; adding a lesson does not require a new page component.

Use `published` only when a lesson file exists and its material is ready to study. `legacy` links to an existing lesson through `legacyId`; it does not imply that the old lesson already meets the new depth standard. `planned` is a visible curriculum roadmap, not completed learning material. Fibonacci Tree remains explicitly unresolved pending the intended definition; it is not silently interpreted as a Fibonacci heap.

Topic prerequisites must refer to existing IDs and form a directed acyclic graph. `aliases` are alternative names for the same concept, not separate lessons. Fenwick Tree/Binary Indexed Tree and KD Tree/K-Dimensional Tree each have one canonical ID. Paths are ordered topic selections; recommendations should also check the prerequisite graph.

Lesson sections contain plain text with paragraph breaks, never HTML. Implementations are executable teaching examples; numeric limits and representation assumptions belong in the lesson text. Quiz `answer` is the zero-based option index; mastery dimensions use `Recognize`, `Explain`, `Trace`, `Implement`, `Debug`, `Analyze`, `Apply`, `Compare`, `Prove`, or `Optimize`. Completion is separate from assessment evidence.

Problems include explicit function signatures, constraints, incremental hints, worked reasoning, starter code and public educational tests. Public tests are feedback examples, not secure proof of authorship or exhaustive grading. Use the existing __check(name, actual, expected) protocol in all three runnable languages, so successful submissions return real check results. Use independent small-input oracles when validating reference algorithms.

Resources are external metadata, not copied book/course contents. The four initial URLs were opened and verified against their publishers. Their descriptions and recommended sections explain when to use them. Estimated minutes are editorial study estimates, not video-length claims. Personal notes, bookmarks, resource status and mastery belong to authenticated user state, never these files.

Trace inputs use the shared DSA adapter: `binary-search` has `values`, `target`, `mode`; `avl-tree` has `values` and `delete`; `dijkstra` has `nodes`, `edges` with `from`/`to`/`weight`, and `source`; `knapsack` has `items` with `weight`/`value` and `capacity`. Trace pseudocode is supplied by the trace engine so highlighted lines match actual events.

Before publishing, review motivation, invariants, operations, correctness, complexity derivation, memory behavior, mistakes, edge cases, variants, alternatives and meaningful practice. Validate the catalog through the content API and execute reference code. Advanced catalog entries are intentionally planned until they meet that standard.
