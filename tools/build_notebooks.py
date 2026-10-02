#!/usr/bin/env python3
"""Build a Google Colab notebook for every coding exercise on the site.

Learners write and run their code in Google Colab, in their own browser, and
keep it in their own Google Drive; the site gives them the task, the starter
code, the tests and the hints, in one notebook per exercise, which they
download from the site and upload to Colab. This script writes those notebooks
from the site's own exercise data (tools/site_data.js), in English and
Armenian:

    make notebooks            (run it after changing an exercise in js/data/)

    assets/colab/<en|hy>/lab-two-sum.ipynb        Lab problem
    assets/colab/<en|hy>/mission-maze.ipynb       mission
    assets/colab/<en|hy>/prog-1-1-ex1.ipynb       lesson exercise

The site serves them from assets/colab/ (js/colab.js puts the download
buttons on each exercise), so a change reaches learners with the next deploy
of the site. tests/test_notebooks.py checks that they are up to date, and runs
every one of them.

Every exercise is Python. Each notebook: the task, a cell with the starter
code, a "Run the tests" cell that prints a check or a cross per test, the
hints, and for the Lab problems a cell that plots what the learner's code does.
"""
import html
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "colab"

MSG = {
    "en": {
        "kind_lab": "The Lab", "kind_mission": "Missions", "kind_lesson": "Programming",
        "save": "💾 **Your work is saved:** uploaded to Colab (**File → Upload notebook**), this notebook lives in your "
                "Google Drive, in the *Colab Notebooks* folder. Close it any time and continue later.",
        "done": "✅ When every test passes, go back to 1991 Academy and click **I solved it ✓**.",
        "code": "## Your code",
        "code_py": "Write your solution in the cell below and run it: click ▶, or press Shift+Enter.",
        "check": "## Check your solution",
        "check_text": "Run the cell below. If a test fails, fix your code, run your code cell again, then this one.",
        "run_title": "▶ Run the tests",
        "hints": "## Hints", "hint_n": "Hint {n}",
        "viz": "## See your code run",
        "viz_text": "Once the tests pass, run this cell to see what your code does.",
        "viz_title": "📊 Visualize your code",
        "credit": "<sub>Based on FAST Foundation course materials ({source}).</sub>",
        # printed by the test cells
        "all_pass": "🎉 All {n} tests pass! Go back to 1991 Academy and click “I solved it ✓”.",
        "some_pass": "{p}/{n} tests pass. Keep going!",
        "none_ran": "No tests ran. Is your function named {fn}?",
        "expected": "expected {e}, got {a}",
        "error": "💥 The tests stopped with an error:",
        "not_run": "Did you run your code cell above? The tests only see code that has been run.",
    },
    "hy": {
        "kind_lab": "Լաբորատորիա", "kind_mission": "Առաքելություններ", "kind_lesson": "Ծրագրավորում",
        "save": "💾 **Աշխատանքդ պահվում է.** Colab-ում վերբեռնված (**File → Upload notebook**) այս նոթբուքը գտնվում է "
                "քո Google Drive-ում՝ *Colab Notebooks* թղթապանակում։ Կարող ես փակել այն և շարունակել ավելի ուշ։",
        "done": "✅ Երբ բոլոր թեստերն անցնեն, վերադարձի՛ր 1991 Academy և սեղմի՛ր **Ես լուծեցի ✓**։",
        "code": "## Քո կոդը",
        "code_py": "Գրի՛ր լուծումդ ներքևի բջջում և գործարկի՛ր այն. սեղմի՛ր ▶ կամ Shift+Enter։",
        "check": "## Ստուգի՛ր լուծումդ",
        "check_text": "Գործարկի՛ր ներքևի բջիջը։ Եթե թեստը չանցնի, ուղղի՛ր կոդդ, նորից գործարկի՛ր կոդի բջիջը, հետո՝ այս մեկը։",
        "run_title": "▶ Գործարկել թեստերը",
        "hints": "## Հուշումներ", "hint_n": "Հուշում {n}",
        "viz": "## Տե՛ս քո կոդը գործողության մեջ",
        "viz_text": "Երբ թեստերն անցնեն, գործարկի՛ր այս բջիջը՝ տեսնելու, թե ինչ է անում կոդդ։",
        "viz_title": "📊 Պատկերել կոդդ",
        "credit": "<sub>Հիմնված է FAST Foundation-ի դասընթացի նյութերի վրա ({source})։</sub>",
        "all_pass": "🎉 Բոլոր {n} թեստերն անցան։ Վերադարձի՛ր 1991 Academy և սեղմի՛ր «Ես լուծեցի ✓»։",
        "some_pass": "{p}/{n} թեստ է անցնում։ Շարունակի՛ր։",
        "none_ran": "Ոչ մի թեստ չաշխատեց։ Ֆունկցիայիդ անունը {fn} է՞։",
        "expected": "սպասվում էր {e}, ստացվեց {a}",
        "error": "💥 Թեստերը կանգ առան սխալով՝",
        "not_run": "Գործարկե՞լ ես վերևի կոդի բջիջը։ Թեստերը տեսնում են միայն գործարկված կոդը։",
    },
}
HARNESS_KEYS = ["all_pass", "some_pass", "none_ran", "expected", "error", "not_run"]


# ------------------------------------------------------------------ helpers

class _Markdown(HTMLParser):
    """The few tags the exercise briefs use, as Markdown."""
    INLINE = {"code": "`", "strong": "**", "b": "**", "em": "*", "i": "*"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.pre, self.href = [], False, None

    def handle_starttag(self, tag, attrs):
        if tag == "pre":
            self.pre = True
            self.out.append("\n\n```\n")
        elif tag in self.INLINE and not self.pre:
            self.out.append(self.INLINE[tag])
        elif tag == "br":
            self.out.append("  \n")
        elif tag == "li":
            self.out.append("\n- ")
        elif tag == "a":
            self.href = dict(attrs).get("href")
            self.out.append("[")

    def handle_endtag(self, tag):
        if tag == "pre":
            self.pre = False
            self.out.append("\n```\n\n")
        elif tag in self.INLINE and not self.pre:
            self.out.append(self.INLINE[tag])
        elif tag in ("p", "ul", "ol", "div"):
            self.out.append("\n\n")
        elif tag == "a":
            self.out.append("](%s)" % self.href if self.href else "]")

    def handle_data(self, data):
        self.out.append(data if self.pre else re.sub(r"\s+", " ", data))

    def text(self):
        text = "".join(self.out)
        # outside code blocks, a line never starts with the space left between two tags
        parts = text.split("```")
        parts[::2] = [re.sub(r"\n[ \t]+", "\n", part) for part in parts[::2]]
        return re.sub(r"\n{3,}", "\n\n", "```".join(parts)).strip()


def markdown(fragment):
    parser = _Markdown()
    parser.feed(fragment or "")
    parser.close()
    return parser.text()


def lines(text):
    parts = text.split("\n")
    return [p + "\n" for p in parts[:-1]] + ([parts[-1]] if parts[-1] else [])


def md_cell(text):
    return {"cell_type": "markdown", "metadata": {}, "source": lines(text.strip("\n"))}


def code_cell(text, form=False):
    meta = {"cellView": "form"} if form else {}
    return {"cell_type": "code", "execution_count": None, "metadata": meta, "outputs": [], "source": lines(text.strip("\n"))}


def notebook(cells):
    return {
        "nbformat": 4, "nbformat_minor": 0,
        "metadata": {"colab": {"provenance": []}, "kernelspec": {"name": "python3", "display_name": "Python 3"},
                     "language_info": {"name": "python"}},
        "cells": cells,
    }


def raw(text):
    """A Python raw string literal holding text (none of ours contain \"\"\")."""
    assert '"""' not in text and not text.endswith("\\"), text[:80]
    return 'r"""' + text + '"""'


def pick(obj, field, ui):
    return (obj.get(field + "_hy") if ui == "hy" else None) or obj.get(field) or ""


def hints_md(msg, hints):
    parts = [msg["hints"]]
    for n, hint in enumerate(hints, 1):
        parts.append("<details><summary>%s</summary>\n\n%s\n\n</details>" % (msg["hint_n"].format(n=n), hint))
    return "\n\n".join(parts)


# --------------------------------------------------------- the test cells

REPORT = '''
def _report(results, error, fn):
    for name, ok, expected, actual in results:
        print(("✓ " if ok else "✗ ") + name + ("" if ok else "   " + MSG["expected"].format(e=expected, a=actual)))
    if error:
        print("\\n" + MSG["error"])
        print(error.rstrip())
    passed = sum(1 for r in results if r[1])
    print()
    if results and passed == len(results) and not error:
        print(MSG["all_pass"].format(n=passed))
    elif results:
        print(MSG["some_pass"].format(p=passed, n=len(results)))
    elif not error:
        print(MSG["none_ran"].format(fn=fn))
'''


def msg_literal(ui):
    return "MSG = " + json.dumps({k: MSG[ui][k] for k in HARNESS_KEYS}, ensure_ascii=False, indent=1)


def python_tests_cell(ui, tests, fn):
    body = "\n".join(("        " + ln) if ln.strip() else "" for ln in tests.strip("\n").split("\n"))
    assert '"""' not in tests and "'''" not in tests
    return "\n".join([
        '#@title %s { display-mode: "form" }' % MSG[ui]["run_title"],
        "import json, math, traceback",
        msg_literal(ui),
        REPORT,
        "def _academy_run_tests():",
        "    results = []",
        "",
        "    def __check(name, actual, expected):",
        "        try:",
        "            ok = bool(actual == expected)",
        "        except Exception:",
        "            ok = False",
        "        results.append((str(name), ok, repr(expected), repr(actual)))",
        "",
        "    def tests():",
        body,
        "",
        "    error = None",
        "    try:",
        "        tests()",
        "    except Exception as exc:",
        "        error = traceback.format_exc(limit=-3)",
        "        if isinstance(exc, NameError):",
        '            error += "\\n" + MSG["not_run"]',
        "    _report(results, error, %r)" % fn,
        "",
        "_academy_run_tests()",
    ])


# ------------------------------------------------ visualizations (Python)

VIZ = {
    "bars": '''
steps = bubble_sort_steps(list(VIZ["input"]))
picks = sorted({round(i * (len(steps) - 1) / 11) for i in range(12)}) if len(steps) > 12 else list(range(len(steps)))
cols = min(6, len(picks)); rows = (len(picks) + cols - 1) // cols
fig, axes = plt.subplots(rows, cols, figsize=(2.3 * cols, 1.9 * rows), squeeze=False)
for ax in axes.flat:
    ax.axis("off")
for ax, i in zip(axes.flat, picks):
    ax.bar(range(len(steps[i])), steps[i], color="#8b5cf6" if i < len(steps) - 1 else "#10b981")
    ax.set_title("start" if i == 0 else f"swap {i}", fontsize=9)
fig.suptitle(f"{len(steps) - 1} swaps")
plt.tight_layout(); plt.show()
''',
    "grid": '''
grid = VIZ["grid"]
path = find_path([row[:] for row in grid])
fig, ax = plt.subplots(figsize=(5, 5))
ax.imshow(grid, cmap="Greys", vmin=0, vmax=1.4)
if path:
    ax.plot([c for r, c in path], [r for r, c in path], "-o", color="#8b5cf6", linewidth=3, markersize=5)
ax.set_title(f"{len(path)} cells" if path else "no path")
ax.set_xticks([]); ax.set_yticks([])
plt.show()
''',
    "knn": '''
train = VIZ["train"]
xs = [p["x"] for p in train]; ys = [p["y"] for p in train]
px, py = (max(xs) - min(xs)) * 0.12, (max(ys) - min(ys)) * 0.12
x0, x1, y0, y1 = min(xs) - px, max(xs) + px, min(ys) - py, max(ys) + py
cols, rows = 72, 48
heat = [[knn_predict(train, x0 + (c + 0.5) / cols * (x1 - x0), y1 - (r + 0.5) / rows * (y1 - y0), VIZ["k"])
         for c in range(cols)] for r in range(rows)]
fig, ax = plt.subplots(figsize=(7, 4.8))
ax.imshow(heat, extent=(x0, x1, y0, y1), cmap="coolwarm", alpha=0.35, aspect="auto", vmin=0, vmax=1)
ax.scatter(xs, ys, c=[p["label"] for p in train], cmap="coolwarm", edgecolors="black", s=60, vmin=0, vmax=1)
ax.set_title(f"decision regions of your k-NN (k = {VIZ['k']})")
plt.show()
''',
    "fitline": '''
points = VIZ["points"]
history = fit_line([list(p) for p in points])
xs = [p[0] for p in points]
fig, ax = plt.subplots(figsize=(7, 4.5))
ax.scatter(xs, [p[1] for p in points], color="#0f172a", zorder=3)
lo, hi = min(xs), max(xs)
for i, snap in enumerate(history):
    last = i == len(history) - 1
    ax.plot([lo, hi], [snap["w"] * lo + snap["b"], snap["w"] * hi + snap["b"]],
            color="#10b981" if last else "#8b5cf6", alpha=1 if last else 0.15 + 0.6 * i / len(history), linewidth=3 if last else 1)
final = history[-1]
ax.set_title(f"gradient descent: y = {final['w']:.2f}·x + {final['b']:.2f}")
plt.show()
''',
    "clusters": '''
points = VIZ["points"]
history = kmeans([list(p) for p in points], VIZ["k"], VIZ["iters"])
final = history[-1]
fig, ax = plt.subplots(figsize=(6.5, 4.5))
ax.scatter([p[0] for p in points], [p[1] for p in points], c=final["labels"], cmap="viridis", s=45)
for c in range(VIZ["k"]):
    trail = [step["centroids"][c] for step in history]
    ax.plot([t[0] for t in trail], [t[1] for t in trail], "-x", color="#ef4444", markersize=8)
ax.set_title(f"k-means after {len(history)} iterations: centroids' paths in red")
plt.show()
''',
    "sepline": '''
data = VIZ["data"]
history = train_perceptron([dict(p) for p in data], VIZ["epochs"])
xs = [p["x"] for p in data]
lo, hi = min(xs) - 1, max(xs) + 1
fig, ax = plt.subplots(figsize=(6.5, 4.5))
ax.scatter(xs, [p["y"] for p in data], c=[p["label"] for p in data], cmap="coolwarm", edgecolors="black", s=55, zorder=3)
for i, w in enumerate(history):
    last = i == len(history) - 1
    style = dict(color="#10b981" if last else "#8b5cf6", alpha=1 if last else 0.1 + 0.5 * i / len(history), linewidth=3 if last else 1)
    if abs(w["w2"]) > 1e-12:
        ax.plot([lo, hi], [-(w["w1"] * lo + w["b"]) / w["w2"], -(w["w1"] * hi + w["b"]) / w["w2"]], **style)
    elif abs(w["w1"]) > 1e-12:
        ax.axvline(-w["b"] / w["w1"], **style)
ax.set_ylim(min(p["y"] for p in data) - 1, max(p["y"] for p in data) + 1)
ax.set_title("the perceptron's boundary, epoch by epoch")
plt.show()
''',
    "xor": '''
net = train_xor()
cells, lo, hi = 56, -0.25, 1.25
heat = [[net["predict"](lo + (c + 0.5) / cells * (hi - lo), hi - (r + 0.5) / cells * (hi - lo)) for c in range(cells)]
        for r in range(cells)]
fig, (left, right) = plt.subplots(1, 2, figsize=(10, 4.2))
left.imshow(heat, extent=(lo, hi, lo, hi), cmap="coolwarm", vmin=0, vmax=1)
left.scatter([0, 1, 0, 1], [0, 1, 1, 0], c=[0, 0, 1, 1], cmap="coolwarm", edgecolors="black", s=120, vmin=0, vmax=1)
left.set_title("your network's output over the input square")
right.plot(net["loss_history"], color="#8b5cf6")
right.set_title("loss per epoch"); right.set_xlabel("epoch")
plt.tight_layout(); plt.show()
''',
}


def viz_cell(ui, viz):
    config = {k: v for k, v in viz.items() if k != "kind"}
    return "\n".join([
        '#@title %s { display-mode: "form" }' % MSG[ui]["viz_title"],
        "import json",
        "import matplotlib.pyplot as plt",
        "VIZ = json.loads(" + raw(json.dumps(config)) + ")",
        VIZ[viz["kind"]].strip("\n"),
    ])


# --------------------------------------------------------------- notebooks

def exercise_notebook(ui, *, heading, context, body_md, item, hints, viz=None, credit=None):
    msg = MSG[ui]
    first = ["# " + heading, "*" + context + "*", body_md, "> " + msg["save"] + "\n>\n> " + msg["done"]]
    if credit:
        first.append(credit)
    cells = [
        md_cell("\n\n".join(first)),
        md_cell(msg["code"] + "\n\n" + msg["code_py"]),
        code_cell(item["starter"]),
        md_cell(msg["check"] + "\n\n" + msg["check_text"]),
        code_cell(python_tests_cell(ui, item["tests"], item.get("fnName") or ""), form=True),
    ]
    if hints:
        cells.append(md_cell(hints_md(msg, hints)))
    if viz:
        cells += [md_cell(msg["viz"] + "\n\n" + msg["viz_text"]), code_cell(viz_cell(ui, viz), form=True)]
    return notebook(cells)


def build(data):
    """{relative path: notebook} for every exercise, in both languages."""
    books = {}
    for ui in ("en", "hy"):
        msg = MSG[ui]
        for kind, items in (("lab", data["lab"]), ("mission", data["missions"])):
            for item in items:
                books["%s/%s.ipynb" % (ui, item["id"])] = exercise_notebook(
                    ui, heading=pick(item, "title", ui), context="1991 Academy · " + msg["kind_" + kind],
                    body_md=markdown(pick(item, "brief", ui)), item=item,
                    hints=(item.get("hints_hy") if ui == "hy" and item.get("hints_hy") else item.get("hints")) or [],
                    viz=item.get("viz"))
        for ex in data["lessons"]:
            books["%s/%s.ipynb" % (ui, ex["id"])] = exercise_notebook(
                ui, heading=pick(ex, "title", ui),
                context="1991 Academy · %s · %s" % (msg["kind_lesson"], pick(ex, "lessonTitle", ui)),
                body_md=html.unescape(pick(ex, "prompt", ui)), item=ex, hints=[],
                credit=msg["credit"].format(source=ex["source"]) if ex.get("source") else None)
    return books


def render(book):
    return json.dumps(book, indent=1, ensure_ascii=False) + "\n"


def site_data():
    proc = subprocess.run(["node", str(ROOT / "tools" / "site_data.js")], capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def main():
    books = build(site_data())
    for old in OUT.glob("*/*.ipynb"):
        if str(old.relative_to(OUT)) not in books:
            old.unlink()
    for rel, book in books.items():
        path = OUT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        text = render(book)
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8")
    print("%d notebooks in %s" % (len(books), OUT.relative_to(ROOT)))


if __name__ == "__main__":
    sys.exit(main())
