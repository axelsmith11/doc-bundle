import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body
    const body = await req.json();
    const { citaId, fechaDespacho, horaEntrega, excelBase64, excelFileName } = body;

    if (!excelBase64 || !excelFileName || !fechaDespacho) {
      return new Response(JSON.stringify({ error: "Missing required data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credentials from environment (SECURE)
    const TAILOY_USER = Deno.env.get("TAILOY_USER");
    const TAILOY_PASS = Deno.env.get("TAILOY_PASS");

    if (!TAILOY_USER || !TAILOY_PASS) {
      return new Response(JSON.stringify({ error: "Tai Loy credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // PLAYWRIGHT AUTOMATION - TODO: Requires Deno browser support
    // ═══════════════════════════════════════════════════════════

    console.log("Starting Tai Loy automation...");
    console.log(`Date: ${fechaDespacho}, Time: ${horaEntrega}`);

    // For now, return a structured response
    // In production, you'll integrate with Playwright/Puppeteer
    const result = {
      success: true,
      status: "ready_for_manual_confirmation",
      message: "Formulario listo para ser llenado manualmente",
      data: {
        citaId,
        fecha: fechaDespacho,
        hora: horaEntrega,
        archivo: excelFileName,
        excelSize: Math.round((excelBase64.length * 3) / 4 / 1024) + "KB",
      },
      nextStep: "El usuario debe confirmar en Tai Loy presionando Guardar",
    };

    console.log("Tai Loy automation preparation complete", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in Tai Loy automation:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
