import { describe, expect, it } from 'vitest'
import type { RawPredictionInput } from '../types/analysis'
import { validatePredictionInput } from './validation'

const valid: RawPredictionInput = {
  taskType: 'training',
  gpuCount: '512',
  durationHours: '72',
  utilizationPercent: '85',
}

const withField = (patch: Partial<RawPredictionInput>): RawPredictionInput => ({ ...valid, ...patch })

describe('validatePredictionInput', () => {
  it('accepts valid input and returns parsed numbers', () => {
    const result = validatePredictionInput(valid)
    expect(result.errors).toEqual({})
    expect(result.values).toEqual({
      taskType: 'training',
      gpuCount: 512,
      durationHours: 72,
      utilizationPercent: 85,
    })
  })

  it('accepts decimal durations', () => {
    expect(validatePredictionInput(withField({ durationHours: '1.5' })).values?.durationHours).toBe(1.5)
  })

  it('requires a task type', () => {
    const result = validatePredictionInput(withField({ taskType: '' }))
    expect(result.errors.taskType).toBeDefined()
    expect(result.values).toBeUndefined()
  })

  it('rejects an unknown task type', () => {
    expect(validatePredictionInput(withField({ taskType: 'mining' })).errors.taskType).toBeDefined()
  })

  it.each(['0', '-4', '2.5', '100001'])('rejects GPU count %s', (gpuCount) => {
    expect(validatePredictionInput(withField({ gpuCount })).errors.gpuCount).toBeDefined()
  })

  it('accepts the GPU count bounds', () => {
    expect(validatePredictionInput(withField({ gpuCount: '1' })).errors.gpuCount).toBeUndefined()
    expect(validatePredictionInput(withField({ gpuCount: '100000' })).errors.gpuCount).toBeUndefined()
  })

  it.each(['0', '-1', '8761'])('rejects duration %s', (durationHours) => {
    expect(validatePredictionInput(withField({ durationHours })).errors.durationHours).toBeDefined()
  })

  it('accepts the duration upper bound', () => {
    expect(validatePredictionInput(withField({ durationHours: '8760' })).errors.durationHours).toBeUndefined()
  })

  it.each(['0', '101', '55.5', '-5'])('rejects utilisation %s', (utilizationPercent) => {
    expect(validatePredictionInput(withField({ utilizationPercent })).errors.utilizationPercent).toBeDefined()
  })

  it('accepts the utilisation bounds', () => {
    expect(validatePredictionInput(withField({ utilizationPercent: '1' })).errors.utilizationPercent).toBeUndefined()
    expect(validatePredictionInput(withField({ utilizationPercent: '100' })).errors.utilizationPercent).toBeUndefined()
  })

  it('reports "required" for empty and non-numeric values', () => {
    const result = validatePredictionInput(withField({ gpuCount: '', durationHours: 'abc', utilizationPercent: '  ' }))
    expect(result.errors.gpuCount).toMatch(/required/i)
    expect(result.errors.durationHours).toMatch(/number/i)
    expect(result.errors.utilizationPercent).toMatch(/required/i)
  })

  it('reports several errors together', () => {
    const result = validatePredictionInput({ taskType: '', gpuCount: '0', durationHours: '0', utilizationPercent: '0' })
    expect(Object.keys(result.errors).sort()).toEqual(
      ['durationHours', 'gpuCount', 'taskType', 'utilizationPercent'].sort(),
    )
  })
})
