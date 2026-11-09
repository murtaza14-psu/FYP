"""Every constant from docs/Cooling_Equations_Summary.pdf, in SI units, in three scenarios.

The PDF lists three values for some parameters ("1.25 / 0.75 / 0.50"). They are a range, ordered
worst case first: HIGH USE (most resources), TYPICAL, LOW USE (fewest resources). See PLAN.md D3.

Imperial inputs of the PDF (degF, gpm, W/cfm, tons) are converted once, here. Derived values
(efan, kpump, ktower, kcw) are computed from the PDF's own formulas rather than typed in, and the
tests check them against the numbers printed in the PDF.
"""

from __future__ import annotations

from dataclasses import dataclass

# ----------------------------------------------------------------------------- conversions
KW_PER_TON = 3.517          # 1 ton of cooling = 3.517 kW
BTUH_PER_KW = 3.412         # kW -> Btu/h
AIR_HEAT_CONSTANT = 1.08    # Btu/(h.cfm.degF), heat-carrying constant of air
KW_PER_HP = 0.7457
KJ_PER_KWH = 3600.0


def df_to_k(delta_f: float) -> float:
    """A temperature DIFFERENCE in degF as kelvin."""
    return delta_f * 5.0 / 9.0


def k_to_df(delta_k: float) -> float:
    return delta_k * 9.0 / 5.0


def f_to_c(t_f: float) -> float:
    """A temperature (not a difference) in degF as degC."""
    return (t_f - 32.0) * 5.0 / 9.0


SCENARIOS = ("high_use", "typical", "low_use")


# ----------------------------------------------------------------------------- cooling tower
@dataclass(frozen=True)
class TowerParams:
    """Cooling-tower water balance (PDF sections 2 and 4, plus blowdown which the PDF leaves out)."""

    a_tower_k: float = df_to_k(7)          # approach of the tower water to wet-bulb
    a_hx_k: float = df_to_k(3)             # extra gap lost in the heat exchanger
    delta_t_range_k: float = df_to_k(10)   # water cooled by the tower
    drift_fraction: float = 0.0005 / 100   # share of circulating water blown out as droplets
    cp_kj_per_kg_k: float = 4.186          # specific heat of water
    cycles_of_concentration: float = 4.0   # ASSUMPTION (not in the PDF): blowdown = evaporation/(COC-1) - drift


TOWER = TowerParams()


# ----------------------------------------------------------------------------- air side (PDF section 1)
@dataclass(frozen=True)
class AirParams:
    """Chilled-water air-cooling system. Also used for the small air system inside direct-to-chip."""

    sfp_w_per_cfm: float        # air-handler fan power per unit airflow: 1.25 / 0.75 / 0.50
    k_ch_kw_per_ton: float      # chiller electricity per ton: 0.560 / 0.500 / 0.500
    delta_t_air_k: float = df_to_k(20)   # air temperature rise through the servers
    eta_ups: float = 0.95                # UPS efficiency; its losses also become heat
    t_supply_c: float = f_to_c(55)       # chilled-water supply temperature Ts
    delta_t_chw_k: float = df_to_k(10)   # chilled-water temperature rise
    w_chw_w_per_gpm: float = 22.0        # pump power per unit flow, chilled-water loop
    w_cw_w_per_gpm: float = 19.0         # pump power per unit flow, cooling-tower loop
    g_cw_gpm_per_ton: float = 3.0        # tower water flow per ton
    r_tower_gpm_per_hp: float = 38.2     # tower fan efficiency

    @property
    def e_fan(self) -> float:
        """efan = 3.412 x SFP / (1.08 x dT_air[degF]): fan kWh per kWh of server heat."""
        return BTUH_PER_KW * self.sfp_w_per_cfm / (AIR_HEAT_CONSTANT * k_to_df(self.delta_t_air_k))

    @property
    def chw_gpm_per_ton(self) -> float:
        """24 / dT_chw[degF] = 2.4 gpm of chilled water per ton."""
        return 24.0 / k_to_df(self.delta_t_chw_k)

    @property
    def k_pump(self) -> float:
        """kpump = (wchw x 24/dTchw + wcw x gcw) / 1000 = 0.1098 kW/ton (chilled-water and tower pumps)."""
        return (self.w_chw_w_per_gpm * self.chw_gpm_per_ton + self.w_cw_w_per_gpm * self.g_cw_gpm_per_ton) / 1000.0

    @property
    def k_tower(self) -> float:
        """ktower = 0.7457 x gcw / rtower = 0.0586 kW/ton (tower fans)."""
        return KW_PER_HP * self.g_cw_gpm_per_ton / self.r_tower_gpm_per_hp

    @property
    def k_cw(self) -> float:
        """Tower-water pumps alone: wcw x gcw / 1000 = 0.057 kW/ton (used on the liquid side of direct-to-chip)."""
        return self.w_cw_w_per_gpm * self.g_cw_gpm_per_ton / 1000.0


AIR = {
    "high_use": AirParams(sfp_w_per_cfm=1.25, k_ch_kw_per_ton=0.560),
    "typical": AirParams(sfp_w_per_cfm=0.75, k_ch_kw_per_ton=0.500),
    "low_use": AirParams(sfp_w_per_cfm=0.50, k_ch_kw_per_ton=0.500),
}


# ----------------------------------------------------------------------------- direct-to-chip (PDF section 3)
@dataclass(frozen=True)
class D2CParams:
    f_cap: float                 # share of server heat captured by the cold plates: 0.70 / 0.80 / 0.94
    t_fws_c: float               # building-water supply temperature: 27 / 32 / 40 degC
    r_dry: float                 # dry-cooler heat removed per unit of fan electricity: 45 / 70 / 110
    air: AirParams               # the small air system for the heat the cold plates miss
    e_cdu: float = 0.00612       # coolant-distribution-unit pump kWh per kWh of liquid heat
    e_fws: float = 0.00527       # building-water pump kWh per kWh of liquid heat
    delta_t_fws_k: float = 14.1  # building-water temperature rise (already in kelvin in the PDF)
    a_dry_k: float = 10.0        # dry-cooler approach to outdoor air temperature

    @property
    def k_ch_kw_per_ton(self) -> float:
        return self.air.k_ch_kw_per_ton

    @property
    def t_return_c(self) -> float:
        return self.t_fws_c + self.delta_t_fws_k


D2C = {
    "high_use": D2CParams(f_cap=0.70, t_fws_c=27.0, r_dry=45.0, air=AIR["high_use"]),
    "typical": D2CParams(f_cap=0.80, t_fws_c=32.0, r_dry=70.0, air=AIR["typical"]),
    "low_use": D2CParams(f_cap=0.94, t_fws_c=40.0, r_dry=110.0, air=AIR["low_use"]),
}
