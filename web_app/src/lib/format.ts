const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Rounds to a readable precision: 2 decimals under 10, 1 under 100, none above. */
function readable(n: number): string {
  if (n < 10) return n.toFixed(2)
  if (n < 100) return n.toFixed(1)
  return integer.format(n)
}

export function formatNumber(n: number): string {
  return integer.format(n)
}

/** Formats a power given in megawatts. */
export function formatPower(megawatts: number): string {
  if (megawatts >= 1) return `${readable(megawatts)} MW`
  return `${integer.format(megawatts * 1000)} kW`
}

/** Formats an energy given in kilowatt-hours. */
export function formatEnergy(kWh: number): string {
  if (kWh >= 1_000_000) return `${readable(kWh / 1_000_000)} GWh`
  if (kWh >= 1000) return `${readable(kWh / 1000)} MWh`
  return `${integer.format(kWh)} kWh`
}

/** Formats a volume given in litres. */
export function formatVolume(litres: number): string {
  if (litres >= 1000) return `${readable(litres / 1000)} m³`
  return `${integer.format(litres)} L`
}
