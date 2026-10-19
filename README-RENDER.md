# Sentinela — Deploy no Render

## Configuração
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

O servidor já usa `process.env.PORT` e escuta em `0.0.0.0`, como o Render exige.

## Deploy
1. Envie o conteúdo desta pasta para um repositório no GitHub.
2. No Render: **New → Web Service**.
3. Conecte o repositório.
4. Se o Render não importar o `render.yaml` automaticamente, use os comandos acima.
5. Crie o serviço.
6. Após o deploy, abra a URL `https://SEU-SERVICO.onrender.com/`.
7. Teste `https://SEU-SERVICO.onrender.com/health` e confirme `{"status":"ok"}`.

## Importante sobre o banco
O sistema atual grava os dados em `backend/db.json`. O disco do serviço não deve ser tratado como banco permanente em produção. Para uso real, migre para um banco persistente (por exemplo, PostgreSQL) ou configure um Persistent Disk conforme a necessidade do projeto.
