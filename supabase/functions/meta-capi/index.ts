import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_CAPI_URL = "https://graph.facebook.com/v18.0";

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function loadConfig() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("landing_tracking_config")
    .select("meta_pixel_id, meta_capi_token, meta_capi_enabled, meta_test_event_code")
    .maybeSingle();
  return { config: data, error };
}

async function sendToMeta(
  pixelId: string,
  capiToken: string,
  payload: Record<string, any>
): Promise<{ status: number; body: any }> {
  const url = `${META_CAPI_URL}/${pixelId}/events?access_token=${capiToken}`;
  console.log("[meta-capi] Sending to Meta:", JSON.stringify(payload));
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  console.log("[meta-capi] Meta response:", response.status, JSON.stringify(body));
  return { status: response.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isTest = req.method === "GET" || url.searchParams.has("test");

    console.log("[meta-capi] Request received:", req.method, url.pathname, url.search);

    const { config, error: configError } = await loadConfig();

    if (configError || !config) {
      console.error("[meta-capi] Config load error:", configError);
      return new Response(
        JSON.stringify({ ok: false, message: "Config not found", error: configError?.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pixelId = config.meta_pixel_id?.trim();
    const capiToken = config.meta_capi_token?.trim();
    const capiEnabled = config.meta_capi_enabled;
    const testEventCode = config.meta_test_event_code?.trim();

    console.log("[meta-capi] Config loaded:", {
      pixelId: pixelId ? `${pixelId.substring(0, 4)}...` : "(empty)",
      capiToken: capiToken ? `${capiToken.substring(0, 8)}...` : "(empty)",
      capiEnabled,
      testEventCode: testEventCode || "(none)",
    });

    if (!capiEnabled || !pixelId || !capiToken) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "CAPI not configured or disabled",
          debug: {
            capiEnabled,
            hasPixelId: !!pixelId,
            hasToken: !!capiToken,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET = test mode: sends a PageView event to validate connectivity
    if (isTest) {
      const eventTime = Math.floor(Date.now() / 1000);
      const rawIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
      const clientIp = rawIp.split(",")[0].trim();
      const clientUserAgent = req.headers.get("user-agent") || "";

      const testPayload: Record<string, any> = {
        data: [
          {
            event_name: "PageView",
            event_time: eventTime,
            action_source: "website",
            event_source_url: "https://vitrineturbo.com",
            user_data: {
              ...(clientIp && { client_ip_address: clientIp }),
              ...(clientUserAgent && { client_user_agent: clientUserAgent }),
            },
          },
        ],
      };
      if (testEventCode) {
        testPayload.test_event_code = testEventCode;
      }

      const { status, body } = await sendToMeta(pixelId, capiToken, testPayload);

      return new Response(
        JSON.stringify({
          ok: status >= 200 && status < 300,
          test: true,
          meta_status: status,
          meta_response: body,
          payload_sent: testPayload,
          config_used: {
            pixel_id: pixelId,
            test_event_code: testEventCode || null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST = real event from frontend
    const body = await req.json();
    const { eventName, eventId, eventData = {}, userData = {}, sourceUrl, fbp, fbc } = body;

    console.log("[meta-capi] Event request:", { eventName, eventId, sourceUrl });

    if (!eventName) {
      return new Response(
        JSON.stringify({ ok: false, message: "eventName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventTime = Math.floor(Date.now() / 1000);
    const rawIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const clientIp = rawIp.split(",")[0].trim();
    const clientUserAgent = req.headers.get("user-agent") || "";

    const userDataPayload: Record<string, string> = {};
    if (userData.email) {
      userDataPayload.em = await sha256(userData.email);
    }
    if (userData.phone) {
      userDataPayload.ph = await sha256(userData.phone);
    }
    if (clientIp) {
      userDataPayload.client_ip_address = clientIp;
    }
    if (clientUserAgent) {
      userDataPayload.client_user_agent = clientUserAgent;
    }
    if (fbp) {
      userDataPayload.fbp = fbp;
    }
    if (fbc) {
      userDataPayload.fbc = fbc;
    }

    const eventPayload: Record<string, any> = {
      event_name: eventName,
      event_time: eventTime,
      action_source: "website",
      user_data: userDataPayload,
      custom_data: eventData,
    };

    if (eventId) {
      eventPayload.event_id = eventId;
    }
    if (sourceUrl) {
      eventPayload.event_source_url = sourceUrl;
    }

    const payload: Record<string, any> = {
      data: [eventPayload],
    };

    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    const { status, body: metaResult } = await sendToMeta(pixelId, capiToken, payload);

    return new Response(
      JSON.stringify({
        ok: status >= 200 && status < 300,
        meta_status: status,
        meta_response: metaResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[meta-capi] Unhandled error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error), stack: error?.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
