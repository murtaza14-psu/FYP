"""Command line: describe the data centre, get the annual heat.

    python ml_module/estimate.py                      # asks for each value
    python ml_module/estimate.py --gpus 500 --sm-util 60 --mem-util 30 --hours-per-day 12
    python ml_module/estimate.py --gpus 500 --sm-util 60 --mem-util 30 --json
"""

from __future__ import annotations

import argparse
import json
import sys

from pipeline import DataCenter, HeatPipeline, InputError

FIELDS = [
    ("gpus", "Number of GPUs", int, None),
    ("sm_util", "Average SM (compute) utilisation, % (0-100)", float, None),
    ("mem_util", "Average memory utilisation, % (0-100)", float, None),
    ("hours_per_day", "Hours per day the GPUs are in use", float, 24.0),
    ("days_per_year", "Days per year they are in use", int, 365),
]


def _ask(label: str, kind, default):
    suffix = f" [{default:g}]" if default is not None else ""
    while True:
        raw = input(f"{label}{suffix}: ").strip()
        if raw == "" and default is not None:
            return default
        try:
            return kind(raw)
        except ValueError:
            print("  Please enter a number.")


def _format(r: dict) -> str:
    g, h, a, i = r["per_gpu"], r["heat_load_mw"], r["annual_heat_mwh"], r["input"]
    lines = [
        "",
        f"{i['n_gpus']:,} GPUs  |  SM {i['sm_util_pct']:g}%  |  memory {i['mem_util_pct']:g}%  |  "
        f"{i['hours_per_day']:g} h/day x {i['days_per_year']} days",
        "-" * 72,
        f"Power per GPU      {g['expected_w']:7.1f} W   (90% band {g['low_w']:.1f} - {g['high_w']:.1f} W)",
        f"Heat load          {h['expected']:7.3f} MW  (90% band {h['low']:.3f} - {h['high']:.3f} MW)",
        f"Operating hours    {r['operating_hours_per_year']:,.0f} h/year",
        "",
        f"ANNUAL HEAT        {a['expected']:,.0f} MWh  ({r['annual_heat_gwh_expected']:,.2f} GWh)",
        f"  planning range   {a['low']:,.0f} - {a['high']:,.0f} MWh  (90%, every GPU off the same way)",
        f"  optimistic range {a['independent_gpu_low']:,.0f} - {a['independent_gpu_high']:,.0f} MWh  (GPU errors cancel)",
        "",
        "Models: " + ", ".join(f"{k.split('_', 1)[1]} {v:.0f} W" for k, v in g["per_model_w"].items()),
    ]
    lines += [f"! {w}" for w in r["warnings"]]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Annual heat of a GPU data centre from the five-model ensemble.")
    p.add_argument("--gpus", type=int)
    p.add_argument("--sm-util", type=float, dest="sm_util")
    p.add_argument("--mem-util", type=float, dest="mem_util")
    p.add_argument("--hours-per-day", type=float, dest="hours_per_day")
    p.add_argument("--days-per-year", type=int, dest="days_per_year")
    p.add_argument("--json", action="store_true", help="print the full result as JSON")
    args = p.parse_args(argv)

    given = {k: getattr(args, k) for k, *_ in FIELDS}
    required_missing = [k for k, _, _, d in FIELDS if d is None and given[k] is None]
    if required_missing and not sys.stdin.isatty():
        p.error("missing: " + ", ".join("--" + k.replace("_", "-") for k in required_missing))
    interactive = required_missing and sys.stdin.isatty()
    for key, label, kind, default in FIELDS:
        if given[key] is None:
            given[key] = _ask(label, kind, default) if interactive else default

    try:
        dc = DataCenter(n_gpus=given["gpus"], sm_util_pct=given["sm_util"], mem_util_pct=given["mem_util"],
                        hours_per_day=given["hours_per_day"], days_per_year=given["days_per_year"])
        result = HeatPipeline.load().estimate(dc)
    except (InputError, FileNotFoundError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    print(json.dumps(result, indent=2) if args.json else _format(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
