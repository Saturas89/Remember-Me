# Deployment – Remember Me

**Hosting:** Vercel (statische SPA)

---

## Setup

```
Repository: saturas89/remember-me
Auto-Deploy: main-Branch → Vercel
Build: npm ci → npm run build → Deploy
```

## vercel.json

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci"
}
```

## Workflow

```
git push origin main
  → Vercel: npm ci → npm run build → Deploy
  → App live in 2-5 Minuten
```

## Environment Variables

Secrets nur im Vercel Dashboard setzen (Settings → Environment Variables), niemals in Code oder `vercel.json`.

## Rollback

Vercel Dashboard → Deployments → Älteres Deployment → "Promote to Production"
