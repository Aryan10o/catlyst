import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { attempt_id } = await req.json();
    if (!attempt_id) {
      return new Response(JSON.stringify({ error: "Missing attempt_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: attempt } = await supabase
      .from("attempts")
      .select("*")
      .eq("id", attempt_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (!attempt) {
      return new Response(JSON.stringify({ error: "Attempt not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attempt.status === "submitted") {
      return new Response(JSON.stringify({ error: "Test already submitted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attempt.status !== "paused") {
      return new Response(JSON.stringify({ error: "Attempt is not paused" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const pausedAt = new Date(attempt.paused_at);
    const pauseDuration = Math.round((now.getTime() - pausedAt.getTime()) / 1000);

    const newSessionId = crypto.randomUUID();
    const newEndsAt = new Date(new Date(attempt.section_ends_at).getTime() + pauseDuration * 1000);

    await supabase
      .from("attempts")
      .update({
        status: "in_progress",
        active_session_id: newSessionId,
        section_ends_at: newEndsAt.toISOString(),
        total_paused_seconds: attempt.total_paused_seconds + pauseDuration,
        paused_at: null,
        last_heartbeat_at: now.toISOString(),
      })
      .eq("id", attempt_id);

    return new Response(JSON.stringify({
      session_id: newSessionId,
      section_ends_at: newEndsAt.toISOString(),
      current_section: attempt.current_section,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
