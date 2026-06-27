# ⚖️ NextJuris

Modelo de sistema Full Stack para geração automática de relatórios jurídicos utilizando Inteligência Artificial.

O **NextJuris** é uma plataforma moderna desenvolvida para automatizar a criação de documentos e relatórios jurídicos, oferecendo autenticação segura, gerenciamento de usuários e uma arquitetura escalável baseada em tecnologias atuais do ecossistema JavaScript/TypeScript.

## ✨ Tecnologias

### Backend

* Node.js
* TypeScript
* Express 5
* Prisma ORM
* PostgreSQL
* Supabase
* JWT Authentication
* OAuth 2.0 (Google)
* Bcrypt
* Zod
* CORS
* Dotenv

### Frontend

* React 19
* Vite
* TypeScript
* React Router
* Axios
* Context API

### Deploy

* **Frontend:** Netlify
* **Backend:** Render
* **Banco de dados:** Supabase PostgreSQL

---

# Arquitetura

```
Frontend (React + Vite)
            │
            │ HTTP/REST
            ▼
Backend (Express + TypeScript)
            │
            ▼
 Prisma ORM
            │
            ▼
 PostgreSQL (Supabase)
```

---

# Funcionalidades

* Login com JWT
* Login com Google (OAuth 2.0)
* Cadastro de usuários
* Geração automática de relatórios jurídicos
* Integração com Inteligência Artificial
* API REST
* Persistência em PostgreSQL
* Arquitetura desacoplada entre frontend e backend

---

# Pré-requisitos

Antes de iniciar o projeto, instale:

* Node.js 20+
* npm ou yarn
* PostgreSQL (caso não utilize Supabase)
* Git

Verifique as versões:

```bash
node -v
npm -v
git --version
```

---

# Clonando o projeto

```bash
git clone https://github.com/DevRafaelprogrammer/NextJuris.git

cd NextJuris
```

---

# Configuração das variáveis de ambiente

Crie um arquivo `.env` no backend.

Exemplo:

```env
PORT=3000

DATABASE_URL=

JWT_SECRET=

GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=

GOOGLE_CALLBACK_URL=

FRONTEND_URL=http://localhost:5173
```

---

# Instalação

## Backend

```bash
cd backend

npm install
```

## Frontend

```bash
cd frontend

npm install
```

---

# Banco de dados

Execute as migrations:

```bash
npx prisma migrate deploy
```

ou durante o desenvolvimento:

```bash
npx prisma migrate dev
```

Gerar o Prisma Client:

```bash
npx prisma generate
```

---

# Executando o projeto

### Backend

```bash
cd backend

npm run dev
```

Servidor:

```
http://localhost:3000
```

---

### Frontend

```bash
cd frontend

npm run dev
```

Aplicação:

```
http://localhost:5173
```

---

# Build para produção

### Backend

```bash
npm run build

npm start
```

### Frontend

```bash
npm run build
```

Pré-visualização:

```bash
npm run preview
```

---

# Estrutura do projeto

```
NextJuris
│
├── backend
│   ├── src
│   │   ├── controllers
│   │   ├── routes
│   │   ├── middlewares
│   │   ├── services
│   │   ├── prisma
│   │   ├── utils
│   │   └── server.ts
│   │
│   ├── prisma
│   ├── package.json
│   └── tsconfig.json
│
├── frontend
│   ├── src
│   │   ├── components
│   │   ├── pages
│   │   ├── hooks
│   │   ├── services
│   │   ├── context
│   │   └── App.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

# Scripts

## Backend

```bash
npm run dev
npm run build
npm start
npm run lint
```

## Frontend

```bash
npm run dev
npm run build
npm run preview
```

---

# Segurança

* Autenticação JWT
* OAuth 2.0 com Google
* Hash de senhas com Bcrypt
* Validação de dados com Zod
* Variáveis sensíveis protegidas via `.env`
* API preparada para CORS

---

# Autor

**Rafael Programmer**

Desenvolvedor Full Stack especializado em aplicações web modernas utilizando React, Node.js, TypeScript, Express, Prisma ORM e PostgreSQL.

---

## Licença

Este projeto está licenciado sob a licença MIT.
