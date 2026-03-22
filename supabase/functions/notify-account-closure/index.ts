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
    const { teacherId, closureDate } = await req.json();

    // 1. Fetch Teacher Details
    const { data: teacher, error: teacherError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", teacherId)
      .single();

    if (teacherError) throw teacherError;

    // 2. Fetch all unique students who ever booked with this teacher
    // We can do this by selecting from bookings joined with schedules
    const { data: students, error: studentsError } = await supabase
      .from("bookings")
      .select("student_id, profiles!student_id(email, phone, full_name)")
      .eq("teacher_id", teacherId); // Requires bookings table to have teacher_id OR join via schedules

    // Fallback: If no teacher_id on booking, join via schedules
    let targetStudents = students;
    if (studentsError) {
        const { data: altStudents, error: altError } = await supabase
          .from("bookings")
          .select("student_id, profiles!student_id(email, phone, full_name), schedules!inner(teacher_id)")
          .eq("schedules.teacher_id", teacherId);
        
        if (altError) throw altError;
        targetStudents = altStudents;
    }

    const uniqueStudents = Array.from(new Map(targetStudents?.map(s => [s.student_id, s.profiles])).values());

    const notifications = uniqueStudents?.map(async (student) => {
        if (!student) return;
        const msg = `Hi ${student.full_name}, ${teacher.full_name} is closing their stage at Zumbatheatre on ${new Date(closureDate).toLocaleDateString()}. Thank you for dancing with us!`;

        console.log(`[Account Closure] Notifying ${student.full_name}: ${msg}`);

        // --- EMAIL (RESEND) ---
        if (RESEND_API_KEY && student.email) {
            try {
                await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: "Zumbatheatre <notifications@zumbatheatre.com>",
                        to: [student.email],
                        subject: `STAGING CLOSURE: ${teacher.full_name}`,
                        text: msg
                    })
                });
            } catch (err) { console.error(`[Resend] Failed:`, err); }
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
            } catch (err) { console.error(`[Twilio] Failed:`, err); }
        }

        return { student_id: student.id, status: "sent" };
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
