import { useId, useState, type FormEvent } from 'react'
import { ASHBURN } from '../../data/regions'
import { LIMITS, validatePredictionInput } from '../../lib/validation'
import type { PredictionInput, RawPredictionInput, ValidationErrors } from '../../types/analysis'

const DEFAULTS: RawPredictionInput = {
  gpuCount: '500',
  smUtilPercent: '60',
  memUtilPercent: '30',
  hoursPerDay: '24',
  daysPerYear: '365',
}

const FIELD_ORDER: (keyof PredictionInput)[] = ['gpuCount', 'smUtilPercent', 'memUtilPercent', 'hoursPerDay', 'daysPerYear']

interface PredictionFormProps {
  onSubmit: (values: PredictionInput) => void
  pending?: boolean
}

interface NumberFieldProps {
  id: string
  label: string
  hint: string
  value: string
  error?: string
  min: number
  max: number
  step?: number
  onChange: (value: string) => void
}

function NumberField({ id, label, hint, value, error, min, max, step = 1, onChange }: NumberFieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink-900">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hintId}
        className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-ink-900 shadow-sm ${
          error ? 'border-red-500' : 'border-ink-300'
        }`}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : (
        <p id={hintId} className="mt-1.5 text-sm text-ink-500">
          {hint}
        </p>
      )}
    </div>
  )
}

/** A number field with a synchronised slider, for 0–100 percentages. */
function PercentField(props: Omit<NumberFieldProps, 'min' | 'max' | 'step'> & { sliderLabel: string }) {
  const { min, max } = LIMITS.utilizationPercent
  const { sliderLabel, ...field } = props
  const slider = Math.min(max, Math.max(min, Math.round(Number(props.value)) || min))
  return (
    <div>
      <NumberField {...field} min={min} max={max} step={1} />
      <input
        type="range"
        aria-label={sliderLabel}
        min={min}
        max={max}
        value={slider}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-3 w-full accent-coolant-600"
      />
    </div>
  )
}

export default function PredictionForm({ onSubmit, pending = false }: PredictionFormProps) {
  const uid = useId()
  const [raw, setRaw] = useState<RawPredictionInput>(DEFAULTS)
  const [errors, setErrors] = useState<ValidationErrors>({})

  const fieldId = (name: keyof PredictionInput) => `${uid}-${name}`
  const update = (name: keyof RawPredictionInput) => (value: string) => setRaw((r) => ({ ...r, [name]: value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const { values, errors: found } = validatePredictionInput(raw)
    setErrors(found)
    if (!values) {
      const first = FIELD_ORDER.find((name) => found[name])
      if (first) document.getElementById(fieldId(first))?.focus()
      return
    }
    onSubmit(values)
  }

  function handleReset() {
    setRaw(DEFAULTS)
    setErrors({})
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <NumberField
        id={fieldId('gpuCount')}
        label="Number of GPUs"
        hint="Whole number from 1 to 100,000."
        value={raw.gpuCount}
        error={errors.gpuCount}
        min={LIMITS.gpuCount.min}
        max={LIMITS.gpuCount.max}
        onChange={update('gpuCount')}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <PercentField
          id={fieldId('smUtilPercent')}
          label="Average SM utilisation (%)"
          hint="Compute utilisation across your GPUs, 0–100 (DCGM SM utilisation)."
          value={raw.smUtilPercent}
          error={errors.smUtilPercent}
          onChange={update('smUtilPercent')}
          sliderLabel="SM utilisation slider"
        />
        <PercentField
          id={fieldId('memUtilPercent')}
          label="Average memory utilisation (%)"
          hint="Share of GPU memory bandwidth in use, 0–100."
          value={raw.memUtilPercent}
          error={errors.memUtilPercent}
          onChange={update('memUtilPercent')}
          sliderLabel="Memory utilisation slider"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <NumberField
          id={fieldId('hoursPerDay')}
          label="Hours per day in use"
          hint="Greater than 0, up to 24."
          value={raw.hoursPerDay}
          error={errors.hoursPerDay}
          min={LIMITS.hoursPerDay.min}
          max={LIMITS.hoursPerDay.max}
          step={0.5}
          onChange={update('hoursPerDay')}
        />
        <NumberField
          id={fieldId('daysPerYear')}
          label="Days per year in use"
          hint="Whole number from 1 to 366."
          value={raw.daysPerYear}
          error={errors.daysPerYear}
          min={LIMITS.daysPerYear.min}
          max={LIMITS.daysPerYear.max}
          onChange={update('daysPerYear')}
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">Region</p>
        <p className="mt-1.5 flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-100 px-3 py-2.5 text-ink-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          <span>{ASHBURN.name}</span>
        </p>
        <p className="mt-1.5 text-sm text-ink-500">The only region available in this prototype.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-coolant-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-coolant-700 disabled:cursor-not-allowed disabled:bg-ink-400"
        >
          {pending ? 'Analysing…' : 'Run prediction'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={pending}
          className="rounded-lg border border-ink-300 px-6 py-3 font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </form>
  )
}
