import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './../App'
import { STORAGE_KEY } from '../state/storage'

describe('PredictPage', () => {
  it('runs the analysis, stores it and navigates to the results page', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /run prediction/i }))
    expect(screen.getByRole('button', { name: /analysing/i })).toBeDisabled()

    expect(await screen.findByRole('heading', { level: 1, name: /^results$/i }, { timeout: 3000 })).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!).input).toEqual({
      taskType: 'training',
      gpuCount: 64,
      durationHours: 24,
      utilizationPercent: 80,
    })
  })

  it('stays on the page when the input is invalid', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <App />
      </MemoryRouter>,
    )
    await user.clear(screen.getByLabelText('Number of GPUs'))
    await user.click(screen.getByRole('button', { name: /run prediction/i }))
    expect(screen.getByRole('heading', { level: 1, name: /run a prediction/i })).toBeInTheDocument()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
