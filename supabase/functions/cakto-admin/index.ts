import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CAKTO_API_BASE = "https://api.cakto.com.br/public_api";

function maskSecret(value: string): string {
  if (!value || value.length < 8) return "";
  return "****" + value.slice(-6);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userProfile } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();

    if (!userProfile || userProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, payload } = await req.json();

    switch (action) {
      case "getConfig": {
        const { data: config } = await admin
          .from("cakto_config")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: offers } = await admin
          .from("cakto_offers")
          .select("id, environment, plan_id, billing_cycle, product_id, offer_id, subscription_plans(name)")
          .order("billing_cycle", { ascending: true });

        return new Response(
          JSON.stringify({
            config: config
              ? {
                  id: config.id,
                  environment: config.environment,
                  client_id_test: config.client_id_test,
                  client_secret_test: maskSecret(config.client_secret_test),
                  client_id_prod: config.client_id_prod,
                  client_secret_prod: maskSecret(config.client_secret_prod),
                  sdk_client_id_test: config.sdk_client_id_test,
                  sdk_client_id_prod: config.sdk_client_id_prod,
                  webhook_secret: config.webhook_secret ? "****configurado" : "",
                  pix_enabled: config.pix_enabled,
                  is_active: config.is_active,
                }
              : null,
            offers: offers || [],
            webhook_url: `${supabaseUrl}/functions/v1/cakto-webhook`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "saveConfig": {
        const {
          environment,
          client_id_test,
          client_secret_test,
          client_id_prod,
          client_secret_prod,
          sdk_client_id_test,
          sdk_client_id_prod,
          webhook_secret,
          pix_enabled,
          is_active,
        } = payload as Record<string, unknown>;

        const { data: existing } = await admin
          .from("cakto_config")
          .select("id, client_secret_test, client_secret_prod, webhook_secret")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const updateData: Record<string, unknown> = {
          environment: environment === "production" ? "production" : "test",
          client_id_test: client_id_test || "",
          client_id_prod: client_id_prod || "",
          sdk_client_id_test: sdk_client_id_test || "",
          sdk_client_id_prod: sdk_client_id_prod || "",
          pix_enabled: !!pix_enabled,
          is_active: is_active !== false,
          updated_at: new Date().toISOString(),
        };

        for (const [field, incoming] of [
          ["client_secret_test", client_secret_test],
          ["client_secret_prod", client_secret_prod],
          ["webhook_secret", webhook_secret],
        ] as const) {
          const incomingStr = incoming as string | undefined;
          if (incomingStr && !incomingStr.startsWith("****")) {
            updateData[field] = incomingStr;
          } else if (existing) {
            updateData[field] = (existing as Record<string, string>)[field];
          }
        }

        if (existing) {
          const { error } = await admin.from("cakto_config").update(updateData).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await admin.from("cakto_config").insert(updateData);
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "testCredentials": {
        const { environment } = payload as { environment: string };

        const { data: config } = await admin
          .from("cakto_config")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!config) {
          return new Response(JSON.stringify({ success: false, error: "Nenhuma configuração encontrada" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const clientId = environment === "production" ? config.client_id_prod : config.client_id_test;
        const clientSecret = environment === "production" ? config.client_secret_prod : config.client_secret_test;

        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ success: false, error: "Credenciais não configuradas" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tokenResponse = await fetch(`${CAKTO_API_BASE}/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
          }),
        });

        if (!tokenResponse.ok) {
          return new Response(JSON.stringify({ success: false, error: "Credenciais inválidas" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "saveOffers": {
        const { offers } = payload as {
          offers: { environment: string; plan_id: string; billing_cycle: string; product_id: string; offer_id: string }[];
        };

        for (const o of offers) {
          if (!o.plan_id || !o.billing_cycle) continue;
          await admin.from("cakto_offers").upsert(
            {
              environment: o.environment === "production" ? "production" : "test",
              plan_id: o.plan_id,
              billing_cycle: o.billing_cycle,
              product_id: o.product_id || "",
              offer_id: o.offer_id || "",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "environment,plan_id,billing_cycle" }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "deleteOffer": {
        const { id } = payload as { id: string };
        await admin.from("cakto_offers").delete().eq("id", id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
