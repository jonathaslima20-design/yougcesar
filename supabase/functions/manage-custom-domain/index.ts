import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BLOCKED_DOMAINS = [
  "vitrineturbo.com",
  "www.vitrineturbo.com",
  "netlify.app",
  "netlify.com",
  "google.com",
  "facebook.com",
  "instagram.com",
  "whatsapp.com",
  "supabase.co",
  "vercel.app",
  "github.com",
];

function isValidDomain(domain: string): boolean {
  const pattern = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
  return pattern.test(domain) && domain.length <= 253;
}

function isDomainBlocked(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  return BLOCKED_DOMAINS.some(
    (blocked) =>
      normalized === blocked ||
      normalized === blocked.replace(/^www\./, "") ||
      normalized.endsWith("." + blocked) ||
      normalized.endsWith("." + blocked.replace(/^www\./, ""))
  );
}

function generateVerificationToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "vt-verify-";
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

interface NetlifyCredentials {
  accessToken: string;
  siteId: string;
  siteName: string;
}

async function getNetlifyCredentials(
  supabase: ReturnType<typeof createClient>
): Promise<NetlifyCredentials | null> {
  const { data } = await supabase
    .from("netlify_integration_config")
    .select("access_token, site_id, site_name")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data && data.access_token && data.site_id) {
    return {
      accessToken: data.access_token,
      siteId: data.site_id,
      siteName: (data.site_name || "").trim(),
    };
  }

  const envToken = Deno.env.get("NETLIFY_ACCESS_TOKEN");
  const envSiteId = Deno.env.get("NETLIFY_SITE_ID");
  const envSiteName = Deno.env.get("NETLIFY_SITE_NAME");

  if (envToken && envSiteId) {
    return {
      accessToken: envToken,
      siteId: envSiteId,
      siteName: (envSiteName || "").trim(),
    };
  }

  return null;
}

function normalizeSiteName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.netlify\.app$/i, "");
}

function buildCnameValue(siteName: string): string {
  const normalized = normalizeSiteName(siteName);
  return normalized ? `${normalized}.netlify.app` : "vitrineturbo.netlify.app";
}

function buildInstructions(domain: string, verificationToken: string, _siteName: string) {
  const baseDomain = domain.replace(/^www\./, "");
  return {
    txt_host: `_vitrineturbo-verify.${baseDomain}`,
    txt_value: verificationToken,
  };
}

async function syncSiteNameIfChanged(
  supabase: ReturnType<typeof createClient>,
  storedName: string,
  apiName: string | null | undefined
) {
  if (!apiName) return;
  const normalizedApi = normalizeSiteName(apiName);
  const normalizedStored = normalizeSiteName(storedName);
  if (!normalizedApi || normalizedApi === normalizedStored) return;

  await supabase
    .from("netlify_integration_config")
    .update({ site_name: normalizedApi, updated_at: new Date().toISOString() })
    .eq("site_name", storedName);
}

function friendlyNetlifyError(message: string): string {
  if (message.includes("primary custom domain is not set")) {
    return "O site no Netlify nao possui um Primary Domain configurado. Acesse o painel do Netlify > Domain management e defina o dominio principal antes de ativar dominios customizados.";
  }
  if (message.includes("401") || message.includes("Unauthorized")) {
    return "Token de acesso do Netlify invalido ou expirado. Atualize as credenciais no painel admin.";
  }
  if (message.includes("404")) {
    return "Site Netlify nao encontrado. Verifique se o Site ID esta correto no painel admin.";
  }
  return `Erro ao ativar no Netlify: ${message}`;
}

function isNetlifyRateLimitError(status: number, body: string): boolean {
  return status === 422 && body.includes("can only be changed 3 times per hour");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, plan_status, billing_cycle, slug, role")
      .eq("id", user.id)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    if (action === "test-connection") {
      if (userData.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Acesso restrito a administradores." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return await handleTestConnection(req, supabase);
    }

    if (userData.plan_status !== "active") {
      return new Response(
        JSON.stringify({ error: "Este recurso esta disponivel apenas para assinantes de um plano pago." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = await getNetlifyCredentials(supabase);

    switch (action) {
      case "register":
        return await handleRegister(req, supabase, user.id, credentials);
      case "verify-dns":
        return await handleVerifyDns(supabase, user.id);
      case "activate":
        return await handleActivate(supabase, user.id, credentials);
      case "remove":
        return await handleRemove(supabase, user.id, credentials);
      case "status":
        return await handleStatus(supabase, user.id, credentials);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in manage-custom-domain:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleTestConnection(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  let bodyToken: string | undefined;
  let bodySiteId: string | undefined;

  try {
    const body = await req.json();
    bodyToken = body?.access_token;
    bodySiteId = body?.site_id;
  } catch {
    // No body provided
  }

  let accessToken = bodyToken;
  let siteId = bodySiteId;

  if (!accessToken || !siteId) {
    const stored = await getNetlifyCredentials(supabase);
    if (!stored) {
      return new Response(
        JSON.stringify({ error: "Nenhuma credencial Netlify configurada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    accessToken = accessToken || stored.accessToken;
    siteId = siteId || stored.siteId;
  }

  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `Falha ao conectar com Netlify (status ${response.status}).`;
      if (response.status === 401) {
        errorMessage = "Token de acesso do Netlify invalido ou sem permissao para este site.";
      } else if (response.status === 404) {
        errorMessage = "Site Netlify nao encontrado. Verifique o Site ID.";
      }
      return new Response(
        JSON.stringify({ ok: false, error: errorMessage, details: text.slice(0, 500) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const site = await response.json();
    const primaryDomain: string | null = site.custom_domain || null;
    const aliases: string[] = site.domain_aliases || [];

    return new Response(
      JSON.stringify({
        ok: true,
        site_name: site.name || null,
        site_url: site.url || null,
        primary_domain: primaryDomain,
        primary_domain_set: !!primaryDomain,
        aliases_count: aliases.length,
        aliases,
        warning: !primaryDomain
          ? "Este site nao tem um Primary Domain configurado. A ativacao de dominios customizados ira falhar com erro 422 ate que voce defina um dominio principal no painel do Netlify."
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Test connection error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Erro ao conectar com a API do Netlify.",
        details: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleRegister(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: NetlifyCredentials | null
) {
  const { domain } = await req.json();

  if (!domain || typeof domain !== "string") {
    return new Response(
      JSON.stringify({ error: "Dominio invalido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const normalizedDomain = domain.toLowerCase().trim();

  if (!isValidDomain(normalizedDomain)) {
    return new Response(
      JSON.stringify({ error: "Formato de dominio invalido. Use um dominio valido como: www.seudominio.com.br" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (isDomainBlocked(normalizedDomain)) {
    return new Response(
      JSON.stringify({ error: "Este dominio nao pode ser utilizado." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: existing } = await supabase
    .from("custom_domains")
    .select("id")
    .eq("domain", normalizedDomain)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: "Este dominio ja esta em uso por outro usuario." }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await supabase.from("custom_domains").delete().eq("user_id", userId);

  const verificationToken = generateVerificationToken();

  const { data, error } = await supabase
    .from("custom_domains")
    .insert({
      user_id: userId,
      domain: normalizedDomain,
      status: "pending_dns",
      verification_token: verificationToken,
    })
    .select()
    .single();

  if (error) {
    console.error("Error registering domain:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao registrar dominio." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      domain: data,
      instructions: buildInstructions(normalizedDomain, verificationToken, credentials?.siteName || ""),
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleVerifyDns(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: domainRecord, error } = await supabase
    .from("custom_domains")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !domainRecord) {
    return new Response(
      JSON.stringify({ error: "Nenhum dominio registrado." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (domainRecord.status === "active") {
    return new Response(
      JSON.stringify({ success: true, message: "Dominio ja esta ativo.", domain: domainRecord }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const baseDomain = domainRecord.domain.replace(/^www\./, "");
  const txtHost = `_vitrineturbo-verify.${baseDomain}`;

  let verified = false;

  try {
    const dnsResponse = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(txtHost)}&type=TXT`
    );
    const dnsData = await dnsResponse.json();

    if (dnsData.Answer && Array.isArray(dnsData.Answer)) {
      for (const answer of dnsData.Answer) {
        const txtValue = (answer.data || "").replace(/"/g, "").trim();
        if (txtValue === domainRecord.verification_token) {
          verified = true;
          break;
        }
      }
    }
  } catch (dnsError) {
    console.error("DNS lookup error:", dnsError);
    return new Response(
      JSON.stringify({ error: "Erro ao verificar DNS. Tente novamente em alguns minutos." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!verified) {
    await supabase
      .from("custom_domains")
      .update({ status: "pending_dns", updated_at: new Date().toISOString() })
      .eq("id", domainRecord.id);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Registro TXT nao encontrado. Verifique se o registro DNS foi configurado corretamente e aguarde a propagacao (pode levar ate 48 horas).",
        domain: { ...domainRecord, status: "pending_dns" },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await supabase
    .from("custom_domains")
    .update({ status: "dns_verified", updated_at: new Date().toISOString() })
    .eq("id", domainRecord.id);

  return new Response(
    JSON.stringify({
      success: true,
      message: "DNS verificado com sucesso! Voce pode agora ativar o dominio.",
      domain: { ...domainRecord, status: "dns_verified" },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleActivate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: NetlifyCredentials | null
) {
  if (!credentials) {
    return new Response(
      JSON.stringify({ error: "Credenciais do Netlify nao configuradas. Acesse o painel admin > Integracao Netlify para configurar." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { accessToken, siteId } = credentials;

  const { data: domainRecord, error } = await supabase
    .from("custom_domains")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !domainRecord) {
    return new Response(
      JSON.stringify({ error: "Nenhum dominio registrado." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (domainRecord.status !== "dns_verified" && domainRecord.status !== "error") {
    return new Response(
      JSON.stringify({ error: "O DNS precisa ser verificado antes de ativar o dominio." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const getSiteResponse = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!getSiteResponse.ok) {
      throw new Error(`Failed to get site info: ${getSiteResponse.status}`);
    }

    const siteData = await getSiteResponse.json();
    await syncSiteNameIfChanged(supabase, credentials.siteName, siteData.name);

    const currentAliases: string[] = siteData.domain_aliases || [];

    if (!currentAliases.includes(domainRecord.domain)) {
      currentAliases.push(domainRecord.domain);
    }

    const updateResponse = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain_aliases: currentAliases }),
      }
    );

    if (!updateResponse.ok) {
      const errorBody = await updateResponse.text();

      if (isNetlifyRateLimitError(updateResponse.status, errorBody)) {
        const retryAfter = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await supabase
          .from("custom_domains")
          .update({
            netlify_rate_limited_until: retryAfter,
            updated_at: new Date().toISOString(),
          })
          .eq("id", domainRecord.id);

        return new Response(
          JSON.stringify({
            error: "rate_limited",
            rate_limited: true,
            retry_after: retryAfter,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Failed to update site aliases: ${updateResponse.status} - ${errorBody}`);
    }

    const now = new Date().toISOString();
    await supabase
      .from("custom_domains")
      .update({ status: "active", activated_at: now, updated_at: now, error_message: null, netlify_rate_limited_until: null })
      .eq("id", domainRecord.id);

    await supabase
      .from("users")
      .update({ custom_domain: domainRecord.domain })
      .eq("id", userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Dominio ativado com sucesso! O SSL sera provisionado automaticamente em alguns minutos.",
        domain: { ...domainRecord, status: "active", activated_at: now },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (activateError) {
    console.error("Netlify activation error:", activateError);

    const rawMessage = activateError instanceof Error ? activateError.message : "Unknown error";
    const friendlyMessage = friendlyNetlifyError(rawMessage);

    await supabase
      .from("custom_domains")
      .update({
        status: "error",
        error_message: friendlyMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", domainRecord.id);

    return new Response(
      JSON.stringify({ error: friendlyMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleRemove(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: NetlifyCredentials | null
) {
  const { data: domainRecord, error } = await supabase
    .from("custom_domains")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !domainRecord) {
    return new Response(
      JSON.stringify({ error: "Nenhum dominio registrado." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (domainRecord.status === "active" && credentials) {
    const { accessToken, siteId } = credentials;
    try {
      const getSiteResponse = await fetch(
        `https://api.netlify.com/api/v1/sites/${siteId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (getSiteResponse.ok) {
        const siteData = await getSiteResponse.json();
        const currentAliases: string[] = (siteData.domain_aliases || []).filter(
          (alias: string) => alias !== domainRecord.domain
        );

        await fetch(
          `https://api.netlify.com/api/v1/sites/${siteId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ domain_aliases: currentAliases }),
          }
        );
      }
    } catch (netlifyError) {
      console.error("Error removing domain from Netlify:", netlifyError);
    }
  }

  await supabase.from("custom_domains").delete().eq("id", domainRecord.id);

  await supabase
    .from("users")
    .update({ custom_domain: null })
    .eq("id", userId);

  return new Response(
    JSON.stringify({ success: true, message: "Dominio removido com sucesso." }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: NetlifyCredentials | null
) {
  const { data: domainRecord, error } = await supabase
    .from("custom_domains")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return new Response(
      JSON.stringify({ error: "Erro ao buscar status do dominio." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let instructions = null;
  if (domainRecord && domainRecord.status === "pending_dns" && domainRecord.verification_token) {
    instructions = buildInstructions(
      domainRecord.domain,
      domainRecord.verification_token,
      credentials?.siteName || ""
    );
  }

  const rateLimitedUntil = domainRecord?.netlify_rate_limited_until ?? null;
  const now = new Date();
  const activeRateLimit =
    rateLimitedUntil && new Date(rateLimitedUntil) > now ? rateLimitedUntil : null;

  return new Response(
    JSON.stringify({ domain: domainRecord, instructions, rate_limited_until: activeRateLimit }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
