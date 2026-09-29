"""Run dependency-free DSA store regressions in the normal test suite."""
from pathlib import Path
import shutil
import subprocess

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is required")
def test_dsa_store_regressions():
    result = subprocess.run(["node", "tests/dsa-store.test.cjs"], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "# tests 8" in result.stdout, result.stdout
