# OAuth Launchpad 🚀
### From “I need an integration” to “Here’s what I need to do.”

Connecting an AI agent to an existing app should be straightforward. Getting the OAuth setup right, however, can involve digging through documentation, configuring permissions, creating credentials, setting callback URLs, and sometimes waiting for a provider to approve your application.

**OAuth Launchpad helps developers understand that journey before they get stuck in it.**

Look up an app, explore its OAuth setup guide, understand the likely effort and potential blockers, and share the steps with your team. Looking for an app that isn't in the library? Enter its name or website to generate a guide on demand.

The goal isn't just to explain OAuth. It's to help developers figure out **what to do next, what they can automate, and where a human needs to step in.**

## ✨ What you can do

- **Explore OAuth guides** — Browse a small library of apps and search for the integration you're working on.
- **Understand the work ahead** — Get a difficulty estimate, an approximate setup time, and a breakdown of the steps involved.
- **Spot potential blockers early** — Learn about permissions, provider approvals, credentials, and other requirements that could affect your setup.
- **Generate guides for unfamiliar apps** — Submit an app name or website and use AI to create a guide beyond the existing library.
- **Save and share guides** — Generated guides are stored in Supabase and can be opened through a shareable URL.
- **Know when to take over** — Guidance distinguishes tasks an agent can help with from steps that may require a developer to sign in, grant consent, or make a decision.

## 💡 Why I built it this way

I approached this as a developer workflow problem rather than simply a documentation search page.

When you're planning an integration, the first question often isn't “What is OAuth?” It's “How much work is this going to take, and what could stop me from shipping?”

That shaped a few decisions:

**Start with a useful slice, not a directory of 100 apps.**  
A smaller library makes it possible to focus on the usefulness and clarity of individual guides instead of filling the product with shallow entries.

**Make the next action obvious.**  
A guide should help someone move forward, not leave them with a list of documentation links and unanswered questions.

**Support the long tail.**  
A fixed library will never cover every app a developer might want to connect. On-demand generation provides a path for unfamiliar integrations.

**Be honest about uncertainty.**  
OAuth requirements vary between providers and can change. Generated guidance should help developers investigate and prepare, not pretend that every detail has been independently verified.

## 🧭 How it works

1. Search the available guide library or enter an app name or website.
2. If a matching guide exists, open it. Otherwise, the app requests a new guide from the Supabase Edge Function.
3. The Edge Function sends a structured prompt to the Gemini API and receives a proposed OAuth guide.
4. The generated guide is checked for basic structure and saved in the Supabase `guides` table.
5. The app displays the guide and provides a shareable link.

At a high level, the architecture looks like this:

```text
Developer
    |
    v
React + Vite frontend
    |
    v
Supabase
    |-- PostgreSQL: saved guides
    |
    |-- Edge Function: bright-responder
                |
                v
            Gemini API
                |
                v
         Generated guide
                |
                v
         Saved in Supabase
```

The frontend handles browsing and presentation. Supabase handles persistence and server-side generation. Gemini produces the initial guide content.

## 🛠️ Tech stack

- **React** — Interactive user interface
- **Vite** — Development server and production build
- **Tailwind CSS** — Styling
- **Lucide React** — Icons
- **Supabase** — PostgreSQL database and Edge Functions
- **Gemini API** — On-demand guide generation
- **Vercel** — Frontend deployment

## 🚀 Run it locally

### Prerequisites

You'll need Node.js and npm, a Supabase project, and a Gemini API key.

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/oauth-guide-finder.git
cd oauth-guide-finder
```

Replace `YOUR-USERNAME` with your GitHub username.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Use your own Supabase project values. Never commit this file.

### 4. Configure Supabase secrets

In your Supabase project's Edge Function secrets, configure:

- `GEMINI_API_KEY` — your Gemini API key
- `DB_SECRET_KEY` — the privileged database access key used by the Edge Function

Keep these values on the server. They should never be exposed through frontend environment variables or committed to source control.

The `bright-responder` Edge Function must be deployed to your Supabase project, and the `guides` table must exist with the schema expected by the application.

### 5. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

### 6. Build for production

```bash
npm run build
```

Vite generates the production build in `dist/`.

## ☁️ Deployment

The frontend can be deployed to Vercel:

1. Import the GitHub repository into Vercel.
2. Select the Vite framework preset.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the Vercel environment variables.
6. Deploy and test the public URL.

The Supabase project and its Edge Function remain hosted on Supabase. Configure the Gemini and privileged database secrets there, not in Vercel's frontend environment variables.

## 🔎 Evidence, testing, and limitations

OAuth setup is not identical across providers. A guide can be useful without every step being confirmed, but that distinction matters.

**What the current implementation does:**

- Retrieves saved guides from Supabase.
- Generates structured guide content through Gemini when generation is available.
- Saves generated guides in the database.
- Presents setup steps, estimated effort, approvals, blockers, sources, and caveats.
- Provides shareable guide URLs.

**What it does not currently guarantee:**

- Generated sources are not independently fetched or verified live by the Edge Function.
- Provider-specific setup instructions, scopes, approval requirements, and waiting times may be incomplete or incorrect.
- Generated guides are not proof that an OAuth integration has been successfully configured or tested.
- Estimates are guidance, not promises. Actual approval timelines depend on the provider and the application.
- The library is a focused starting point, not a complete directory of 100 apps.
- AI generation depends on Gemini API availability and quota. Generation may temporarily be unavailable when limits are reached.

For these reasons, verify provider-specific details against official documentation before configuring production credentials or requesting sensitive permissions.

### What I would validate next

The most valuable next step is to check representative guides against official provider documentation, correct inaccuracies, and record which details remain uncertain. A useful guide should make its evidence and limitations visible instead of presenting every AI-generated statement as fact.

## 🔐 Security notes

- Never commit `.env` files, API keys, or privileged database credentials.
- Use the Supabase publishable key for frontend access, with appropriate database access policies.
- Keep Gemini and privileged database credentials in Supabase Edge Function secrets.
- Before exposing the service publicly, add appropriate authentication, request limits, and abuse protection to the generation endpoint.

## 🎯 The idea behind the project

An integration is more than an API endpoint. Someone has to register the application, configure access, understand the permissions, and sometimes wait for approval.

OAuth Launchpad is an attempt to make that hidden work visible before it becomes a blocker — so developers can make better decisions, plan the work, and know when they need to take over.

---

**Built as an APM Integrations take-home project.**
