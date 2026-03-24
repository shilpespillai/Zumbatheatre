import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, studioMetrics, userRole } = await req.json();

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Perform a check of the User's JWT (Security)
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // 3. Prepare the Prompt for Gemini
    const systemPrompt = `
      You are the "Zumbatheatre Stage Manager AI", a premium, data-driven assistant for a dance studio platform.
      Your goal is to help ${userRole}s understand their studio performance and student engagement.
      
      CONTEXT DATA:
      ${JSON.stringify(studioMetrics, null, 2)}
      
      USER PROMPT:
      "${prompt}"
      
      INSTRUCTIONS:
      - Be professional, encouraging, and data-centric. Use dance/theatre metaphors (e.g., "The stage is vibrant", "Encore metrics").
      - If the user asks for a visualization or a comparison, return a structured JSON object along with your text.
      - ALWAYS return a JSON response in the following format:
      {
        "text": "Your natural language response here.",
        "hasChart": true/false,
        "chartData": [ { "name": "Label", "value": 123 }, ... ],
        "chartType": "bar" | "area" | "pie"
      }
    `;

    // 4. Call Gemini API
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Insights Engine key not configured.');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const aiResult = await response.json();
    const content = JSON.parse(aiResult.candidates[0].content.parts[0].text);

    return new Response(
      JSON.stringify(content),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
