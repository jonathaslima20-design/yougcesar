# Deploy do Partners v2 pelo painel do Supabase

Siga **nesta ordem**. O frontend só pode ir ao ar depois dos passos 1 e 2.

## 1. Banco de dados (SQL Editor)

1. Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo inteiro de `01_migracoes_partners_v2.sql` e clique em **Run**.
3. Roda numa única transação: se der erro, nada é aplicado. Me mande a mensagem de erro.

Conferência rápida (só leitura), rode depois:

```sql
SELECT count(*) AS perfis_parceiros FROM public.partner_profiles;
SELECT tgname FROM pg_trigger WHERE tgname = 'a_protect_users_sensitive_columns';
SELECT jobname FROM cron.job WHERE jobname = 'partner-daily-maintenance';
```

Se a última consulta vier vazia, ative a extensão **pg_cron** (Database → Extensions) e rode o arquivo de novo.

## 2. Edge functions (Edge Functions → Deploy a new function → Via Editor)

Crie 3 funções, com estes nomes exatos, colando o código de cada arquivo:

| Nome da função    | Arquivo                                           | Verify JWT |
|-------------------|---------------------------------------------------|------------|
| `partner-store`   | `supabase/functions/partner-store/index.ts`       | ligado     |
| `partner-admin`   | `supabase/functions/partner-admin/index.ts`       | ligado     |
| `partner-invites` | `supabase/functions/partner-invites/index.ts`     | **desligado** |

`partner-invites` é chamada pela página pública `/convite/...`, por quem ainda não tem login.

Nenhum segredo novo é necessário (usam SUPABASE_URL, SUPABASE_ANON_KEY e
SUPABASE_SERVICE_ROLE_KEY, que já existem). Opcional: `SITE_URL=https://vitrineturbo.com`.

## 3. Frontend

Só depois dos passos acima: push do código para a `main` (Netlify).
