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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing.');
    }

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession?.access_token || supabaseAnonKey}`,
        'x-user-id': authSession?.user?.id || ''
      },
      body: JSON.stringify({
        items,
        teacherId: config.teacherId, // Used to look up teacher's encrypted key
        isSubscription: config.isSubscription || false,
        successUrl: config.successUrl || `${window.location.origin}/student/dashboard?payment=success`,
        cancelUrl: config.cancelUrl || `${window.location.origin}/student/dashboard?payment=cancel`
      })
    });
    
    clearTimeout(timeoutId);

    const session = await response.json();
    if (session.error) throw new Error(session.error);
    
    return session;
  } catch (error) {
    console.error('[Stripe] Session creation failed:', error);
    throw error;
  }
}
