import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PredictionForm from './PredictionForm'

const DEFAULTS = { gpuCount: 500, smUtilPercent: 60, memUtilPercent: 30, hoursPerDay: 24, daysPerYear: 365 }

function setup(props: Partial<React.ComponentProps<typeof PredictionForm>> = {}) {
  const onSubmit = vi.fn()
  const user = userEvent.setup()
  render(<PredictionForm onSubmit={onSubmit} {...props} />)
  return { onSubmit, user }
}

describe('PredictionForm', () => {
  it('renders every input with a label and default', () => {
    setup()
    expect(screen.getByLabelText('Number of GPUs')).toHaveValue(500)
    expect(screen.getByLabelText('Average SM utilisation (%)')).toHaveValue(60)
    expect(screen.getByLabelText('Average memory utilisation (%)')).toHaveValue(30)
    expect(screen.getByLabelText('Hours per day in use')).toHaveValue(24)
    expect(screen.getByLabelText('Days per year in use')).toHaveValue(365)
    expect(screen.getByRole('slider', { name: /sm utilisation/i })).toHaveValue('60')
    expect(screen.getByRole('slider', { name: /memory utilisation/i })).toHaveValue('30')
  })

  it('no longer asks for a task type', () => {
    setup()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('shows the region as fixed to Ashburn, Virginia', () => {
    setup()
    expect(screen.getByText('Ashburn, Virginia, USA')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /region/i })).not.toBeInTheDocument()
  })

  it('keeps each utilisation number and its slider in sync', async () => {
    const { user } = setup()
    const number = screen.getByLabelText('Average SM utilisation (%)')
    await user.clear(number)
    await user.type(number, '55')
    expect(screen.getByRole('slider', { name: /sm utilisation/i })).toHaveValue('55')

    fireEvent.change(screen.getByRole('slider', { name: /memory utilisation/i }), { target: { value: '12' } })
    expect(screen.getByLabelText('Average memory utilisation (%)')).toHaveValue(12)
    expect(number).toHaveValue(55)
  })

  it('shows field errors and does not submit invalid values', async () => {
    const { user, onSubmit } = setup()
    const gpus = screen.getByLabelText('Number of GPUs')
    await user.clear(gpus)
    await user.clear(screen.getByLabelText('Hours per day in use'))
    await user.type(screen.getByLabelText('Hours per day in use'), '0')
    await user.click(screen.getByRole('button', { name: /run prediction/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(gpus).toHaveAttribute('aria-invalid', 'true')
    const describedBy = gpus.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)).toHaveTextContent(/required/i)
    expect(screen.getByLabelText('Hours per day in use')).toHaveAttribute('aria-invalid', 'true')
  })

  it('moves focus to the first invalid field', async () => {
    const { user } = setup()
    await user.clear(screen.getByLabelText('Average memory utilisation (%)'))
    await user.click(screen.getByRole('button', { name: /run prediction/i }))
    expect(screen.getByLabelText('Average memory utilisation (%)')).toHaveFocus()
  })

  it('submits parsed numbers for valid input', async () => {
    const { user, onSubmit } = setup()
    const gpus = screen.getByLabelText('Number of GPUs')
    await user.clear(gpus)
    await user.type(gpus, '512')
    const hours = screen.getByLabelText('Hours per day in use')
    await user.clear(hours)
    await user.type(hours, '12')
    await user.click(screen.getByRole('button', { name: /run prediction/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ ...DEFAULTS, gpuCount: 512, hoursPerDay: 12 })
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
    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(gpus).toHaveValue(500)
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
