# SETH Deployment Plan — Abacus.ai + Vercel

## Current Status
- ✅ SETH repo cloned to `/home/ubuntu/SETH`
- ❌ No Node.js on Abacus SuperComputer (Python-only environment)
- ❌ `jarvisaiassistant.abacusai.app` returns 404 (deployment not active)
- ❌ `sethassistant.digital/api/v1` returns 404 (needs deployment)

## Deployment Options

### Option A: Vercel (AEGIS Recommendation)
**Pros:** Fastest path, Next.js native, zero-config
**Cons:** Requires Node.js locally or in CI

### Option B: Abacus.ai App Deployment
**Pros:** Uses existing Abacus infrastructure, `abacusai.app` subdomain
**Cons:** Requires Node.js to build, or use Abacus AI Agent web interface

### Option C: Abacus.ai SuperComputer + Manual Setup
**Pros:** Full control, uses Abacus cloud
**Cons:** Need to install Node.js, configure reverse proxy

---

## Immediate Next Steps (AEGIS Directive)

### 1. Provision Supabase (15 min)
```bash
# Go to https://supabase.com
# Create new project: "seth-production"
# Get connection string: Settings → Database → Connection string
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

### 2. Prepare SETH Environment
**Required vars** (from `.env.example`):
- `DATABASE_URL` — Supabase connection string
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `VENICE_API_KEY` or `OPENROUTER_API_KEY` — At least one model provider
- `ABACUSAI_API_KEY` — For embeddings/LLM

### 3. Deploy to Vercel (Fastest Path)
```bash
# On a machine with Node.js:
cd SETH
npm install  # or yarn install
npx vercel deploy --prod
# Follow prompts, add environment variables when asked
```

### 4. Alternative: Deploy via Abacus.ai Web Interface
1. Go to https://abacus.ai
2. Create new "App" 
3. Upload SETH repo (or connect GitHub)
4. Abacus AI Agent will build and deploy automatically
5. Custom domain: `jarvisaiassistant.abacusai.app`

---

## Critical Path (AEGIS Recommendation)
1. **Supabase provisioned** (1-2h)
2. **Prisma migrations run** (`npx prisma db push`)
3. **SETH deployed** (Vercel or Abacus)
4. **/api/v1 returns 200**
5. **One agent activated** (HERALD recommended)

---

## Environment-Specific Notes

### For this Abacus SuperComputer:
- Node.js NOT available
- Can prepare files, but cannot build/deploy directly
- Recommend: Use Vercel CLI from local machine, or Abacus web interface

### For Vercel deployment:
- Connect GitHub repo: `j-manchesterllc/SETH`
- Add environment variables in Vercel dashboard
- Auto-deploys on `git push`

### For Abacus deployment:
- Use Abacus AI Agent web interface
- Upload repo or connect GitHub
- Abacus handles build + deployment automatically

---

## Verification Checklist
After deployment:
- [ ] `https://[deployment-url]/api/v1` returns 200 (not 404)
- [ ] Prisma migration successful
- [ ] At least one AI model provider configured
- [ ] NextAuth secret generated
- [ ] Homepage loads (no 404)

---

**Next Action:** Choose deployment target (Vercel vs Abacus) and execute.
**Owner:** Ghost
**Deadline:** ASAP (AEGIS recommends today)
