"""Every Lab problem and every mission, in every language, against its own tests.

- Each one exists in JavaScript, Python and C++.
- A reference solution (tests/content/solutions/<id>.<js|py|cpp>) passes every
  test, with no error: the tests are right, and solvable as the brief says.
- The starter code runs (in C++: compiles) but does NOT pass every test: the
  tests actually test something.
- A language-specific hint comes in English and Armenian.

Everything runs through the site's own runners: JavaScript through js/runner.js
in Node, Python through the driver js/runner.js loads into Pyodide (here in
CPython), C++ through app.py's harness and runner/cpp_runner.py. Needs Node.js,
and a C++ compiler for the C++ cases (skipped without one).
"""
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path

import pytest

import app

HERE = Path(__file__).parent
ROOT = HERE.parent
SOLUTIONS = HERE / "content" / "solutions"
NODE = shutil.which("node")
EXT = {"javascript": ".js", "python": ".py", "cpp": ".cpp"}

CASES = sorted((p.stem, lang) for p in SOLUTIONS.iterdir() for lang, ext in EXT.items() if p.suffix == ext)
IDS = sorted({pid for pid, _ in CASES})

pytestmark = pytest.mark.skipif(NODE is None, reason="needs Node.js to load the site's data")


def node(*args, stdin=None):
    proc = subprocess.run([NODE, str(HERE / "content" / "problems.js"), *args], input=stdin,
                          capture_output=True, text=True, timeout=300)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


@pytest.fixture(scope="module")
def site():
    dump = node("dump")
    driver = {}
    exec(compile(dump["pyDriver"], "runner.js:PY_DRIVER", "exec"), driver)
    return {"items": {item["id"]: item for item in dump["items"]}, "run_py": driver["__academy_run"]}


@pytest.fixture(scope="module")
def cpp_runner():
    spec = importlib.util.spec_from_file_location("cpp_runner", ROOT / "runner" / "cpp_runner.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if module.CXX is None:
        pytest.skip("no C++ compiler")
    return module


def run(site, request, lang, variant, code):
    if lang == "javascript":
        return node("run-js", stdin=json.dumps([{"code": code, "tests": variant["tests"]}]))[0]
    if lang == "python":
        return json.loads(site["run_py"](code, variant["tests"], "tests"))
    runner = request.getfixturevalue("cpp_runner")
    program = app.build_cpp_program(code, variant["tests"], variant.get("prelude", ""))
    return app.cpp_response(runner.run_local(program))


def test_every_problem_is_in_all_three_languages(site):
    assert len(site["items"]) == 16   # 10 Lab problems + 6 missions
    for pid, item in site["items"].items():
        for lang in EXT:
            assert item[lang], f"{pid} has no {lang} version"
            assert (SOLUTIONS / (pid + EXT[lang])).exists(), f"{pid}: no reference solution in {lang}"


@pytest.mark.parametrize("pid,lang", CASES)
def test_reference_solution_passes_every_test(site, request, pid, lang):
    variant = site["items"][pid][lang]
    out = run(site, request, lang, variant, (SOLUTIONS / (pid + EXT[lang])).read_text())
    assert not out.get("error"), out["error"]
    assert len(out["results"]) >= 3, out["results"]
    assert [r["name"] for r in out["results"] if not r["pass"]] == [], out["results"]


@pytest.mark.parametrize("pid,lang", CASES)
def test_starter_runs_but_does_not_pass(site, request, pid, lang):
    variant = site["items"][pid][lang]
    out = run(site, request, lang, variant, variant["starter"])
    error = out.get("error") or {}
    assert error.get("kind") != "compile", error.get("detail")
    assert error.get("type") not in ("SyntaxError", "IndentationError"), error
    assert error or not all(r["pass"] for r in out["results"]), "the starter already passes every test"


@pytest.mark.parametrize("pid", IDS)
def test_language_hints_come_in_both_languages(site, pid):
    for lang in ("python", "cpp"):
        variant = site["items"][pid][lang]
        if variant.get("hint"):
            assert variant.get("hint_hy"), f"{pid} ({lang}): hint without an Armenian hint_hy"
            assert any("Ա" <= ch <= "֏" for ch in variant["hint_hy"]), f"{pid} ({lang}): hint_hy isn't Armenian"
