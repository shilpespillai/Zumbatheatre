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
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing.');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        items,
        teacherId: config.teacherId, // Used to look up teacher's encrypted key
        isSubscription: config.isSubscription || false,
        successUrl: `${window.location.origin}/student/dashboard?payment=success`,
        cancelUrl: `${window.location.origin}/student/dashboard?payment=cancel`
      })
    });

    const session = await response.json();
    if (session.error) throw new Error(session.error);
    
    return session;
  } catch (error) {
    console.error('[Stripe] Session creation failed:', error);
    throw error;
  }
}
