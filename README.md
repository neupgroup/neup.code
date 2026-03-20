This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prisma + PostgreSQL

This project is now scaffolded for Prisma 7 with PostgreSQL.

1. Add your connection string to `.env` or `.env.local`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/neup_code?schema=public"
```

2. Generate the client if needed:

```bash
npm run db:generate
```

3. After you add models to `prisma/schema.prisma`, create your first migration:

```bash
npm run db:migrate -- --name init
```

4. Open Prisma Studio when you want to inspect the database:

```bash
npm run db:studio
```

The app-side Prisma singleton lives in `src/lib/prisma.ts`, and the generated client is emitted to `src/generated/prisma`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
