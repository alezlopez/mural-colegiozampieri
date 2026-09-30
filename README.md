# Mural · Colégio Zampieri

Aplicativo de comunicação da escola: um mural com comunicados, avisos, lembretes, eventos e fotos,
com notificações push. As famílias usam o app **sem login**; a equipe publica pelo **painel admin**.

```
┌──────────────────────┐        ┌──────────────────────────┐        ┌───────────────────┐
│  app/  (Expo)        │  lê    │  Supabase                │ escreve│  admin/ (Next.js) │
│  iOS + Android       │◄───────│  Postgres + RLS          │◄───────│  painel da equipe │
│  sem login           │        │  Storage (fotos)         │        │  login por e-mail │
│  registra token push │───────►│  Auth (só admins)        │        │                   │
└──────────▲───────────┘        └──────────────────────────┘        └─────────┬─────────┘
           │                                                                  │
           │                 Expo Push Service → APNs (Apple) / FCM (Google)  │
           └──────────────────────────────────────────────────────────────────┘
```

| Pasta | O quê |
| --- | --- |
| `app/` | App mobile (Expo SDK 57, Expo Router). Mural com filtros, detalhe com fotos, convite para ativar notificações, deep link da notificação para a publicação. |
| `admin/` | Painel (Next.js 16). Login, lista de publicações, criar/editar/excluir, fixar no topo, upload de fotos (redimensionadas no navegador), envio de push. |
| `supabase/` | Migração do banco: tabelas, políticas RLS, bucket de fotos e função de registro de dispositivos. |

A identidade visual segue o manual: Verde Escuro `#0F3D24`, Verde Médio `#1A5C38`, Verde Claro `#2D7A4E`,
Vinho `#8B1A1A`, Dourado `#B8860B`, Dourado Claro `#D4A017`, Creme `#F5F0E8`, Branco Quente `#FAF8F4`;
títulos em Playfair Display e texto em Lato; faixa tricolor; slogan "Tradição em Educação".

## Segurança (por que funciona sem login)

- O app usa apenas a chave **anon** do Supabase. As políticas RLS só liberam leitura de publicações com
  `status = 'publicado'`. Rascunhos nunca saem do banco para o app.
- Tokens de push ficam numa tabela **sem nenhuma política pública**. O app só consegue gravar via a função
  `registrar_push_token`, que valida o formato do token. Ninguém consegue listar os aparelhos pela API pública.
- Escrita (posts, fotos) exige usuário autenticado **e** presente na tabela `admins` — checado no banco
  (RLS) e no painel.
- A chave `service_role` fica só no servidor do painel, usada para ler tokens e enviar push.

## Passo a passo para colocar no ar

### 1. Supabase

1. Crie um projeto em <https://supabase.com> (região São Paulo).
2. Aplique a migração: `npx supabase link --project-ref <ref>` e `npx supabase db push`
   (ou cole `supabase/migrations/*.sql` no SQL Editor).
3. Em **Authentication → Providers → Email**, desative "Allow new users to sign up" — só você cria contas.
4. Crie cada pessoa da equipe em **Authentication → Users → Add user** e depois libere o acesso:

   ```sql
   insert into public.admins (user_id, nome)
   select id, 'Secretaria' from auth.users where email = 'secretaria@colegiozampieri.com.br';
   ```

### 2. Painel admin (`admin/`)

1. Copie `admin/.env.example` para `admin/.env.local` e preencha (URL, chave anon, chave service_role,
   `CRON_SECRET`).
2. Rodar local: `cd admin && npm install && npm run dev` → <http://localhost:3000>.
3. Produção: importe o repositório na Vercel com **Root Directory = `admin`** e as mesmas variáveis.
   O `vercel.json` agenda a limpeza diária de aparelhos que desinstalaram o app.

### 3. App (`app/`)

1. Copie `app/.env.example` para `app/.env` com a URL e a chave **anon** (nunca a service_role).
2. `cd app && npm install`
3. Crie a conta Expo e vincule o projeto: `npx eas-cli@latest login` e `npx eas-cli@latest init`
   (isso grava o `projectId`, necessário para o push).
4. Credenciais de push:
   - **Android:** projeto no Firebase + chave FCM v1 enviada ao EAS
     ([guia](https://docs.expo.dev/push-notifications/fcm-credentials/)).
   - **iOS:** conta Apple Developer (paga); o `eas build` gera a chave APNs.
5. Build de desenvolvimento para testar em aparelho: `npx eas-cli@latest build --profile development`.
   **Push não funciona no Expo Go** (limitação do Expo desde o SDK 53).
6. Publicação nas lojas: `npx eas-cli@latest build --platform all` e `npx eas-cli@latest submit`.

O app também roda no navegador (`npx expo start --web`) para conferir o layout, mas sem push.

## Próximos passos já previstos na estrutura

- **Portal do aluno / Clube Zampieri:** o Supabase Auth já está no projeto; basta adicionar login no app e
  políticas RLS por perfil (ex.: publicações por turma).
- **Segmentação de push** (por série/turma): adicionar coluna de público-alvo em `posts` e em `push_tokens`.
- **Agendamento de publicações:** exige uma rotina agendada para disparar o push na hora certa.

## Telas

| App — mural | App — publicação | Painel — nova publicação |
| --- | --- | --- |
| ![](docs/telas/app-mural.png) | ![](docs/telas/app-publicacao.png) | ![](docs/telas/painel-nova-publicacao.png) |
