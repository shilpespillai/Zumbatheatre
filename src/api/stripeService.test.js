import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCheckoutSession } from './stripeService'

// Mock global fetch
global.fetch = vi.fn()

describe('StripeService (Production Dry Run)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock environment
    import.meta.env.VITE_SUPABASE_URL = 'https://abc.supabase.co'
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('correctly routes to the secure Edge Function in production mode', async () => {
    import.meta.env.VITE_DEV_BYPASS = 'false'
    
    const mockSession = { id: 'test_session', url: 'https://stripe.com/pay' }
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockSession)
    })

    const result = await createCheckoutSession([{ name: 'Test Class', price: 10 }], { teacherId: 't1' })
    
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/create-checkout'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"teacherId":"t1"')
      })
    )
    expect(result).toEqual(mockSession)
  })

  it('correctly uses mock logic when DEV_BYPASS is active', async () => {
    import.meta.env.VITE_DEV_BYPASS = 'true'
    
    const result = await createCheckoutSession([], { isMock: true })
    
    expect(fetch).not.toHaveBeenCalled()
    expect(result.id).toContain('mock_session_')
  })
})
