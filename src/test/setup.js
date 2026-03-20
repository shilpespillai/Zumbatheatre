import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Stripe
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(),
}))

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    })),
  },
}))
```
