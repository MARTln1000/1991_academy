"""Point the app at a temporary database before app.py is imported."""
import os
import tempfile

os.environ.setdefault("ACADEMY_DB", os.path.join(tempfile.gettempdir(), "academy_test_import.db"))
os.environ["ACADEMY_DEBUG"] = "1"
