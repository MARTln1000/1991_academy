"""The Google Colab notebooks: one per coding exercise (tools/build_notebooks.py).

- They are up to date with the exercises in js/data/ (`make notebooks`).
- Every exercise is Python: nothing in JavaScript or C++ is left.
- Run the way Colab runs them, with a reference solution in the code cell
  (tests/content/solutions/<id>.py) every test passes; with the starter code,
  they don't all pass yet. So the tests are right, solvable, and actually test
  something.
- The Lab visualizations run on the reference solutions.

"The way Colab runs them": code cells run in order in one Python namespace.
Needs Node.js (tools/site_data.js reads the exercises), and matplotlib for the
visualizations.
"""
import contextlib
import io
import json
import os
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build_notebooks  # noqa: E402

SOLUTIONS = Path(__file__).parent / "content" / "solutions"
NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(NODE is None, reason="needs Node.js")

IDS = sorted(p.stem for p in SOLUTIONS.glob("*.py"))


@pytest.fixture(scope="module")
def data():
    return build_notebooks.site_data()


def load(ui, name):
    return json.loads((build_notebooks.OUT / ui / name).read_text(encoding="utf-8"))


def run_notebook(book, workdir, code=None, viz=False):
    """Run a notebook's code cells in order, as Colab would; `code` replaces
    the learner's code cell. Returns everything the cells printed."""
    ns = {"__name__": "__main__"}
    printed = io.StringIO()
    first_code = True
    cwd = os.getcwd()
    os.chdir(workdir)
    try:
        for cell in book["cells"]:
            if cell["cell_type"] != "code":
                continue
            source = "".join(cell["source"])
            if first_code and code is not None:
                source = code
            first_code = False
            if "matplotlib" in source and not viz:
                continue
            with contextlib.redirect_stdout(printed):
                exec(compile(source, "<cell>", "exec"), ns)
    finally:
        os.chdir(cwd)
    return printed.getvalue()


def all_pass(ui):
    return build_notebooks.MSG[ui]["all_pass"].split("{n}")[0]


def test_notebooks_are_up_to_date(data):
    books = build_notebooks.build(data)
    on_disk = {str(p.relative_to(build_notebooks.OUT)) for p in build_notebooks.OUT.glob("*/*.ipynb")}
    assert on_disk == set(books), "run `make notebooks`"
    stale = [rel for rel, book in books.items()
             if (build_notebooks.OUT / rel).read_text(encoding="utf-8") != build_notebooks.render(book)]
    assert stale == [], "run `make notebooks`: out of date: %s" % stale[:5]


def test_every_exercise_is_python(data):
    items = data["lab"] + data["missions"]
    assert len(items) == 16
    for item in items + data["lessons"]:
        assert "def " in item["starter"] or "class " in item["starter"], item["id"]
    for item in items:
        assert (SOLUTIONS / (item["id"] + ".py")).exists(), "%s: no reference solution" % item["id"]
    # no JavaScript or C++ exercises anywhere
    leftovers = [p.name for p in SOLUTIONS.iterdir() if p.suffix != ".py"]
    leftovers += [str(p) for p in build_notebooks.OUT.glob("*/*-*.ipynb") if p.stem.endswith(("-javascript", "-cpp", "-python"))]
    leftovers += [p.name for p in (ROOT / "js" / "data").iterdir() if p.stem.endswith(("-py", "-cpp"))]
    assert leftovers == []


@pytest.mark.parametrize("pid", IDS)
def test_reference_solution_passes_in_the_notebook(tmp_path, pid):
    out = run_notebook(load("en", pid + ".ipynb"), tmp_path, (SOLUTIONS / (pid + ".py")).read_text())
    assert all_pass("en") in out, out
    assert "✗" not in out and "💥" not in out, out


@pytest.mark.parametrize("pid", IDS)
def test_starter_runs_but_does_not_pass(tmp_path, pid):
    out = run_notebook(load("en", pid + ".ipynb"), tmp_path)
    assert all_pass("en") not in out, out
    assert "SyntaxError" not in out, out


@pytest.mark.parametrize("pid", IDS)
def test_armenian_notebooks_work_too(tmp_path, pid):
    out = run_notebook(load("hy", pid + ".ipynb"), tmp_path, (SOLUTIONS / (pid + ".py")).read_text())
    assert all_pass("hy") in out, out


def test_lesson_exercise_notebooks_run(tmp_path, data):
    assert len(data["lessons"]) >= 20
    for ex in data["lessons"]:
        if "numpy" in ex["starter"] + ex["tests"]:
            pytest.importorskip("numpy")
        out = run_notebook(load("en", ex["id"] + ".ipynb"), tmp_path)
        assert "✗" in out or "💥" in out, (ex["id"], out)    # the starter doesn't solve it...
        assert "NameError" not in out, (ex["id"], out)       # ...but the tests find its function
        hy = load("hy", ex["id"] + ".ipynb")
        assert "FAST Foundation" in "".join(hy["cells"][0]["source"])


@pytest.mark.filterwarnings("ignore:FigureCanvasAgg is non-interactive")
@pytest.mark.parametrize("pid", ["lab-sort-steps", "lab-bfs-path", "lab-knn", "lab-linreg", "lab-kmeans",
                                 "lab-perceptron", "lab-mlp-xor"])
def test_python_visualizations_run(tmp_path, pid):
    matplotlib = pytest.importorskip("matplotlib")
    matplotlib.use("Agg", force=True)   # draw off-screen: plt.show() must not open a window
    book = load("en", pid + ".ipynb")
    assert any("matplotlib" in "".join(c["source"]) for c in book["cells"])
    run_notebook(book, tmp_path, (SOLUTIONS / (pid + ".py")).read_text(), viz=True)
