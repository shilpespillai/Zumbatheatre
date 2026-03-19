import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@12.1.1?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { items, teacherId, isSubscription, successUrl, cancelUrl } = await req.json();

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let stripeSecretKey = '';

    if (isSubscription) {
      // Collect platform fee ($10/mo) - Use Owner's Secret Key from OS Environment
      stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    } else if (teacherId) {
      // Collect session fee for a specific teacher
      // 2. Fetch Teacher's ENCRYPTED Secret Key from the secure table
      const { data: secretData, error: secretError } = await supabaseAdmin
        .from('instructor_secrets')
        .select('encrypted_secret_key')
        .eq('teacher_id', teacherId)
        .single();

      if (secretError || !secretData) {
        throw new Error('Instructor has not configured their payment stage correctly.');
      }

      // 3. DECRYPT Key (Conceptual logic using a master master key)
      const masterKey = Deno.env.get('MASTER_ENCRYPTION_KEY');
      if (!masterKey) throw new Error('System encryption key not configured.');
      
      // Decryption implementation (e.g., using Web Crypto API or similar)
      // For now, we assume keys are stored securely. 
      // If we implement encryption, we would decrypt it here.
      stripeSecretKey = secretData.encrypted_secret_key;
    }

    if (!stripeSecretKey) {
      throw new Error('Payment stage configuration missing or invalid.');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 4. Create Stripe Checkout Session
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name || 'Zumba Theatre Session',
        },
        unit_amount: Math.round(Number(item.price) * 100), // convert to cents
      },
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return new Response(
      JSON.stringify({ id: session.id, url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
