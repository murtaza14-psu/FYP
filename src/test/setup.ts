import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom does not implement scrolling.
window.scrollTo = vi.fn()

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})
