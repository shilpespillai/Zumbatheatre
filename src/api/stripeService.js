import { loadStripe } from '@stripe/stripe-js'
import { supabase } from './supabaseClient'

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
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        items,
        teacherId: config.teacherId, // Used to look up teacher's encrypted key
        isSubscription: config.isSubscription || false,
        successUrl: config.successUrl || `${window.location.origin}/student/dashboard?payment=success`,
        cancelUrl: config.cancelUrl || `${window.location.origin}/student/dashboard?payment=cancel`
      },
      headers: {
        'x-user-id': (await supabase.auth.getUser()).data.user?.id || ''
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Stripe] Session creation failed:', error);
    throw error;
  }
}
