import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PredictionForm from './PredictionForm'

const DEFAULTS = { taskType: 'training', gpuCount: 64, durationHours: 24, utilizationPercent: 80 }

function setup(props: Partial<React.ComponentProps<typeof PredictionForm>> = {}) {
  const onSubmit = vi.fn()
  const user = userEvent.setup()
  render(<PredictionForm onSubmit={onSubmit} {...props} />)
  return { onSubmit, user }
}

describe('PredictionForm', () => {
  it('renders every input with a label', () => {
    setup()
    expect(screen.getByRole('radio', { name: /training/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /fine-tuning/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /inference/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Number of GPUs')).toHaveValue(64)
    expect(screen.getByLabelText('Duration (hours)')).toHaveValue(24)
    expect(screen.getByLabelText('GPU utilisation (%)')).toHaveValue(80)
    expect(screen.getByRole('slider')).toHaveValue('80')
  })

  it('shows the region as fixed to Ashburn, Virginia', () => {
    setup()
    expect(screen.getByText('Ashburn, Virginia, USA')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /region/i })).not.toBeInTheDocument()
  })

  it('keeps the utilisation number and slider in sync', async () => {
    const { user } = setup()
    const number = screen.getByLabelText('GPU utilisation (%)')
    await user.clear(number)
    await user.type(number, '55')
    expect(screen.getByRole('slider')).toHaveValue('55')

    fireEvent.change(screen.getByRole('slider'), { target: { value: '30' } })
    expect(number).toHaveValue(30)
  })

  it('shows field errors and does not submit invalid values', async () => {
    const { user, onSubmit } = setup()
    const gpus = screen.getByLabelText('Number of GPUs')
    await user.clear(gpus)
    await user.clear(screen.getByLabelText('Duration (hours)'))
    await user.type(screen.getByLabelText('Duration (hours)'), '0')
    await user.click(screen.getByRole('button', { name: /run prediction/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(gpus).toHaveAttribute('aria-invalid', 'true')
    const describedBy = gpus.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)).toHaveTextContent(/required/i)
    expect(screen.getByLabelText('Duration (hours)')).toHaveAttribute('aria-invalid', 'true')
  })

  it('moves focus to the first invalid field', async () => {
    const { user } = setup()
    await user.clear(screen.getByLabelText('Number of GPUs'))
    await user.click(screen.getByRole('button', { name: /run prediction/i }))
    expect(screen.getByLabelText('Number of GPUs')).toHaveFocus()
  })

  it('submits parsed numbers for valid input', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('radio', { name: /inference/i }))
    const gpus = screen.getByLabelText('Number of GPUs')
    await user.clear(gpus)
    await user.type(gpus, '512')
    await user.click(screen.getByRole('button', { name: /run prediction/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ ...DEFAULTS, taskType: 'inference', gpuCount: 512 })
  })

  it('disables the button and says "Analysing…" while pending', () => {
    setup({ pending: true })
    const button = screen.getByRole('button', { name: /analysing/i })
    expect(button).toBeDisabled()
  })

  it('resets the form to its defaults', async () => {
    const { user } = setup()
    const gpus = screen.getByLabelText('Number of GPUs')
    await user.clear(gpus)
    await user.type(gpus, '999')
    await user.click(screen.getByRole('radio', { name: /inference/i }))
    await user.click(screen.getByRole('button', { name: /reset/i }))

    expect(gpus).toHaveValue(64)
    expect(screen.getByRole('radio', { name: /training/i })).toBeChecked()
  })

  it('clears errors on reset', async () => {
    const { user } = setup()
    await user.clear(screen.getByLabelText('Number of GPUs'))
    await user.click(screen.getByRole('button', { name: /run prediction/i }))
    expect(screen.getByLabelText('Number of GPUs')).toHaveAttribute('aria-invalid', 'true')
    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(screen.getByLabelText('Number of GPUs')).not.toHaveAttribute('aria-invalid', 'true')
  })
})
