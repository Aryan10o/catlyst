import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SECTION_ORDER = ['VARC', 'DILR', 'QA'];

async function gradeSection(supabase: any, attemptId: string, section: string) {
  const { data: responses } = await supabase
    .from("responses")
    .select("*, questions!inner(correct_answer, answer_tolerance, marks, negative_marks, question_type)")
    .eq("attempt_id", attemptId)
    .eq("questions.section", section);

  if (!responses) return 0;

  let sectionMarks = 0;
  for (const resp of responses) {
    const q = resp.questions;
    let isCorrect = false;
    let marksAwarded = 0;

    if (resp.selected_answer === null || resp.selected_answer === undefined || resp.selected_answer === '') {
      marksAwarded = 0;
      isCorrect = false;
    } else if (q.question_type === 'MCQ') {
      isCorrect = resp.selected_answer === q.correct_answer;
      marksAwarded = isCorrect ? q.marks : -q.negative_marks;
    } else {
      const tolerance = parseFloat(q.answer_tolerance) || 0;
      const selected = parseFloat(resp.selected_answer);
      const correct = parseFloat(q.correct_answer);
      if (!isNaN(selected) && !isNaN(correct)) {
        isCorrect = Math.abs(selected - correct) <= tolerance;
      } else {
        isCorrect = resp.selected_answer.trim() === q.correct_answer.trim();
      }
      marksAwarded = isCorrect ? q.marks : -q.negative_marks;
    }

    sectionMarks += marksAwarded;

    await supabase
      .from("responses")
      .update({ is_correct: isCorrect, marks_awarded: marksAwarded })
      .eq("id", resp.id);
  }

  return sectionMarks;
}

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

    if (session_id && attempt.active_session_id !== session_id) {
      return new Response(JSON.stringify({ error: "Session conflict" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attempt.status === "submitted") {
      return new Response(JSON.stringify({ error: "Already submitted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentSection = attempt.current_section;
    if (!currentSection) {
      return new Response(JSON.stringify({ error: "No active section" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grade the current section
    await gradeSection(supabase, attempt_id, currentSection);

    const sectionIndex = SECTION_ORDER.indexOf(currentSection);

    if (sectionIndex < SECTION_ORDER.length - 1) {
      // Advance to next section
      const nextSection = SECTION_ORDER[sectionIndex + 1];
      const { data: mock } = await supabase
        .from("mocks")
        .select("*")
        .eq("id", attempt.mock_id)
        .maybeSingle();

      const durationMap: Record<string, string> = {
        VARC: "section_duration_varc",
        DILR: "section_duration_dilr",
        QA: "section_duration_qa",
      };
      const duration = mock[durationMap[nextSection]];
      const now = new Date();
      const endsAt = new Date(now.getTime() + duration * 1000);

      await supabase
        .from("attempts")
        .update({
          current_section: nextSection,
          section_started_at: now.toISOString(),
          section_ends_at: endsAt.toISOString(),
          last_heartbeat_at: now.toISOString(),
        })
        .eq("id", attempt_id);

      return new Response(JSON.stringify({
        advanced: true,
        next_section: nextSection,
        section_ends_at: endsAt.toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Final submission — grade all sections and compute results
    const varcMarks = await gradeSection(supabase, attempt_id, "VARC");
    const dilrMarks = await gradeSection(supabase, attempt_id, "DILR");
    const qaMarks = await gradeSection(supabase, attempt_id, "QA");
    const overallMarks = varcMarks + dilrMarks + qaMarks;

    // Compute accuracy
    const { data: allResponses } = await supabase
      .from("responses")
      .select("is_correct, selected_answer")
      .eq("attempt_id", attempt_id);

    const answered = (allResponses || []).filter((r: any) => r.selected_answer !== null && r.selected_answer !== "");
    const correctCount = answered.filter((r: any) => r.is_correct).length;
    const accuracy = answered.length > 0 ? (correctCount / answered.length) * 100 : 0;

    // Get percentiles
    const { data: varcPct } = await supabase.rpc("get_percentile", {
      p_mock_id: attempt.mock_id, p_scope: "VARC", p_raw_marks: varcMarks,
    });
    const { data: dilrPct } = await supabase.rpc("get_percentile", {
      p_mock_id: attempt.mock_id, p_scope: "DILR", p_raw_marks: dilrMarks,
    });
    const { data: qaPct } = await supabase.rpc("get_percentile", {
      p_mock_id: attempt.mock_id, p_scope: "QA", p_raw_marks: qaMarks,
    });
    const { data: overallPct } = await supabase.rpc("get_percentile", {
      p_mock_id: attempt.mock_id, p_scope: "overall", p_raw_marks: overallMarks,
    });

    // Get overall grade
    let overallGrade = null;
    const { data: gradeRow } = await supabase
      .from("grading_sheets")
      .select("grade")
      .eq("mock_id", attempt.mock_id)
      .eq("scope", "overall")
      .eq("raw_marks", overallMarks)
      .maybeSingle();
    if (gradeRow) overallGrade = gradeRow.grade;

    await supabase.from("attempt_results").insert({
      attempt_id: attempt_id,
      overall_raw_marks: overallMarks,
      overall_percentile: overallPct,
      overall_grade: overallGrade,
      varc_raw_marks: varcMarks,
      varc_percentile: varcPct,
      dilr_raw_marks: dilrMarks,
      dilr_percentile: dilrPct,
      qa_raw_marks: qaMarks,
      qa_percentile: qaPct,
      accuracy_overall: accuracy,
    });

    await supabase
      .from("attempts")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", attempt_id);

    return new Response(JSON.stringify({
      advanced: false,
      submitted: true,
      attempt_id: attempt_id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
