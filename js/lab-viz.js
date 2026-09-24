/* ============================================
   1991 Academy — Lab visualizations
   Data-driven canvas renderers: the learner's
   code (JS or Python, both in a Web Worker)
   produces plain data; these animate it.

   NOTE: nothing in this file may declare a
   local named `t` — that is the global i18n
   translate function, and shadowing it silently
   breaks Armenian. Theme objects are `th`.
   ============================================ */

const LabViz = (() => {
  let rafToken = 0; // bump to cancel any running animation

  /* ---------- plumbing ---------- */

  function setup(canvas, cssH) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(280, rect.width);
    canvas.width = W * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H: cssH };
  }

  function theme() {
    const s = getComputedStyle(document.documentElement);
    return {
      bg: s.getPropertyValue("--bg-elevated").trim() || "#11151f",
      text: s.getPropertyValue("--text-muted").trim() || "#98a1b3",
      faint: s.getPropertyValue("--border-strong").trim() || "rgba(255,255,255,0.14)",
      accent: s.getPropertyValue("--accent").trim() || "#6366f1",
      good: "#34d399",
      c0: "#f59e0b",
      c1: "#22d3ee",
      palette: ["#f59e0b", "#a855f7", "#22d3ee", "#34d399", "#fb7185"],
    };
  }

  /* setTimeout-driven (not rAF): keeps animating even when the tab is
     throttled, and the first frame always paints synchronously. */
  function play(frames, drawFrame, fps, note, label) {
    const token = ++rafToken;
    const interval = 1000 / fps;
    let i = 0;
    function step() {
      if (token !== rafToken || i >= frames.length) return;
      drawFrame(frames[i], i);
      if (note && label) note(label(i, frames.length));
      i += 1;
      if (i < frames.length) setTimeout(step, interval);
    }
    step();
  }

  function bounds(pts, pad) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const px = (maxX - minX || 1) * pad, py = (maxY - minY || 1) * pad;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }

  function mapper(b, W, H) {
    return {
      x: (v) => ((v - b.minX) / (b.maxX - b.minX)) * W,
      y: (v) => H - ((v - b.minY) / (b.maxY - b.minY)) * H,
    };
  }

  function clear(ctx, W, H, th) {
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);
  }

  function dot(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* ============================================
     Compute step (JS path): call the learner's
     function, produce plain data — the exact
     shape the Python vizScripts also produce.

     These run INSIDE the sandbox worker, so each
     one must be self-contained: no closure over
     anything in this file. Runner serializes
     them with Function.prototype.toString().
     ============================================ */

  const computeJS = {
    bars: (fn, viz) => fn(viz.input.slice()),
    grid: (fn, viz) => fn(viz.grid.map((r) => r.slice())),
    fitline: (fn, viz) => fn(viz.points.map((p) => p.slice())),
    clusters: (fn, viz) => fn(viz.points.map((p) => p.slice()), viz.k, viz.iters),
    sepline: (fn, viz) => fn(viz.data.map((p) => ({ ...p })), viz.epochs),
    knn: (fn, viz) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of viz.train) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      const padX = (maxX - minX || 1) * 0.12, padY = (maxY - minY || 1) * 0.12;
      minX -= padX; maxX += padX; minY -= padY; maxY += padY;
      const cols = 72, rows = 48;
      const m = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          const px = minX + ((c + 0.5) / cols) * (maxX - minX);
          const py = maxY - ((r + 0.5) / rows) * (maxY - minY);
          row.push(fn(viz.train, px, py, viz.k));
        }
        m.push(row);
      }
      return m;
    },
    xor: (fn) => {
      const net = fn();
      const cells = 56, lo = -0.25, hi = 1.25;
      const heat = [];
      for (let r = 0; r < cells; r++) {
        const row = [];
        for (let c = 0; c < cells; c++) {
          row.push(net.predict(lo + ((c + 0.5) / cells) * (hi - lo), hi - ((r + 0.5) / cells) * (hi - lo)));
        }
        heat.push(row);
      }
      return { heat, loss: net.lossHistory };
    },
  };

  /* ============================================
     Renderers: animate plain data.
     ============================================ */

  function bars(snapshots, viz, canvas, note) {
    const { ctx, W, H } = setup(canvas, 300);
    const th = theme();
    const n = viz.input.length;
    const maxV = Math.max(...viz.input);
    const gap = 6, bw = (W - gap * (n + 1)) / n;

    play(snapshots, (snap, i) => {
      clear(ctx, W, H, th);
      const prev = i > 0 ? snapshots[i - 1] : snap;
      snap.forEach((v, j) => {
        const h = (v / maxV) * (H - 40);
        ctx.fillStyle = v !== prev[j] ? th.good : th.accent;
        ctx.beginPath();
        ctx.roundRect(gap + j * (bw + gap), H - 24 - h, bw, h, 5);
        ctx.fill();
        ctx.fillStyle = th.text;
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(v, gap + j * (bw + gap) + bw / 2, H - 8);
      });
    }, 9, note, (i, len) => t("swap {0} of {1}", i, len - 1) + (i === len - 1 ? t(" — sorted! 🎉") : ""));
  }

  function grid(path, viz, canvas, note) {
    const g = viz.grid;
    const R = g.length, C = g[0].length;
    const { ctx, W } = setup(canvas, 380);
    const th = theme();
    const cell = Math.min((W - 20) / C, 360 / R);
    const ox = (W - cell * C) / 2, oy = 10;

    function drawMaze() {
      clear(ctx, W, 380, th);
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          ctx.fillStyle = g[r][c] === 1 ? "rgba(120,130,155,0.35)" : "rgba(120,130,155,0.08)";
          ctx.beginPath();
          ctx.roundRect(ox + c * cell + 1.5, oy + r * cell + 1.5, cell - 3, cell - 3, 4);
          ctx.fill();
        }
      }
    }

    if (!path || !path.length) {
      drawMaze();
      note(t("Your function returned no path for this maze — but one exists. Keep going!"));
      return;
    }

    const frames = path.map((_, i) => path.slice(0, i + 1));
    play(frames, (prefix) => {
      drawMaze();
      prefix.forEach(([r, c], i) => {
        const last = i === prefix.length - 1;
        ctx.fillStyle = last ? th.good : th.accent;
        ctx.beginPath();
        ctx.roundRect(ox + c * cell + 3, oy + r * cell + 3, cell - 6, cell - 6, 4);
        ctx.fill();
      });
      ctx.font = Math.floor(cell * 0.5) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏁", ox + (C - 0.5) * cell, oy + (R - 0.35) * cell);
    }, 14, note, (i, len) => t("step {0} / {1}", i + 1, len) + (i === len - 1 ? t(" — shortest path found! 🎉") : ""));
  }

  function fitline(history, viz, canvas, note) {
    const { ctx, W, H } = setup(canvas, 320);
    const th = theme();
    const b = bounds(viz.points, 0.15);
    const m = mapper(b, W, H);

    play(history, (snap) => {
      clear(ctx, W, H, th);
      for (const [x, y] of viz.points) dot(ctx, m.x(x), m.y(y), 4.5, th.c1);
      ctx.strokeStyle = th.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(m.x(b.minX), m.y(snap.w * b.minX + snap.b));
      ctx.lineTo(m.x(b.maxX), m.y(snap.w * b.maxX + snap.b));
      ctx.stroke();
      ctx.fillStyle = th.text;
      ctx.font = "12px JetBrains Mono, monospace";
      ctx.textAlign = "left";
      ctx.fillText("y = " + snap.w.toFixed(2) + "·x + " + snap.b.toFixed(2), 12, 20);
    }, 6, note, (i, len) => t("gradient step {0} / {1}", i + 1, len) + (i === len - 1 ? t(" — converged 🎉") : ""));
  }

  function clusters(history, viz, canvas, note) {
    const { ctx, W, H } = setup(canvas, 320);
    const th = theme();
    const b = bounds(viz.points, 0.15);
    const m = mapper(b, W, H);

    play(history, (snap) => {
      clear(ctx, W, H, th);
      viz.points.forEach((p, i) => {
        dot(ctx, m.x(p[0]), m.y(p[1]), 4.5, th.palette[snap.labels[i] % th.palette.length]);
      });
      snap.centroids.forEach((c, ci) => {
        const x = m.x(c[0]), y = m.y(c[1]);
        ctx.strokeStyle = th.palette[ci % th.palette.length];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y - 8); ctx.lineTo(x - 8, y + 8);
        ctx.stroke();
      });
    }, 1.6, note, (i, len) => t("iteration {0} / {1}", i + 1, len) + (i === len - 1 ? t(" — converged 🎉") : ""));
  }

  function knn(labelGrid, viz, canvas, note) {
    const { ctx, W, H } = setup(canvas, 340);
    const th = theme();
    const pts = viz.train.map((p) => [p.x, p.y]);
    const b = bounds(pts, 0.12);
    const m = mapper(b, W, H);
    const rows = labelGrid.length, cols = labelGrid[0].length;
    const cw = W / cols, ch = H / rows;

    const rowIdx = Array.from({ length: rows }, (_, i) => i);
    play(rowIdx, (r) => {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = labelGrid[r][c] === 1 ? "rgba(34,211,238,0.16)" : "rgba(245,158,11,0.16)";
        ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
      }
      if (r === rows - 1) {
        for (const p of viz.train) {
          dot(ctx, m.x(p.x), m.y(p.y), 5, p.label === 1 ? th.c1 : th.c0);
        }
      }
    }, 30, note, (i, len) =>
      i === len - 1
        ? t("your decision boundary, k = {0} 🎉", viz.k)
        : t("painting the plane… {0}%", Math.round((i / len) * 100)));
  }

  function sepline(history, viz, canvas, note) {
    const { ctx, W, H } = setup(canvas, 320);
    const th = theme();
    const b = bounds(viz.data.map((p) => [p.x, p.y]), 0.15);
    const m = mapper(b, W, H);

    play(history, (s, i) => {
      clear(ctx, W, H, th);
      for (const p of viz.data) dot(ctx, m.x(p.x), m.y(p.y), 5, p.label === 1 ? th.c1 : th.c0);
      if (Math.abs(s.w2) > 1e-9) {
        ctx.strokeStyle = th.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(m.x(b.minX), m.y((-s.b - s.w1 * b.minX) / s.w2));
        ctx.lineTo(m.x(b.maxX), m.y((-s.b - s.w1 * b.maxX) / s.w2));
        ctx.stroke();
      } else if (Math.abs(s.w1) > 1e-9) {
        ctx.strokeStyle = th.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(m.x(-s.b / s.w1), 0);
        ctx.lineTo(m.x(-s.b / s.w1), H);
        ctx.stroke();
      }
      ctx.fillStyle = th.text;
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(t("epoch {0}", i + 1), 12, 20);
    }, 3, note, (i, len) => t("epoch {0} / {1}", i + 1, len) + (i === len - 1 ? t(" — separated 🎉") : ""));
  }

  function xor(data, viz, canvas, note) {
    const { ctx, W, H } = setup(canvas, 340);
    const th = theme();
    clear(ctx, W, H, th);

    const heat = data.heat;
    const cells = heat.length;
    const size = Math.min(H - 30, W * 0.55);
    const ox = 10, oy = (H - size) / 2;
    const lo = -0.25, hi = 1.25;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const p = heat[r][c];
        const a = Math.min(0.55, Math.abs(p - 0.5) * 1.1 + 0.06);
        ctx.fillStyle = p > 0.5 ? "rgba(34,211,238," + a + ")" : "rgba(245,158,11," + a + ")";
        ctx.fillRect(ox + (c / cells) * size, oy + (r / cells) * size, size / cells + 0.5, size / cells + 0.5);
      }
    }
    const px = (v) => ox + ((v - lo) / (hi - lo)) * size;
    const py = (v) => oy + size - ((v - lo) / (hi - lo)) * size;
    [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]].forEach(([x, y, lab]) => {
      dot(ctx, px(x), py(y), 7, lab === 1 ? th.c1 : th.c0);
      ctx.strokeStyle = th.bg;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    const lx = ox + size + 24, lw = W - lx - 14, lh = size * 0.7, ly = oy + (size - lh) / 2;
    const hist = data.loss || [];
    if (hist.length > 1) {
      const maxL = Math.max(...hist) || 1;
      ctx.strokeStyle = th.faint;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, ly, lw, lh);
      ctx.strokeStyle = th.good;
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((loss, i) => {
        const x = lx + (i / (hist.length - 1)) * lw;
        const y = ly + lh - (loss / maxL) * lh;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = th.text;
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(t("loss over {0} epochs", hist.length), lx, ly - 8);
      ctx.fillText(t("final: {0}", hist[hist.length - 1].toFixed(5)), lx, ly + lh + 16);
    }

    const heatAt = (x, y) => {
      const c = Math.min(cells - 1, Math.max(0, Math.round(((x - lo) / (hi - lo)) * cells - 0.5)));
      const r = Math.min(cells - 1, Math.max(0, Math.round(((hi - y) / (hi - lo)) * cells - 0.5)));
      return heat[r][c];
    };
    note(
      t("your network's map of the plane — corners predict {0} 🎉",
        [heatAt(0, 0), heatAt(0, 1), heatAt(1, 0), heatAt(1, 1)].map((p) => p.toFixed(2)).join(", "))
    );
  }

  const render = { bars, grid, fitline, clusters, knn, sepline, xor };

  /* `computeJS` is deliberately NOT exported. Its functions call the learner's
     code, so they must only ever run inside the sandbox worker — handing them
     out invites exactly the main-thread execution that used to freeze the tab.
     Callers get the source text and pass it to Runner instead. */
  return {
    render,
    computeSource: (kind) => (computeJS[kind] ? String(computeJS[kind]) : null),
    stop: () => { rafToken += 1; },
  };
})();
