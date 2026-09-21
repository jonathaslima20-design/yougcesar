import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const USER_AGENT = "VitrineTurbo/1.0 (contato@vitrineturbo.com)";

interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
}

// Public, no auth — called from anonymous storefront checkout (buyer CEP)
// as well as the dashboard (merchant store CEP). Best-effort like
// merchant-shipping-quote: coordinate coverage from the free provider isn't
// 100%, so a miss is a normal `{ latitude: null, longitude: null }` result,
// never a thrown error that could block a checkout flow.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { cep } = await req.json();
    const digits = String(cep || "").replace(/\D/g, "");

    if (digits.length !== 8) {
      return new Response(
        JSON.stringify({ error: "CEP inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: cached } = await admin
      .from("geocoded_ceps")
      .select("latitude, longitude")
      .eq("cep", digits)
      .maybeSingle();

    if (cached) {
      const result: GeocodeResult = { latitude: cached.latitude, longitude: cached.longitude };
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: GeocodeResult = { latitude: null, longitude: null };
    let city: string | null = null;
    let state: string | null = null;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (response.ok) {
        const data = await response.json();
        city = data?.city || null;
        state = data?.state || null;
        // BrasilAPI's v2 "location.coordinates" is a GeoJSON Point whose
        // coordinates come back as an OBJECT ({longitude, latitude}), not
        // the GeoJSON-standard [lng, lat] array — and both values are
        // strings (e.g. "-46.63611"), confirmed by a live call during
        // development. Coordinates are city/neighborhood-centroid
        // precision (IBGE), not rooftop-exact — fine for a delivery-radius
        // estimate, not for turn-by-turn routing.
        const latitude = Number(data?.location?.coordinates?.latitude);
        const longitude = Number(data?.location?.coordinates?.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          result = { latitude, longitude };
        }
      }
    } catch {
      // Network/provider failure — fall through and cache the "no
      // coordinate" outcome anyway, same as a genuine coverage miss. A
      // permanently-down provider shouldn't mean re-trying on every single
      // checkout; a merchant/buyer can always retry later, which re-runs
      // this function since nothing negative-caches forever by exclusion.
    }

    await admin
      .from("geocoded_ceps")
      .upsert({ cep: digits, latitude: result.latitude, longitude: result.longitude, city, state, source: "brasilapi" });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
