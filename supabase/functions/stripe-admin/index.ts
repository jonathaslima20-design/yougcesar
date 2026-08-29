import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CURRENCIES = ["MXN", "CLP", "EUR", "USD"];
const CYCLES = ["monthly", "annual"];

function maskSecret(value: string): string {
  if (!value || value.length < 12) return "";
  return "****" + value.slice(-6);
}

function validatePrefix(label: string, value: string, expectedPrefix: string): string | null {
  if (!value) return null;
  if (!value.startsWith(expectedPrefix)) {
    return `${label} não parece válida (deveria começar com "${expectedPrefix}")`;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userProfile } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!userProfile || userProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = await req.json();

    switch (action) {
      case "getConfig": {
        const { data: config } = await admin
          .from("stripe_config")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: prices } = await admin
          .from("stripe_prices")
          .select("environment, currency, cycle, price_id");

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  id: config.id,
                  environment: config.environment,
                  publishable_key_test: config.publishable_key_test,
                  secret_key_test: maskSecret(config.secret_key_test),
                  publishable_key_prod: config.publishable_key_prod,
                  secret_key_prod: maskSecret(config.secret_key_prod),
                  webhook_secret_test: config.webhook_secret_test ? "****configurado" : "",
                  webhook_secret_prod: config.webhook_secret_prod ? "****configurado" : "",
                }
              : null,
            prices: prices || [],
            webhook_url: `${supabaseUrl}/functions/v1/stripe-webhook`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "saveConfig": {
        const {
          environment,
          publishable_key_test,
          secret_key_test,
          publishable_key_prod,
          secret_key_prod,
          webhook_secret_test,
          webhook_secret_prod,
        } = payload as Record<string, string>;

        const { data: existing } = await admin
          .from("stripe_config")
          .select("id, secret_key_test, secret_key_prod, webhook_secret_test, webhook_secret_prod")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const updateData: Record<string, unknown> = {
          environment: environment === "production" ? "production" : "test",
          publishable_key_test: publishable_key_test || "",
          publishable_key_prod: publishable_key_prod || "",
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        // Masked values (start with "****") mean "unchanged" — keep the stored one.
        for (const [field, incoming] of [
          ["secret_key_test", secret_key_test],
          ["secret_key_prod", secret_key_prod],
          ["webhook_secret_test", webhook_secret_test],
          ["webhook_secret_prod", webhook_secret_prod],
        ] as const) {
          if (incoming && !incoming.startsWith("****")) {
            updateData[field] = incoming;
          } else if (existing) {
            updateData[field] = (existing as Record<string, string>)[field];
          }
        }

        const credentialErrors = [
          validatePrefix("Publishable Key de teste", updateData.publishable_key_test as string, "pk_test_"),
          validatePrefix("Secret Key de teste", updateData.secret_key_test as string, "sk_test_"),
          validatePrefix("Publishable Key de produção", updateData.publishable_key_prod as string, "pk_live_"),
          validatePrefix("Secret Key de produção", updateData.secret_key_prod as string, "sk_live_"),
        ].filter((e): e is string => !!e);

        if (credentialErrors.length > 0) {
          return new Response(
            JSON.stringify({ error: credentialErrors.join(" | ") }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existing) {
          const { error } = await admin.from("stripe_config").update(updateData).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await admin.from("stripe_config").insert(updateData);
          if (error) throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "testCredentials": {
        const { environment } = payload as { environment: string };

        const { data: config } = await admin
          .from("stripe_config")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!config) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhuma configuração encontrada" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const secretKey = environment === "production" ? config.secret_key_prod : config.secret_key_test;

        if (!secretKey) {
          return new Response(
            JSON.stringify({ success: false, error: "Secret Key não configurada" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const testResponse = await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` },
        });

        if (!testResponse.ok) {
          return new Response(
            JSON.stringify({ success: false, error: "Credenciais inválidas" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "savePrices": {
        const { prices } = payload as {
          prices: { environment: string; currency: string; cycle: string; price_id: string }[];
        };

        for (const p of prices) {
          if (!CURRENCIES.includes(p.currency) || !CYCLES.includes(p.cycle)) continue;
          await admin.from("stripe_prices").upsert(
            {
              environment: p.environment === "production" ? "production" : "test",
              currency: p.currency,
              cycle: p.cycle,
              price_id: p.price_id || "",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "environment,currency,cycle" }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação não reconhecida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
