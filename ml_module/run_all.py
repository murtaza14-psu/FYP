"""Run the whole pipeline: five models, then the comparison.

    python ml_module/run_all.py            # everything
    python ml_module/run_all.py m1 m3      # only some models (prefix match), then compare

Each step runs as a separate Python process with a fixed argument list (no shell).
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEPS = ["m1_linear", "m2_random_forest", "m3_gradient_boosting", "m4_svr", "m5_neural_network"]


def main(argv: list[str]) -> int:
    chosen = [s for s in STEPS if not argv or any(s.startswith(a) for a in argv)]
    if not chosen:
        print(f"no model matches {argv}; choose from {STEPS}")
        return 2
    for step in chosen + ["compare"]:
        print(f"\n########## {step} ##########", flush=True)
        code = subprocess.run([sys.executable, str(HERE / f"{step}.py")], cwd=HERE).returncode
        if code:
            print(f"{step} failed with exit code {code}")
            return code
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
