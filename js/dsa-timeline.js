/* Shared reversible teaching timeline. Uses LabViz canvas primitives and immutable frames. */
const DSATimeline = (() => {
  function mount(host, kind, initial, topic, onEvidence) {
    let trace = null, index = 0, timer = null, selected = '', disposed = false, input = null;
    const answers = new Map();
    host.innerHTML = `<p class="dsa-muted">Reference-algorithm execution. Editing the practice code does not change this teaching trace. Memory addresses are conceptual.</p>
      <details><summary>Configure input</summary><label>Input JSON<textarea data-input spellcheck="false" aria-label="Algorithm input JSON"></textarea></label><button type="button" class="btn" data-build>Build trace</button><p data-input-error class="dsa-error" role="status"></p></details>
      <div class="dsa-toolbar"><button type="button" class="btn" data-first aria-label="Replay from beginning">↤ Replay</button><button type="button" class="btn" data-prev>Previous</button><button type="button" class="btn" data-play aria-pressed="false">Play</button><button type="button" class="btn" data-next>Next</button><label>Speed<select data-speed><option value="1200">Slow</option><option value="600" selected>Normal</option><option value="200">Fast</option></select></label><button type="button" class="btn" data-bookmark>Bookmark frame</button><button type="button" class="btn" data-predict>Predict next step</button></div>
      <label>Execution frame <input data-seek type="range" min="0" max="0" value="0" aria-label="Execution frame"></label><p data-position></p>
      <div class="dsa-two"><div><div class="dsa-visual" data-view></div><p data-explanation role="status"></p><div data-prediction></div></div><div><h3>Reference pseudocode</h3><ol class="dsa-code-lines" data-code></ol></div></div>
      <div class="dsa-grid dsa-inspector"><details open><summary>Variables &amp; counters</summary><pre data-vars></pre></details><details><summary>Call stack</summary><pre data-stack></pre></details><details><summary>Conceptual memory</summary><pre data-memory></pre></details></div>
      <label>Inspect object<select data-selected><option value="">Whole state</option></select></label>`;
    const el = name => host.querySelector(`[data-${name}]`);
    try { el('input').value = JSON.stringify(initial === undefined ? DSATraces.defaults[kind] : initial, null, 2) ?? ''; }
    catch (error) { el('input-error').textContent = 'Input cannot be represented as JSON: ' + error.message; }
    function controls() {
      const available = !!trace && !disposed;
      const end = available && index === trace.frames.length - 1;
      for (const name of ['first', 'prev']) el(name).disabled = !available || index === 0;
      for (const name of ['next', 'predict']) el(name).disabled = !available || end;
      el('play').disabled = !available || (end && timer === null);
      el('speed').disabled = !available || trace.frames.length < 2;
      for (const name of ['seek', 'bookmark', 'selected']) el(name).disabled = !available;
      el('play').textContent = timer === null ? 'Play' : 'Pause';
      el('play').setAttribute('aria-pressed', String(timer !== null));
    }
    function stop() { if (timer !== null) clearTimeout(timer); timer = null; controls(); }
    function selectionOptions(frame) {
      const entries = Object.keys(frame.variables || {}).map(key => ({ value: `variable:${key}`, label: `Variable: ${key}` }));
      if (frame.view.nodes) frame.view.nodes.forEach(node => entries.push({ value: `node:${node.id}`, label: `Node: ${node.value ?? node.id}` }));
      if (frame.view.kind === 'array') frame.view.values.forEach((value, i) => entries.push({ value: `index:${i}`, label: `Array index ${i}: ${value}` }));
      if (!entries.some(entry => entry.value === selected)) selected = '';
      el('selected').innerHTML = '<option value="">Whole state</option>' + entries.map(entry => `<option value="${esc(entry.value)}">${esc(entry.label)}</option>`).join('');
      el('selected').value = selected;
    }
    function draw() {
      if (disposed || !trace) return;
      const frame = trace.frames[index];
      el('seek').max = trace.frames.length - 1; el('seek').value = index;
      el('seek').setAttribute('aria-valuetext', `Frame ${index + 1} of ${trace.frames.length}: ${frame.explanation}`);
      el('position').textContent = `Frame ${index + 1} / ${trace.frames.length}${index === trace.frames.length - 1 ? ' · Result: ' + JSON.stringify(trace.result) : ''}`;
      el('explanation').textContent = frame.explanation;
      el('code').innerHTML = trace.pseudocode.map((line, i) => `<li class="${i === frame.line ? 'dsa-active' : ''}" ${i === frame.line ? 'aria-current="step"' : ''}>${esc(line)}</li>`).join('');
      el('vars').textContent = JSON.stringify({ variables: frame.variables, counters: frame.counters }, null, 2);
      el('stack').textContent = frame.stack.length ? JSON.stringify(frame.stack, null, 2) : 'No recursive call frames in this algorithm state.';
      el('memory').textContent = JSON.stringify(frame.memory, null, 2);
      selectionOptions(frame);
      renderView(el('view'), frame.view);
      el('prediction').innerHTML = '';
      controls();
    }
    function build() {
      if (disposed) return;
      stop();
      try {
        const candidate = JSON.parse(el('input').value);
        const generated = DSATraces.generate(kind, candidate);
        input = candidate; trace = generated; index = 0; selected = ''; answers.clear();
        el('input-error').textContent = ''; draw();
      } catch (error) {
        el('input-error').textContent = error.message + (trace ? ' The previous valid trace is still displayed.' : ' Correct the input and build a trace to enable execution.');
        if (!trace) { el('view').textContent = 'No valid trace available.'; el('position').textContent = 'No execution frames'; }
        controls();
      }
    }
    function showPrediction() {
      if (disposed || !trace || index >= trace.frames.length - 1) return;
      stop();
      const frameIndex = index, next = trace.frames[index + 1];
      let question = trace.frames[index].prediction;
      if (!question) {
        const choices = [...new Set([next.line, (next.line + 1) % trace.pseudocode.length, (next.line + 2) % trace.pseudocode.length])].sort((a, b) => a - b);
        question = { prompt: 'Which pseudocode line executes in the next frame?', options: choices.map(line => `${line + 1}. ${trace.pseudocode[line]}`), answer: choices.indexOf(next.line), explanation: next.explanation };
      }
      el('prediction').innerHTML = `<fieldset><legend>${esc(question.prompt)}</legend>${question.options.map((choice, i) => `<button type="button" class="btn" data-guess="${i}">${esc(choice)}</button>`).join('')}<p role="status"></p></fieldset>`;
      const report = correct => {
        el('prediction').querySelector('p').textContent = `${correct ? 'Correct.' : 'Not quite.'} ${question.explanation}`;
        el('prediction').querySelectorAll('button').forEach(button => { button.disabled = true; });
      };
      if (answers.has(index)) { report(answers.get(index)); return; }
      el('prediction').querySelectorAll('button').forEach(button => { button.onclick = () => {
        if (disposed || index !== frameIndex || answers.has(frameIndex)) return;
        const correct = Number(button.dataset.guess) === question.answer;
        answers.set(frameIndex, correct); report(correct);
        if (typeof onEvidence === 'function') {
          Promise.resolve().then(() => onEvidence('Trace', `trace-${kind}-${frameIndex}`, correct)).catch(() => {
            if (!disposed && index === frameIndex) el('prediction').querySelector('p')?.append(' Your answer is shown, but mastery could not be saved.');
          });
        }
      }; });
    }
    function delay() { return [200, 600, 1200].includes(Number(el('speed').value)) ? Number(el('speed').value) : 600; }
    function step() {
      timer = null;
      if (disposed || !trace || index >= trace.frames.length - 1) { stop(); return; }
      index++; draw();
      if (trace.frames[index].prediction && !answers.has(index)) { showPrediction(); return; }
      if (index < trace.frames.length - 1) timer = setTimeout(step, delay());
      controls();
    }
    function seek(frame) {
      if (disposed || !trace || !Number.isFinite(Number(frame))) return;
      stop(); index = Math.max(0, Math.min(trace.frames.length - 1, Math.floor(Number(frame)))); draw();
    }
    el('build').onclick = build;
    el('prev').onclick = () => seek(index - 1);
    el('next').onclick = () => seek(index + 1);
    el('first').onclick = () => seek(0);
    el('seek').oninput = () => seek(el('seek').value);
    el('play').onclick = () => {
      if (disposed || !trace) return;
      if (timer !== null) stop();
      else if (index < trace.frames.length - 1) { timer = setTimeout(step, delay()); controls(); }
    };
    el('speed').onchange = () => { if (timer !== null) { clearTimeout(timer); timer = setTimeout(step, delay()); } };
    el('selected').onchange = () => { selected = el('selected').value; };
    el('bookmark').onclick = () => {
      if (disposed || !trace) return;
      try { DSAStore.bookmark(`frame:${topic}:${index}`, { topic, kind: 'frame', frame: index, input, title: `${topic}: frame ${index + 1}` }); toast('Frame bookmarked'); }
      catch (error) { toast('Could not save bookmark: ' + error.message); }
    };
    el('predict').onclick = showPrediction;
    build();
    // Height changes caused by rendering must not trigger repeated canvas rebuilds.
    let width = host.getBoundingClientRect().width;
    const resize = () => {
      const nextWidth = host.getBoundingClientRect().width;
      if (!disposed && trace && Math.abs(nextWidth - width) > 0.5) { width = nextWidth; renderView(el('view'), trace.frames[index].view); }
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (observer) observer.observe(host); else window.addEventListener('resize', resize);
    return {
      dispose() { disposed = true; stop(); observer?.disconnect(); if (!observer) window.removeEventListener('resize', resize); },
      context: () => ({ frame: trace?.frames[index] ?? null, selectedObject: selected }),
      seek,
      snapshot: () => ({ input: input === null ? null : JSON.parse(JSON.stringify(input)), index })
    };
  }
  function renderView(host, view) {
    if (view.kind === 'array') {
      host.innerHTML = `<p>Active interval [${view.low}, ${view.high}); target ${esc(String(view.target))}</p><div class="dsa-cells" role="list" aria-label="Array values">` + view.values.map((value, index) => `<div role="listitem" class="dsa-cell ${view.active.includes(index) ? 'active' : ''} ${index < view.low || index >= view.high ? 'dsa-outside' : ''}"><small>index ${index}</small>${esc(String(value))}${view.active.includes(index) ? '<small>midpoint</small>' : ''}${index < view.low || index >= view.high ? '<small>excluded</small>' : ''}</div>`).join('') + '</div>' + (view.values.length ? '' : '<p>Empty array.</p>') + (view.result === null ? '' : `<p>Returned index: ${view.result}${view.result === -1 ? ' (not found)' : view.result === view.values.length ? ' (boundary after the last element)' : ''}</p>`);
      return;
    }
    if (view.kind === 'table') {
      host.innerHTML = '<div class="dsa-scroll"><table><caption>Best value for each prefix of items and available capacity. The current state is marked with an asterisk.</caption><thead><tr><th scope="col">Items / capacity</th>' + view.columnLabels.map(v => `<th scope="col">${esc(String(v))}</th>`).join('') + '</tr></thead><tbody>' + view.rows.map((row, i) => `<tr><th scope="row">${esc(String(view.rowLabels[i]))}</th>` + row.map((value, j) => { const active = view.active.some(cell => cell[0] === i && cell[1] === j); return `<td class="${active ? 'dsa-active' : ''}" ${active ? 'aria-label="Current state: ' + value + '"' : ''}>${value}${active ? ' *' : ''}</td>`; }).join('') + '</tr>').join('') + '</tbody></table></div><p>Chosen item indices: ' + esc(JSON.stringify(view.chosen)) + '</p>';
      return;
    }
    const tree = view.kind === 'tree';
    const oldDetails = host.querySelector('details');
    const detailsOpen = !!oldDetails?.open;
    host.innerHTML = `<div class="dsa-scroll"><canvas aria-label="${tree ? 'Tree structure; parent-child links point downward' : (view.directed ? 'Directed' : 'Undirected') + ' weighted graph; active nodes have an outer ring'}" role="img"></canvas></div><details ${detailsOpen ? 'open' : ''}><summary>Text alternative: nodes and connections</summary><pre></pre></details>`;
    host.querySelector('pre').textContent = JSON.stringify(view, null, 2);
    const nodes = view.nodes, byId = new Map(nodes.map(node => [node.id, node]));
    const positions = new Map();
    let maxDepth = 0, rank = 0;
    if (tree) {
      function visit(id, depth) {
        const node = byId.get(id); if (!node) return;
        visit(node.left, depth + 1); positions.set(id, { rank: rank++, depth }); maxDepth = Math.max(maxDepth, depth); visit(node.right, depth + 1);
      }
      visit(view.root, 0);
    }
    const canvas = host.querySelector('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.minWidth = `${tree ? Math.max(280, nodes.length * 55 + 40) : 420}px`;
    const { ctx, W, H } = LabViz.primitives.setup(canvas, tree ? Math.max(210, 90 + maxDepth * 72) : 350);
    const th = LabViz.primitives.theme();
    LabViz.primitives.clear(ctx, W, H, th);
    if (tree) {
      for (const p of positions.values()) { p.x = 25 + (p.rank + 0.5) * (W - 50) / Math.max(1, nodes.length); p.y = 32 + p.depth * 72; }
    } else nodes.forEach((node, i) => {
      const angle = 2 * Math.PI * i / nodes.length - Math.PI / 2;
      positions.set(node.id, { x: W / 2 + Math.cos(angle) * (W / 2 - 65), y: H / 2 + Math.sin(angle) * (H / 2 - 50) });
    });
    const edges = tree ? nodes.flatMap(node => [node.left, node.right].filter(id => id !== null).map(id => ({ from: node.id, to: id }))) : view.edges;
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 1.5;
    function arrow(x, y, angle) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9 * Math.cos(angle - 0.45), y - 9 * Math.sin(angle - 0.45));
      ctx.lineTo(x - 9 * Math.cos(angle + 0.45), y - 9 * Math.sin(angle + 0.45)); ctx.closePath(); ctx.fillStyle = th.text; ctx.fill();
    }
    for (const edge of edges) {
      const a = positions.get(edge.from), b = positions.get(edge.to); if (!a || !b) continue;
      ctx.strokeStyle = th.text; ctx.fillStyle = th.text; ctx.beginPath();
      let labelX, labelY;
      if (edge.from === edge.to) {
        ctx.arc(a.x + 15, a.y - 19, 17, 0.25, Math.PI * 1.8); ctx.stroke();
        if (view.directed) arrow(a.x + 15 + 17 * Math.cos(Math.PI * 1.8), a.y - 19 + 17 * Math.sin(Math.PI * 1.8), Math.PI * 2.3);
        labelX = a.x + 36; labelY = a.y - 31;
      } else {
        const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
        // Offset reciprocal directed edges so their two arrowheads remain distinguishable.
        const offset = !tree && view.directed && edges.some(e => e.from === edge.to && e.to === edge.from) ? 6 : 0;
        const ax = a.x + ux * 20 - uy * offset, ay = a.y + uy * 20 + ux * offset;
        const bx = b.x - ux * 21 - uy * offset, by = b.y - uy * 21 + ux * offset;
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        if (!tree && view.directed) arrow(bx, by, Math.atan2(dy, dx));
        labelX = (ax + bx) / 2 - uy * 9; labelY = (ay + by) / 2 + ux * 9;
      }
      if (edge.weight !== undefined) {
        const label = String(edge.weight); const width = ctx.measureText(label).width + 6;
        ctx.fillStyle = th.bg; ctx.fillRect(labelX - width / 2, labelY - 11, width, 15); ctx.fillStyle = th.text; ctx.fillText(label, labelX, labelY);
      }
    }
    for (const node of nodes) {
      const p = positions.get(node.id); if (!p) continue;
      const active = (view.active || []).includes(node.id);
      ctx.beginPath(); ctx.arc(p.x, p.y, 19, 0, Math.PI * 2); ctx.fillStyle = th.bg; ctx.fill();
      ctx.strokeStyle = active ? th.accent : th.text; ctx.lineWidth = active ? 3 : 1.5; ctx.stroke();
      if (active) { ctx.beginPath(); ctx.arc(p.x, p.y, 23, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = th.text; ctx.fillText(String(node.value ?? node.id), p.x, p.y + 4);
      ctx.fillText(tree ? 'h=' + node.height : 'd=' + (node.distance === null ? '∞' : node.distance) + (node.settled ? ' ✓' : ''), p.x, p.y + 38);
    }
    if (!nodes.length) { ctx.fillStyle = th.text; ctx.fillText('Empty tree', W / 2, H / 2); }
    if (!tree) {
      const state = document.createElement('div');
      state.innerHTML = `<p>${view.directed ? 'Directed edges have arrowheads.' : 'Edges are undirected.'} ∞ means not yet reached. ✓ means settled. An outer ring marks active nodes.</p><p>Binary min-heap array (only its root is guaranteed minimal): ${esc(JSON.stringify(view.queue))}</p><table><caption>Shortest-path state</caption><thead><tr><th scope="col">Node</th><th scope="col">Distance</th><th scope="col">Status</th></tr></thead><tbody>${nodes.map(node => `<tr><th scope="row">${esc(node.id)}</th><td>${node.distance === null ? '∞ (unreached)' : node.distance}</td><td>${node.settled ? 'Settled' : 'Unsettled'}${view.active.includes(node.id) ? ', active' : ''}</td></tr>`).join('')}</tbody></table>`;
      host.append(state);
    }
  }
  return { mount, renderView };
})();
