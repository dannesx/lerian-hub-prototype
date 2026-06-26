<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=220&section=header&text=Lerian%20Hub&fontSize=60&fontColor=fff&animation=twinkling&fontAlignY=35&desc=Portal%20Unificado%20%E2%80%94%20Shell%20Fino%20%2B%20SSO%20%2B%20Apps%20Independentes&descAlignY=55&descSize=18" width="100%" alt="Lerian Hub" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/sindarian--ui-1.1-7C3AED?style=flat-square" alt="sindarian-ui" />
  <img src="https://img.shields.io/badge/Status-Prot%C3%B3tipo-FF8C00?style=flat-square" alt="Status" />
</p>

<p align="center">
  <strong>Protótipo navegável da <em>Opção A</em> para o portal unificado da Lerian: um shell fino compartilhado + SSO único + apps independentes, cada um em seu próprio subdomínio.</strong>
</p>

<p align="center">
  <a href="#-visão-geral">Visão Geral</a> &bull;
  <a href="#-como-rodar">Como Rodar</a> &bull;
  <a href="#-arquitetura">Arquitetura</a> &bull;
  <a href="#-rotas">Rotas</a> &bull;
  <a href="#-home-customizável">Home</a> &bull;
  <a href="#-stack">Stack</a>
</p>

---

## Table of Contents

<details>
<summary>Expandir</summary>

- [Visão Geral](#-visão-geral)
- [Como Rodar](#-como-rodar)
- [Arquitetura](#-arquitetura)
- [Rotas](#-rotas)
- [Home Customizável](#-home-customizável)
- [Estrutura](#-estrutura)
- [Stack](#-stack)
- [Notas](#-notas)

</details>

---

## &#x2728; Visão Geral

A ideia central: em vez de um monólito que troca telas via `<div>`, cada app é um **deploy separado no seu próprio subdomínio**. O único elo entre eles é uma **barra-shell compartilhada** e uma **sessão SSO única**. Em produção, navegar entre apps seria um page load real para outro subdomínio; aqui usamos uma única aplicação Next.js para demonstrar a experiência ponta a ponta.

> Reconstrução do protótipo estático (HTML/CSS/JS) como uma **app Next.js 16 (App Router)** usando **`@lerianstudio/sindarian-ui`** — a lib de componentes shadcn/Radix/Tailwind v4 com os tokens Lerian.

| | Pilar | Descrição |
|:---:|:---|:---|
| &#x1F9E9; | **Shell compartilhado** | Barra superior, assistente Sindarian e menu de conta, embutidos em toda página autenticada |
| &#x1F510; | **SSO único** | Uma sessão para todos os apps (mock em `localStorage`); em produção, cookie em `.lerian.studio` |
| &#x1F4E6; | **Apps independentes** | Cada app é uma rota aqui, mas representa um deploy próprio por subdomínio |
| &#x2728; | **Assistente Sindarian** | Drawer lateral (`⌘K` / `Ctrl+K`) que responde com dados ilustrativos e roteia para o app relevante |
| &#x1F3A8; | **Home customizável** | Grade "Seus apps" reordenável e ocultável, com preferências persistidas |
| &#x1F6E1;&#xFE0F; | **Auth guard** | `RouteGuard`: toda rota exige a sessão do Hub; sem ela, redireciona para `/login` |

> &#x26A0;&#xFE0F; Todos os dados (contagens, health scores, tickets, releases) são **ilustrativos de UX**, não reais.

---

## &#x1F680; Como Rodar

### Pré-requisitos

- **Node.js 20+** (testado no 24) e **npm**
- O `@lerianstudio/sindarian-ui` é **público no npm** — não é preciso registry privado nem token

### Primeiro boot

```bash
git clone git@github.com:LerianStudio/lerian-hub-prototype.git
cd lerian-hub-prototype
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Sem sessão, você é redirecionado para `/login`.

### Fluxo

1. **`/login`** — estado não-logado. "Entrar com a conta Lerian" cria a sessão SSO (mock em `localStorage`).
2. **`/`** — launcher: grade de apps + assistente Sindarian.
3. Clique em qualquer card → navega para o app.
4. **Sair** (menu da conta, no avatar) limpa a sessão e volta ao login.

### Scripts

| Comando | O que faz |
|:---|:---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm run lint` | ESLint |

---

## &#x1F3D7;&#xFE0F; Arquitetura

### Visão do sistema

```mermaid
graph TB
    Browser(["Browser"])

    subgraph Proto ["App Next.js 16 (localhost:3000) — o protótipo"]
        Guard["RouteGuard\nexige sessão do Hub"]
        Shell["Shell compartilhado\nTopBar · Sindarian · AccountMenu"]
        Home["Home / Launcher\ngrade de apps"]
        Apps["Apps\ntickets · gantt · releases · …"]
    end

    subgraph Session ["Sessão"]
        LS[("localStorage\nsin_auth · hub_app_prefs · sin_theme")]
    end

    Browser --> Guard
    Guard -->|sem sessão| Login["/login"]
    Guard -->|com sessão| Shell
    Shell --> Home
    Shell --> Apps
    Home --> Apps
    Guard -.-> LS
    Login -.->|cria sessão| LS
```

### Produção vs. protótipo

```mermaid
graph LR
    subgraph Prod ["Em produção"]
        SSO["SSO\ncookie .lerian.studio"]
        H["hub.lerian.studio"]
        T["tickets.lerian.studio"]
        R["releases.lerian.studio"]
        SSO --- H
        SSO --- T
        SSO --- R
    end

    subgraph Now ["Neste protótipo"]
        Mock["localStorage 'sin_auth'"]
        Routes["Rotas numa única app Next.js\n/ · /tickets · /releases · …"]
        Mock --- Routes
    end
```

| Camada | O que é no protótipo | O que seria em produção |
|:---|:---|:---|
| Shell compartilhado | `components/shell/` (barra superior + Sindarian + menu da conta) | Lib/componente publicado, embutido por cada app |
| Sessão | `localStorage 'sin_auth'` (ver `components/auth/`) | Sessão SSO (cookie em `.lerian.studio`) |
| Apps | Rotas dentro de uma app Next.js | Deploys independentes por subdomínio |

---

## &#x1F9ED; Rotas

| Rota | Subdomínio (produção) | App |
|:---|:---|:---|
| `/login` | — | Login / criação da sessão SSO (sem shell) |
| `/` | `hub.lerian.studio` | Launcher (grade de apps + assistente) |
| `/tickets` | `tickets.lerian.studio` | Tickets |
| `/gantt` | `gantt.lerian.studio` | Gantt |
| `/releases` | `releases.lerian.studio` | Releases |
| `/client` | `cliente.lerian.studio` | Visão 360 |
| `/onboarding` | `onboarding.lerian.studio` | Onboarding |
| `/oncall` | `oncall.lerian.studio` | On-call |
| `/reunioes` | `reunioes.lerian.studio` | Reuniões |
| `/sla` | `sla.lerian.studio` | Saúde SLA |
| `/opspedia` | `opspedia.lerian.studio` | Opspedia |
| `/config` | — | Configurações da conta |

---

## &#x1F3A8; Home Customizável

A seção **"Seus apps"** da home é personalizável, com preferências persistidas em `localStorage` (`hub_app_prefs`):

- **Reordenar** e **mostrar/ocultar** cada app pelo modal **"Gerenciar apps"** (arraste pela alça ou use as setas do teclado).
- **Remover da home** direto pelo menu ⋯ de cada card, com **toast de "Desfazer"**.
- **Estado vazio** quando todos os apps são ocultados, com atalho para reabrir o modal.

---

## &#x1F5C2;&#xFE0F; Estrutura

```
.
├── app/
│   ├── layout.tsx          ← html/body, fontes, providers
│   ├── globals.css         ← importa o CSS da sindarian-ui + tokens de fonte
│   ├── login/page.tsx      ← login (sem shell)
│   └── (app)/              ← grupo autenticado (shell + RouteGuard)
│       ├── layout.tsx
│       ├── page.tsx        ← Home / launcher
│       ├── tickets/        gantt/        releases/
│       ├── client/         onboarding/   oncall/
│       ├── reunioes/       sla/          opspedia/
│       └── config/
├── components/
│   ├── auth/               ← AuthProvider + RouteGuard
│   ├── shell/              ← TopBar, WaffleLauncher, AccountMenu, Sindarian
│   ├── ui-app/             ← blocos reutilizáveis (ScreenTitle, Kpi, Panel, Row, spacing…)
│   └── home/               ← grade de apps, modal "Gerenciar apps", saudação, status
└── lib/
    ├── apps.ts             ← registro de apps + identidade do usuário
    ├── app-prefs.ts        ← preferências da home (ordem/visibilidade) em localStorage
    ├── sindarian.tsx       ← insights e respostas do assistente
    └── utils.ts            ← cn()
```

---

## &#x1F6E0;&#xFE0F; Stack

**Runtime & Framework**

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=flat-square&logo=typescript&logoColor=white)

**UI & Styling**

![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![sindarian-ui](https://img.shields.io/badge/@lerianstudio%2Fsindarian--ui-7C3AED?style=flat-square)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=flat-square&logo=shadcnui&logoColor=white)
![Radix](https://img.shields.io/badge/Radix_UI-161618?style=flat-square&logo=radixui&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide_React-F56565?style=flat-square)

**Interações**

![dnd-kit](https://img.shields.io/badge/dnd--kit-reordenar-2D3748?style=flat-square)
![react-hook-form](https://img.shields.io/badge/React_Hook_Form-EC5990?style=flat-square&logo=reacthookform&logoColor=white)

---

## &#x26A0;&#xFE0F; Notas

- Este é um **protótipo de UX**. Não há backend, persistência real nem autenticação de verdade — a sessão é um mock em `localStorage` e todos os números são ilustrativos.
- O comportamento de "subdomínio por app" é simulado por rotas; a coluna de subdomínios nas tabelas indica o destino pretendido em produção.
