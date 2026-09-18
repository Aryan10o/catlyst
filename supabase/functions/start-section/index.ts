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

    const { mock_id, section } = await req.json();
    if (!mock_id || !section) {
      return new Response(JSON.stringify({ error: "Missing mock_id or section" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check mock access
    const { data: access } = await supabase
      .from("mock_access")
      .select("id")
      .eq("mock_id", mock_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (!access) {
      return new Response(JSON.stringify({ error: "No access to this mock" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check mock exists and is published
    const { data: mock } = await supabase
      .from("mocks")
      .select("*")
      .eq("id", mock_id)
      .maybeSingle();

    if (!mock || !mock.is_published) {
      return new Response(JSON.stringify({ error: "Mock not available" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create attempt
    const { data: existing } = await supabase
      .from("attempts")
      .select("*")
      .eq("student_id", user.id)
      .eq("mock_id", mock_id)
      .maybeSingle();

    if (existing && existing.status === "submitted") {
      return new Response(JSON.stringify({ error: "Test already submitted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const durationMap: Record<string, string> = {
      VARC: "section_duration_varc",
      DILR: "section_duration_dilr",
      QA: "section_duration_qa",
    };
    const durationKey = durationMap[section];
    const durationSeconds = mock[durationKey];
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationSeconds * 1000);

    if (!existing) {
      const { data: attempt, error } = await supabase
        .from("attempts")
        .insert({
          student_id: user.id,
          mock_id,
          status: "in_progress",
          current_section: section,
          active_session_id: sessionId,
          section_started_at: now.toISOString(),
          section_ends_at: endsAt.toISOString(),
          last_heartbeat_at: now.toISOString(),
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        attempt_id: attempt.id,
        session_id: sessionId,
        section_ends_at: endsAt.toISOString(),
        current_section: section,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resume: check if the requested section matches current_section
    if (existing.current_section && existing.current_section !== section && existing.status !== "not_started") {
      return new Response(JSON.stringify({
        error: "Cannot start this section",
        current_section: existing.current_section,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: attempt, error: updateError } = await supabase
      .from("attempts")
      .update({
        status: "in_progress",
        current_section: section,
        active_session_id: sessionId,
        section_started_at: now.toISOString(),
        section_ends_at: endsAt.toISOString(),
        last_heartbeat_at: now.toISOString(),
        paused_at: null,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      attempt_id: attempt.id,
      session_id: sessionId,
      section_ends_at: endsAt.toISOString(),
      current_section: section,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
