import { describe, expect, it } from 'vitest'
import { formatEnergy, formatNumber, formatPower, formatVolume } from './format'

describe('formatNumber', () => {
  it('rounds and adds thousands separators', () => {
    expect(formatNumber(1234567.8)).toBe('1,234,568')
  })
  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatPower', () => {
  it('uses kW below one megawatt', () => {
    expect(formatPower(0.25)).toBe('250 kW')
  })
  it('uses MW from one megawatt', () => {
    expect(formatPower(1.5)).toBe('1.50 MW')
  })
  it('handles zero', () => {
    expect(formatPower(0)).toBe('0 kW')
  })
})

describe('formatEnergy', () => {
  it('uses kWh below 1,000', () => {
    expect(formatEnergy(850)).toBe('850 kWh')
  })
  it('uses MWh from 1,000 kWh', () => {
    expect(formatEnergy(36000)).toBe('36.0 MWh')
  })
  it('uses GWh from 1,000 MWh', () => {
    expect(formatEnergy(2_500_000)).toBe('2.50 GWh')
  })
  it('handles zero', () => {
    expect(formatEnergy(0)).toBe('0 kWh')
  })
})

describe('formatVolume', () => {
  it('uses litres below 1,000', () => {
    expect(formatVolume(640)).toBe('640 L')
  })
  it('uses cubic metres from 1,000 L', () => {
    expect(formatVolume(97_200)).toBe('97.2 m³')
  })
  it('handles zero', () => {
    expect(formatVolume(0)).toBe('0 L')
  })
})
