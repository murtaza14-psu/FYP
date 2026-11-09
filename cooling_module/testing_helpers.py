"""Helpers shared by the tests: build a few hand-picked hours of weather without the CSV."""
import numpy as np

from cooling_module.weather import Weather


def hours(wet_bulb, dry_bulb=25.0, rh=60.0, p=100.2) -> Weather:
    wb = np.atleast_1d(np.asarray(wet_bulb, dtype=float))
    n = wb.shape[0]
    return Weather(month=np.full(n, 7), day=np.ones(n, dtype=int), hour=np.ones(n, dtype=int),
                   dry_bulb_c=np.broadcast_to(np.asarray(dry_bulb, dtype=float), (n,)).copy(),
                   dew_point_c=np.full(n, 10.0), rel_humidity_pct=np.full(n, float(rh)),
                   pressure_kpa=np.full(n, float(p)), wet_bulb_c=wb, site={})
