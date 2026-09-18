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

    const { attempt_id, session_id } = await req.json();
    if (!attempt_id || !session_id) {
      return new Response(JSON.stringify({ error: "Missing attempt_id or session_id" }), {
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

    const section = attempt.current_section;

    // Fetch question sets for this section
    const { data: questionSets } = await supabase
      .from("question_sets")
      .select("*")
      .eq("mock_id", attempt.mock_id)
      .eq("section", section)
      .order("display_order", { ascending: true });

    // Fetch questions for this section
    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("mock_id", attempt.mock_id)
      .eq("section", section)
      .order("display_order", { ascending: true });

    // Fetch existing responses
    const { data: responses } = await supabase
      .from("responses")
      .select("*")
      .eq("attempt_id", attempt_id);

    // Strip correct_answer from questions before returning
    const safeQuestions = (questions || []).map((q: any) => ({
      id: q.id,
      set_id: q.set_id,
      section: q.section,
      display_order: q.display_order,
      question_type: q.question_type,
      question_text: q.question_text,
      image_url: q.image_url,
      options: q.options,
      marks: q.marks,
      negative_marks: q.negative_marks,
      difficulty: q.difficulty,
    }));

    return new Response(JSON.stringify({
      section,
      question_sets: questionSets || [],
      questions: safeQuestions,
      responses: responses || [],
      section_ends_at: attempt.section_ends_at,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
