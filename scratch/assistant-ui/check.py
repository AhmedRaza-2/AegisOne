"""Run the current automatic-assistant browser smoke check."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name("professional-check.py")), run_name="__main__")
