"""Run the dependency-free frontend regressions with the normal pytest suite."""
from pathlib import Path
import shutil
import subprocess

import pytest


@pytest.mark.skipif(shutil.which('node') is None, reason='Node.js is required')
def test_frontend_regressions():
    result = subprocess.run(['node', 'tests/frontend.test.cjs'], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert '# tests 5' in result.stdout, result.stdout
