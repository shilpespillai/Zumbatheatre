import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.14.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { scheduleId, reason } = await req.json();

    // 1. Fetch Schedule and Routine Details
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .select("*, routines(name), profiles(full_name)")
      .eq("id", scheduleId)
      .single();

    if (scheduleError) throw scheduleError;

    // 2. Fetch all unique students booked for this session
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("student_id, profiles(email, phone, full_name)")
      .eq("schedule_id", scheduleId);

    if (bookingsError) throw bookingsError;

    const notifications = bookings?.map(async (booking) => {
        const student = booking.profiles;
        const msg = `Hi ${student.full_name}, your class "${schedule.routines.name}" with ${schedule.profiles.full_name} has been cancelled. Reason: ${reason}`;

        console.log(`[Notification] Sending to ${student.full_name}: ${msg}`);

        // --- EMAIL (RESEND) ---
        if (RESEND_API_KEY && student.email) {
            try {
                const res = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: "Zumbatheatre <notifications@zumbatheatre.com>",
                        to: [student.email],
                        subject: `CLASS CANCELLED: ${schedule.routines.name}`,
                        text: msg
                    })
                });
                console.log(`[Resend] Email sent to ${student.email}`);
            } catch (err) {
                console.error(`[Resend] Failed for ${student.email}:`, err);
            }
        }

        // --- SMS (TWILIO) ---
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && student.phone) {
            try {
                const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
                const formData = new URLSearchParams();
                formData.append("To", student.phone);
                formData.append("From", TWILIO_PHONE_NUMBER!);
                formData.append("Body", msg);

                await fetch(url, {
                    method: "POST",
                    headers: {
                      "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
                      "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData
                });
                console.log(`[Twilio] SMS sent to ${student.phone}`);
            } catch (err) {
                console.error(`[Twilio] Failed for ${student.phone}:`, err);
            }
        }

        return { student_id: booking.student_id, status: "sent" };
    });

    await Promise.all(notifications || []);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
