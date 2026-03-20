import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@12.1.1?target=deno"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature")

  // 1. Verify Webhook Signature
  try {
    if (!signature) throw new Error("Missing Stripe-Signature")

    const body = await req.text()
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )

    console.log(`🔔 Received event: ${event.type}`)

    // 2. Initialize Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (userId) {
          const isSubscription = session.metadata?.isSubscription === 'true'

          if (isSubscription) {
            console.log(`✅ Subscription completed for user: ${userId}`)
            await supabaseAdmin
              .from('profiles')
              .update({
                is_subscribed: true,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId
              })
              .eq('id', userId)
          } else {
            // ONE-OFF BOOKING LOGIC
            const scheduleId = session.metadata?.scheduleId
            const teacherId = session.metadata?.teacherId
            const amount = Number(session.metadata?.amount || 0)

            console.log(`✅ One-off booking completed for user: ${userId}, schedule: ${scheduleId}`)

            // 1. Create Booking Record
            const { data: bookingData, error: bookingErr } = await supabaseAdmin
              .from('bookings')
              .insert({
                student_id: userId,
                schedule_id: scheduleId,
                amount: amount,
                payment_method: 'STRIPE',
                payment_status: 'PAID'
              })
              .select()
              .single()

            if (bookingErr) {
              console.error(`❌ Booking Insertion Error: ${bookingErr.message}`)
            } else if (bookingData) {
              // 2. Create Payment Record (for reports)
              const { error: paymentErr } = await supabaseAdmin
                .from('payments')
                .insert({
                  booking_id: bookingData.id,
                  student_id: userId,
                  teacher_id: teacherId,
                  amount: amount,
                  status: 'SUCCEEDED'
                })
              if (paymentErr) console.error(`❌ Payment Insertion Error: ${paymentErr.message}`)
            }
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`❌ Subscription deleted: ${subscription.id}`)
        
        await supabaseAdmin
          .from('profiles')
          .update({ is_subscribed: false })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`🔄 Subscription updated: ${subscription.id} - Status: ${subscription.status}`)
        
        const isSubscribed = ['active', 'trialing'].includes(subscription.status)
        await supabaseAdmin
          .from('profiles')
          .update({ is_subscribed: isSubscribed })
          .eq('stripe_subscription_id', subscription.id)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
