Configurar envio de e-mail (Gmail App Password)

1) Gerar App Password no Google (recomendado)

- Acesse: https://myaccount.google.com/security
- Ative "Verificação em duas etapas" (caso ainda não esteja ativada).
- Em "Senhas de app" (App passwords), gere uma nova senha escolhendo "Mail" e o dispositivo desejado.
- Copie a senha de 16 caracteres (ex.: abcd efgh ijkl mnop) — este valor será usado em `SMTP_PASS`.

2) Variáveis de ambiente necessárias

Adicione no Railway (ou .env local):

- `APP_URL` = https://catalogointerativo-production.up.railway.app
- `SMTP_USER` = hygordavidaraujo@gmail.com
- `SMTP_PASS` = <App Password gerado (16 chars)>
- `SMTP_PORT` = 465
- `SMTP_SECURE` = true
- `SMTP_FROM` = "Davini Vinhos <noreply@hygordavidaraujo@gmail.com>"
- `JWT_SECRET` = <uma chave forte>
- Variáveis de BD: `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`

3) Instalar dependência (no deploy, execute antes de iniciar a app)

```bash
npm install nodemailer --save
```

4) Teste rápido local

- Defina as variáveis no seu ambiente (PowerShell/Bash) ou no arquivo `.env` (não commit).
- Inicie a app:

```bash
npm run dev
```

- Abra o site, vá ao modal de login → Esqueci minha senha → informe o e-mail.
- Verifique se o e-mail chega; em caso de falha, verifique logs do servidor.

5) Observações de segurança

- Use App Passwords (nunca a senha da conta Google diretamente).
- Proteja `SMTP_PASS` e `JWT_SECRET` no serviço (Railway environment vars) — não os inclua em repositório.
- Garanta que `APP_URL` use HTTPS em produção.

Se quiser, posso automatizar um teste que envia um e-mail de teste ao iniciar o servidor e reporta sucesso/erro nos logs.