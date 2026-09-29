"""Run algorithm trace reference checks with the regular backend test suite."""
from pathlib import Path
import shutil
import subprocess

import pytest


@pytest.mark.skipif(shutil.which('node') is None, reason='Node.js is required')
def test_dsa_trace_regressions():
    result = subprocess.run(
        ['node', 'tests/dsa-traces.test.cjs'],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert '# tests 7' in result.stdout, result.stdout
