"""
AegisOne Blind Holdout Evaluation Runner

This script executes the frozen v0.9 AegisOne architecture against the holdout dataset.
Under NO circumstances should the codebase be tuned or modified to improve the score
of this evaluation script. This is an immutable test of generalization.
"""

import subprocess
import sys

def main():
    print("===============================================================")
    print("⚠️  INITIATING AEGISONE BLIND HOLDOUT EVALUATION ⚠️")
    print("===============================================================")
    print("Rule 1: The detection engine is FROZEN.")
    print("Rule 2: Do not tune heuristics against this dataset.")
    print("Rule 3: All scores produced are final.\n")

    cmd = [sys.executable, "tests/run_real_extension_tests.py", "--dataset", "holdout"]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Evaluation failed to execute: {e}")
        sys.exit(e.returncode)
    except KeyboardInterrupt:
        print("\nEvaluation aborted by user.")
        sys.exit(1)

if __name__ == "__main__":
    main()
