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

    const { attempt_id, session_id, question_id, selected_answer, is_marked_for_review, is_visited, time_spent_seconds } = await req.json();

    if (!attempt_id || !session_id || !question_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
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

    if (attempt.active_session_id !== session_id) {
      return new Response(JSON.stringify({ error: "Session conflict" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attempt.status !== "in_progress") {
      return new Response(JSON.stringify({ error: "Attempt not in progress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify question belongs to current section
    const { data: question } = await supabase
      .from("questions")
      .select("section")
      .eq("id", question_id)
      .maybeSingle();

    if (!question || question.section !== attempt.current_section) {
      return new Response(JSON.stringify({ error: "Question not in current section" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert response
    const { data: existing } = await supabase
      .from("responses")
      .select("id")
      .eq("attempt_id", attempt_id)
      .eq("question_id", question_id)
      .maybeSingle();

    const updateData: any = {
      attempt_id,
      question_id,
      updated_at: new Date().toISOString(),
    };
    if (selected_answer !== undefined) updateData.selected_answer = selected_answer;
    if (is_marked_for_review !== undefined) updateData.is_marked_for_review = is_marked_for_review;
    if (is_visited !== undefined) updateData.is_visited = is_visited;
    if (time_spent_seconds !== undefined) updateData.time_spent_seconds = time_spent_seconds;

    if (existing) {
      const { error } = await supabase
        .from("responses")
        .update(updateData)
        .eq("id", existing.id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error } = await supabase
        .from("responses")
        .insert(updateData);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
