# Deployment Guide (Vercel)

This application is ready for Vercel deployment. Follow these steps to deploy.

## 1. Environment Variables
Set the following Environment Variables in your Vercel Project Settings:

| Variable | Description |
|---|---|
| `DATABASE_URL` | **Neon Pooled Connection URL** (Connection pooling is required for serverless). |
| `OPENAI_API_KEY` | Your OpenAI API Key. |
| `OPENAI_MODEL` | (Optional) Model to use, e.g., `gpt-3.5-turbo` or `gpt-4o-mini`. Defaults to `gpt-4o-mini`. |
| `JWT_SECRET` | A long random string for session security. |

## 2. Database Setup via Vercel
1. Ensure your `DATABASE_URL` uses the **pooled** connection (`sslmode=require` is usually needed).
   - Example: `postgres://user:pass@ep-xyz-pooler.region.aws.neon.tech/neondb?sslmode=require`
2. Vercel will automatically run specific build commands. We have added a `postinstall` script ("prisma generate") to ensure the Prisma Client is generated during build.

## 3. Dealing with Migrations
**Do not run `prisma migrate dev` in production.**

Instead, we have added a script:
```bash
npm run migrate:deploy
```
You can run this manually via the Vercel Dashboard (Build Steps -> specific command) or simply run it from your local machine connected to the prod DB if possible.
**Recommended**: Add it to your Build Command if you want auto-migrations, OR run it as a separate step.
Vercel Build Command override:
```bash
npx prisma migrate deploy && next build
```

## 4. Deploy
- Connect your GitHub repository to Vercel.
- Vercel will auto-detect Next.js.
- Ensure Environment Variables are set.
- Click **Deploy**.

## 5. Verification
- Visit your Vercel URL.
- Try to Login/Register.
- Send a message in the chat.
