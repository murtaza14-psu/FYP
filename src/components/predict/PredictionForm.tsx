import { useId, useState, type FormEvent } from 'react'
import { ASHBURN } from '../../data/regions'
import { TASK_TYPES } from '../../data/taskTypes'
import { LIMITS, validatePredictionInput } from '../../lib/validation'
import type { PredictionInput, RawPredictionInput, ValidationErrors } from '../../types/analysis'

const DEFAULTS: RawPredictionInput = {
  taskType: 'training',
  gpuCount: '64',
  durationHours: '24',
  utilizationPercent: '80',
}

const FIELD_ORDER: (keyof PredictionInput)[] = ['taskType', 'gpuCount', 'durationHours', 'utilizationPercent']

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

export default function PredictionForm({ onSubmit, pending = false }: PredictionFormProps) {
  const uid = useId()
  const [raw, setRaw] = useState<RawPredictionInput>(DEFAULTS)
  const [errors, setErrors] = useState<ValidationErrors>({})

  const fieldId = (name: keyof PredictionInput) => `${uid}-${name}`
  const update = (name: keyof RawPredictionInput) => (value: string) => setRaw((r) => ({ ...r, [name]: value }))

  const sliderValue = Math.min(
    LIMITS.utilizationPercent.max,
    Math.max(LIMITS.utilizationPercent.min, Math.round(Number(raw.utilizationPercent)) || LIMITS.utilizationPercent.min),
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const { values, errors: found } = validatePredictionInput(raw)
    setErrors(found)
    if (!values) {
      const first = FIELD_ORDER.find((name) => found[name])
      if (first) {
        const el =
          first === 'taskType'
            ? document.querySelector<HTMLElement>(`input[name="${uid}-taskType"]`)
            : document.getElementById(fieldId(first))
        el?.focus()
      }
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
      <fieldset aria-describedby={errors.taskType ? `${uid}-taskType-error` : undefined}>
        <legend className="text-sm font-semibold text-ink-900">Task type</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {TASK_TYPES.map((task) => {
            const titleId = `${uid}-${task.id}-title`
            const descId = `${uid}-${task.id}-desc`
            return (
              <label
                key={task.id}
                className="flex cursor-pointer flex-col rounded-xl border border-ink-300 bg-white p-4 shadow-sm transition-colors has-[:checked]:border-coolant-600 has-[:checked]:bg-coolant-50 has-[:checked]:ring-2 has-[:checked]:ring-coolant-600/30"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${uid}-taskType`}
                    value={task.id}
                    checked={raw.taskType === task.id}
                    onChange={() => update('taskType')(task.id)}
                    aria-labelledby={titleId}
                    aria-describedby={descId}
                    className="h-4 w-4 accent-coolant-600"
                  />
                  <span id={titleId} className="font-semibold text-ink-900">
                    {task.label}
                  </span>
                </span>
                <span id={descId} className="mt-2 text-sm text-ink-600">
                  {task.description}
                </span>
              </label>
            )
          })}
        </div>
        {errors.taskType && (
          <p id={`${uid}-taskType-error`} className="mt-1.5 text-sm font-medium text-red-700">
            {errors.taskType}
          </p>
        )}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
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
        <NumberField
          id={fieldId('durationHours')}
          label="Duration (hours)"
          hint="Greater than 0, up to 8,760 (one year)."
          value={raw.durationHours}
          error={errors.durationHours}
          min={0}
          max={LIMITS.durationHours.max}
          step={0.5}
          onChange={update('durationHours')}
        />
      </div>

      <div>
        <NumberField
          id={fieldId('utilizationPercent')}
          label="GPU utilisation (%)"
          hint="Average share of GPU capacity you expect to use, 1–100."
          value={raw.utilizationPercent}
          error={errors.utilizationPercent}
          min={LIMITS.utilizationPercent.min}
          max={LIMITS.utilizationPercent.max}
          onChange={update('utilizationPercent')}
        />
        <input
          type="range"
          aria-label="GPU utilisation slider"
          min={LIMITS.utilizationPercent.min}
          max={LIMITS.utilizationPercent.max}
          value={sliderValue}
          onChange={(e) => update('utilizationPercent')(e.target.value)}
          className="mt-3 w-full accent-coolant-600"
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
