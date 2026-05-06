# IAUTHR — Deployment Guide

## Architecture

```
iauthr.com
├── Cloudflare Pages (React PWA frontend)
├── Cloudflare Functions (API routes)
├── Cloudflare D1 (entity-graph database)
├── Cloudflare R2 (audio storage)
├── Cloudflare KV (sessions)
├── Claude API (6 AI agents)
└── GitHub Actions (CI/CD)
```

## Claude Agent Pipeline

Every memo triggers 4 parallel agents:

1. **Entity Extractor** — finds people, pets, places, fears, beliefs
2. **Emotion Detector** — primary emotion, intensity, unresolved tension  
3. **Narrative Steerer** — 2-3 deeper follow-up prompts + cliffhanger
4. **Echo Tracker** — finds thematic connections across all past memos

Additional agents (user-triggered):

5. **Snapshot Agent** — initial onboarding, suggests 5 narrative arcs
6. **Chapter Assembler** — groups memos into chapters with narrative structure

---

## Setup Steps

### 1. Create GitHub Repo

```bash
cd iauthr
git init
git remote add origin https://github.com/kjssamsungdev-max/iauthr.git
git add .
git commit -m "feat: iauthr MVP — impulse memoir engine with Claude agents"
git branch -M main
git push -u origin main
```

### 2. Create Cloudflare Resources

```bash
# Create D1 database
wrangler d1 create iauthr-db
# Copy the database_id into wrangler.toml

# Create R2 bucket for audio
wrangler r2 bucket create iauthr-audio

# Create KV namespace for sessions
wrangler kv namespace create SESSIONS
# Copy the id into wrangler.toml
```

### 3. Run Database Migrations

```bash
# Schema
wrangler d1 execute iauthr-db --file=./migrations/0001_schema.sql --remote

# Seed prompts
wrangler d1 execute iauthr-db --file=./migrations/0002_seed_prompts.sql --remote
```

### 4. Set Secrets

```bash
wrangler secret put ANTHROPIC_API_KEY
# Paste your Claude API key

wrangler secret put JWT_SECRET
# Generate: openssl rand -hex 32
```

### 5. GitHub Secrets (for CI/CD)

In repo Settings → Secrets → Actions, add:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages + D1 + R2 permissions
- `CLOUDFLARE_ACCOUNT_ID` — `dbaac4c99956159d7594d90033b0224d`

### 6. Deploy

```bash
npm install
npm run build
npm run deploy
```

Or push to `main` — GitHub Actions deploys automatically.

### 7. DNS

Point `iauthr.com` to the Cloudflare Pages project:
- CNAME `iauthr.com` → `iauthr.pages.dev`
- CNAME `www.iauthr.com` → `iauthr.pages.dev`

---

## File Structure

```
iauthr/
├── .github/workflows/deploy.yml    # CI/CD
├── functions/api/                   # Cloudflare Functions (API)
│   ├── memos.ts                     # POST/GET memos (sparks)
│   ├── entities.ts                  # CRUD entities
│   ├── chapters.ts                  # Chapter assembly
│   ├── prompts.ts                   # Prompt library
│   └── snapshot.ts                  # Onboarding snapshot
├── migrations/
│   ├── 0001_schema.sql              # D1 schema (12 tables)
│   └── 0002_seed_prompts.sql        # 35 inspirational prompts
├── public/
│   ├── manifest.json                # PWA manifest
│   └── favicon.svg
├── src/
│   ├── agents/index.ts              # 6 Claude agents
│   ├── components/IauthrApp.tsx     # Core app component
│   ├── App.tsx                      # App wrapper
│   ├── main.tsx                     # Entry point
│   └── global.css
├── index.html                       # HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
└── DEPLOY.md
```

## D1 Tables (12)

| Table | Purpose |
|-------|---------|
| users | Auth, settings, truth mode |
| memos | All sparks (voice/text) with AI metadata |
| entities | People, pets, places, fears, beliefs, etc. |
| memo_entities | Many-to-many linking |
| entity_relationships | Cross-entity graph |
| chapters | Assembled narrative chapters |
| prompts | Inspirational prompt library |
| agent_logs | All Claude API call logs |
| books | Assembled manuscripts for export |
| triggers | User-configured real-world triggers |

## Agent Cost Estimate

Per memo (4 parallel agents):
- Entity Extractor: ~500 input / ~200 output tokens
- Emotion Detector: ~400 input / ~150 output tokens
- Narrative Steerer: ~600 input / ~250 output tokens
- Echo Tracker: ~800 input / ~200 output tokens

**Total per memo: ~2,300 input + ~800 output tokens**
At Sonnet pricing (~$3/M input, $15/M output): **~$0.019 per memo**

100 memos/month = ~$1.90/month in Claude costs.

---

## Post-Deploy Checklist

- [ ] Verify D1 tables created (`wrangler d1 execute iauthr-db --command "SELECT name FROM sqlite_master WHERE type='table'" --remote`)
- [ ] Verify R2 bucket exists
- [ ] Test POST /api/memos with a sample memo
- [ ] Verify Claude agents return structured JSON
- [ ] Hard-refresh browser (Ctrl+Shift+R) or incognito
- [ ] Test voice recording on mobile Safari + Chrome
- [ ] Check PWA install prompt appears
