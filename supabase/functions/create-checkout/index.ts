import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@12.1.1?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to decrypt data using AES-GCM
async function decrypt(hexCiphertext: string, masterKeyStr: string) {
  const enc = new TextEncoder();
  const keyBuffer = enc.encode(masterKeyStr.padEnd(32, '0').slice(0, 32));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const combined = new Uint8Array(
    hexCiphertext.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

serve(async (req: Request) => {
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
      const { data: secretData, error: secretError } = await supabaseAdmin
        .from('instructor_secrets')
        .select('encrypted_secret_key')
        .eq('teacher_id', teacherId)
        .single();

      if (secretError || !secretData) {
        throw new Error('Instructor has not configured their payment stage correctly.');
      }

      // 3. DECRYPT Key using AES-GCM
      const masterKey = Deno.env.get('MASTER_ENCRYPTION_KEY');
      if (!masterKey) throw new Error('System encryption key not configured.');
      
      stripeSecretKey = await decrypt(secretData.encrypted_secret_key, masterKey);
    }

    if (!stripeSecretKey) {
      throw new Error('Payment stage configuration missing or invalid.');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 4. Create Stripe Checkout Session
    const lineItems = items.map((item: any) => {
      // For subscriptions, Stripe prefers a pre-defined 'price' ID from the dashboard
      if (isSubscription && item.priceId) {
        return { price: item.priceId, quantity: 1 };
      }
      
      // Fallback/Default for one-time payments
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name || 'Zumba Theatre Session',
          },
          unit_amount: Math.round(Number(item.price || 15) * 100), // convert to cents
          ...(isSubscription && { recurring: { interval: 'month' } }) // Inline recurring if no Price ID
        },
        quantity: 1,
      };
    });

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

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
