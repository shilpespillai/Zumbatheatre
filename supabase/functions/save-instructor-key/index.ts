import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to encrypt data using AES-GCM
async function encrypt(text: string, masterKeyStr: string) {
  const enc = new TextEncoder();
  const keyBuffer = enc.encode(masterKeyStr.padEnd(32, '0').slice(0, 32));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  // Combine IV and Ciphertext for storage (hex encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return Array.from(combined)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Get User Session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { stripeSecretKey } = await req.json()
    if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
      throw new Error('Invalid Stripe Secret Key')
    }

    // 2. Encrypt the key
    const masterKey = Deno.env.get('MASTER_ENCRYPTION_KEY')
    if (!masterKey) throw new Error('System encryption key not configured.')
    
    const encryptedKey = await encrypt(stripeSecretKey, masterKey)

    // 3. Save to database using Service Role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: dbError } = await supabaseAdmin
      .from('instructor_secrets')
      .upsert({
        teacher_id: user.id,
        encrypted_secret_key: encryptedKey,
        updated_at: new Date().toISOString(),
      })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ success: true, message: 'Payment key saved securely.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
