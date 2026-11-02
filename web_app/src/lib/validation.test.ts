import { describe, expect, it } from 'vitest'
import type { RawPredictionInput } from '../types/analysis'
import { operatingHoursPerYear, validatePredictionInput } from './validation'

const valid: RawPredictionInput = {
  gpuCount: '512',
  smUtilPercent: '60',
  memUtilPercent: '30',
  hoursPerDay: '12',
  daysPerYear: '365',
}

const withField = (patch: Partial<RawPredictionInput>): RawPredictionInput => ({ ...valid, ...patch })

describe('validatePredictionInput', () => {
  it('parses valid input into numbers', () => {
    const { values, errors } = validatePredictionInput(valid)
    expect(errors).toEqual({})
    expect(values).toEqual({ gpuCount: 512, smUtilPercent: 60, memUtilPercent: 30, hoursPerDay: 12, daysPerYear: 365 })
  })

  it('trims whitespace and accepts decimals for utilisation and hours', () => {
    const { values } = validatePredictionInput(
      withField({ gpuCount: ' 8 ', smUtilPercent: '55.5', memUtilPercent: '0.5', hoursPerDay: '7.5' }),
    )
    expect(values).toMatchObject({ gpuCount: 8, smUtilPercent: 55.5, memUtilPercent: 0.5, hoursPerDay: 7.5 })
  })

  it.each(['0', '-4', '2.5', '100001'])('rejects GPU count %s', (gpuCount) => {
    expect(validatePredictionInput(withField({ gpuCount })).errors.gpuCount).toBeDefined()
  })

  it('accepts GPU count boundaries', () => {
    expect(validatePredictionInput(withField({ gpuCount: '1' })).errors.gpuCount).toBeUndefined()
    expect(validatePredictionInput(withField({ gpuCount: '100000' })).errors.gpuCount).toBeUndefined()
  })

  it.each(['smUtilPercent', 'memUtilPercent'] as const)('rejects %s outside 0–100', (field) => {
    for (const bad of ['-1', '100.5', '101']) {
      expect(validatePredictionInput(withField({ [field]: bad })).errors[field]).toBeDefined()
    }
  })

  it.each(['smUtilPercent', 'memUtilPercent'] as const)('accepts %s boundaries 0 and 100', (field) => {
    for (const ok of ['0', '100']) {
      expect(validatePredictionInput(withField({ [field]: ok })).errors[field]).toBeUndefined()
    }
  })

  it.each(['0', '-1', '24.5', '25'])('rejects hours per day %s', (hoursPerDay) => {
    expect(validatePredictionInput(withField({ hoursPerDay })).errors.hoursPerDay).toBeDefined()
  })

  it('accepts 24 hours per day', () => {
    expect(validatePredictionInput(withField({ hoursPerDay: '24' })).errors.hoursPerDay).toBeUndefined()
  })

  it.each(['0', '367', '10.5', '-3'])('rejects days per year %s', (daysPerYear) => {
    expect(validatePredictionInput(withField({ daysPerYear })).errors.daysPerYear).toBeDefined()
  })

  it('accepts 1 and 366 days per year', () => {
    expect(validatePredictionInput(withField({ daysPerYear: '1' })).errors.daysPerYear).toBeUndefined()
    expect(validatePredictionInput(withField({ daysPerYear: '366' })).errors.daysPerYear).toBeUndefined()
  })

  it('gives clear messages for empty and non-numeric values', () => {
    const result = validatePredictionInput(withField({ gpuCount: '', smUtilPercent: 'abc', memUtilPercent: '  ' }))
    expect(result.errors.gpuCount).toMatch(/required/i)
    expect(result.errors.smUtilPercent).toMatch(/number/i)
    expect(result.errors.memUtilPercent).toMatch(/required/i)
  })

  it('rejects Infinity and NaN text', () => {
    expect(validatePredictionInput(withField({ smUtilPercent: 'Infinity' })).errors.smUtilPercent).toBeDefined()
    expect(validatePredictionInput(withField({ memUtilPercent: 'NaN' })).errors.memUtilPercent).toBeDefined()
  })

  it('reports every invalid field at once and returns no values', () => {
    const result = validatePredictionInput({
      gpuCount: '0',
      smUtilPercent: '-1',
      memUtilPercent: '200',
      hoursPerDay: '0',
      daysPerYear: '0',
    })
    expect(result.values).toBeUndefined()
    expect(Object.keys(result.errors).sort()).toEqual(
      ['daysPerYear', 'gpuCount', 'hoursPerDay', 'memUtilPercent', 'smUtilPercent'].sort(),
    )
  })
})

describe('operatingHoursPerYear', () => {
  it('multiplies hours per day by days per year', () => {
    expect(
      operatingHoursPerYear({ gpuCount: 1, smUtilPercent: 1, memUtilPercent: 1, hoursPerDay: 12, daysPerYear: 365 }),
    ).toBe(4380)
  })
})
