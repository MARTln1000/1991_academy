"""Test configuration — point the app at a throwaway DB and disable the C++
runner BEFORE app.py is imported, so tests never touch 1991_academy.db."""
import os
import tempfile

os.environ.setdefault("ACADEMY_DB", os.path.join(tempfile.gettempdir(), "academy_test_import.db"))
os.environ["ACADEMY_CPP"] = "0"
os.environ["ACADEMY_DEBUG"] = "1"
