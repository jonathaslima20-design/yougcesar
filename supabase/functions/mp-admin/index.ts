import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function maskToken(token: string): string {
  if (!token || token.length < 12) return "****";
  return "****" + token.slice(-8);
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
          .from("mercadopago_config")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!config) {
          return new Response(
            JSON.stringify({
              config: null,
              notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            config: {
              id: config.id,
              environment: config.environment,
              public_key_test: config.public_key_test,
              access_token_test: maskToken(config.access_token_test),
              public_key_prod: config.public_key_prod,
              access_token_prod: maskToken(config.access_token_prod),
              webhook_secret: config.webhook_secret ? "****configurado" : "",
              notification_url: config.notification_url,
              is_active: config.is_active,
            },
            notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "saveConfig": {
        const {
          environment,
          public_key_test,
          access_token_test,
          public_key_prod,
          access_token_prod,
          webhook_secret,
          notification_url,
        } = payload as {
          environment: string;
          public_key_test: string;
          access_token_test: string;
          public_key_prod: string;
          access_token_prod: string;
          webhook_secret: string;
          notification_url: string;
        };

        const { data: existing } = await admin
          .from("mercadopago_config")
          .select("id, access_token_test, access_token_prod, webhook_secret")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        const updateData: Record<string, any> = {
          environment: environment || "test",
          public_key_test: public_key_test || "",
          public_key_prod: public_key_prod || "",
          notification_url: notification_url || "",
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        if (access_token_test && !access_token_test.startsWith("****")) {
          updateData.access_token_test = access_token_test;
        } else if (existing) {
          updateData.access_token_test = existing.access_token_test;
        }

        if (access_token_prod && !access_token_prod.startsWith("****")) {
          updateData.access_token_prod = access_token_prod;
        } else if (existing) {
          updateData.access_token_prod = existing.access_token_prod;
        }

        if (webhook_secret && !webhook_secret.startsWith("****")) {
          updateData.webhook_secret = webhook_secret;
        } else if (existing) {
          updateData.webhook_secret = existing.webhook_secret;
        }

        if (existing) {
          const { error } = await admin
            .from("mercadopago_config")
            .update(updateData)
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await admin
            .from("mercadopago_config")
            .insert(updateData);

          if (error) throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "testCredentials": {
        const { data: config } = await admin
          .from("mercadopago_config")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!config) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhuma configuração encontrada" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const accessToken =
          config.environment === "production"
            ? config.access_token_prod
            : config.access_token_test;

        if (!accessToken) {
          return new Response(
            JSON.stringify({ success: false, error: "Access Token não configurado" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const testResponse = await fetch("https://api.mercadopago.com/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!testResponse.ok) {
          return new Response(
            JSON.stringify({ success: false, error: "Credenciais inválidas" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const userData = await testResponse.json();

        return new Response(
          JSON.stringify({
            success: true,
            account: {
              id: userData.id,
              email: userData.email,
              nickname: userData.nickname,
              site_id: userData.site_id,
            },
          }),
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
