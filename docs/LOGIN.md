# Login Entre Nós

Login via link por e-mail e Google OAuth, com uma prévia explicitamente local.

## Configuração pendente

1. Criar **um Supabase pessoal independente** dos projetos corporativos.
2. No arquivo `assets/auth-config.js`, preencher somente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (chave pública). Nunca usar `service_role` ou chaves secretas.
3. Em Supabase Auth, cadastrar a URL do site e URLs de redirecionamento autorizadas. Habilitar e-mail com link mágico, e configurar SMTP para uso estável.
4. Para Google, configurar o provedor no Supabase e as credenciais OAuth no Google Cloud; depois definir `GOOGLE_OAUTH_ENABLED = true`.
5. Até a configuração, a interface apresenta login inativo e um modo de prévia local. A prévia não autentica nem sincroniza, e os registros continuam no navegador. Não usar essa prévia como repositório remoto privado.
6. Antes de ativar sincronização de dados de casal, testar o RLS em `supabase/schema.sql` com duas contas de casal e uma terceira sem acesso. Não existe sincronização nesta entrega.

## Testes esperados

- Dispositivos: 320, 375, 768, 1024 e 1440px.
- Sem credenciais públicas: botões de provedores indisponíveis, prévia acessível.
- Com credenciais: link por e-mail, OAuth Google e logout; sessão expirada volta para login.
- Acesso do casal só após a implementação de convites, isolamento de dados e sincronização.
