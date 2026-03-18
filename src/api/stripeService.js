import { loadStripe } from '@stripe/stripe-js'

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY

export const getStripe = (customPublicKey) => {
  const key = customPublicKey || stripePublicKey;
  if (!key) {
    console.warn('Stripe Public Key missing. Payment features will be disabled.')
    return null
  }
  return loadStripe(key)
}

export const createCheckoutSession = async (items, config = {}) => {
  // Pattern based on FinanceCalculator methodology
  // config.secretKey would be used in a secure backend context (Supabase Edge Function)
  console.log('Creating checkout session for:', items, 'with config:', config)
  
  // In mock mode, we simulate a successful session
  if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY || config.isMock) {
    return { id: 'mock_session_' + Date.now(), url: '#' }
  }

  // Placeholder for real API call to Edge Function
  return { id: 'session_placeholder' }
}
