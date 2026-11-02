"""Export the five-model ensemble as a single .pkl file.

    python ml_module/export_pkl.py [output.pkl]      # default: ml_module/artifacts/annual_heat_ensemble.pkl

Writes the .pkl and a .sha256 beside it. Load it again with HeatPipeline.load_bundle(path).
"""

from __future__ import annotations

import sys

from pipeline import DEFAULT_BUNDLE, HeatPipeline

if __name__ == "__main__":
    out = HeatPipeline.load().save_bundle(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BUNDLE)
    print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB) and {out.name}.sha256")
