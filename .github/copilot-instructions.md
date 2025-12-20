# AI Rules for 10x Astro Starter

A modern, opinionated starter template for building fast, accessible, and AI-friendly web applications.

## Tech Stack

- Astro v5.13.7
- React v19.1.1
- TypeScript v5
- Tailwind CSS v4.1.13
- Shadcn/ui
- Supabase

## Project Structure

When introducing changes to the project, always follow the directory structure below:

- `./src` - source code
- `./src/layouts` - Astro layouts, like the main `Layout.astro`
- `./src/pages` - Astro pages, with `index.astro` as the entry point.
- `./src/pages/api` - API endpoints
- `./src/middleware` - Astro middleware, especially for Supabase client injection.
- `./src/db` - Supabase clients (`supabase.client.ts`) and database types (`database.types.ts`).
- `./src/components` - Client-side components written in Astro (static, e.g., `Welcome.astro`) and React (dynamic)
- `./src/components/ui` - Client-side components from Shadcn/ui, like `button.tsx`.
- `./src/lib` - Services and helpers, like `utils.ts` containing the `cn` function.
- `./src/styles` - Global styles, with `global.css` for Tailwind CSS setup.
- `./public` - public assets, like `favicon.png`
- `supabase/migrations` - SQL files for database migrations.

## Developer Workflows

### Running the project

- `npm run dev` - Start development server.
- `npm run build` - Build for production.
- `npm run preview` - Preview production build.

### Linting and Formatting

- `npm run lint` - Run ESLint to check for code quality.
- `npm run lint:fix` - Automatically fix ESLint issues.
- `npm run format` - Format code with Prettier.
- Husky and lint-staged are set up to automatically lint and format code before each commit.

### Database Migrations

- Create new migration files in `supabase/migrations/`.
- The filename must follow the format `YYYYMMDDHHmmss_short_description.sql`.
- Always enable Row Level Security (RLS) on new tables.
- Create granular RLS policies for `select`, `insert`, `update`, `delete` for `anon` and `authenticated` roles separately.

## Coding practices

### General Clean Code

- Use feedback from linters to improve the code.
- Use early returns (guard clauses) for error conditions to avoid nested `if` statements.
- Place the happy path last in the function for improved readability.

### Frontend

- Use Astro components (`.astro`) for static content and layouts.
- Use React components (`.tsx`) for interactive UI elements.

### Styling with Tailwind CSS & Shadcn/ui

- Use the `cn` utility function from `src/lib/utils.ts` to merge Tailwind CSS classes.
- For UI components, use `class-variance-authority` to create variants, as seen in `src/components/ui/button.tsx`.
- Add new Shadcn components using `npx shadcn@latest add [component-name]`.
- Global styles and Tailwind CSS directives are in `src/styles/global.css`.

### Accessibility (ARIA)

- Use ARIA landmarks (`main`, `navigation`, etc.) to identify page regions.
- Apply appropriate ARIA roles to custom UI elements.
- Use `aria-expanded`, `aria-controls`, `aria-live`, `aria-label`, `aria-labelledby`, and `aria-describedby` where appropriate.

### Astro Guidelines

- Use Server Endpoints for API routes, with `export const prerender = false`.
- Use Zod for input validation in API routes.
- Use `Astro.cookies` for server-side cookie management.
- Access environment variables via `import.meta.env`.
- Use middleware (see `src/middleware/index.ts`) for tasks like injecting the Supabase client into `context.locals`.

### React Guidelines

- Use functional components with hooks.
- **Do not** use Next.js directives like `"use client"`.
- Extract reusable logic into custom hooks in `src/components/hooks`.
- Use `React.memo`, `useCallback`, and `useMemo` for performance optimization.
- Use `useId` for generating unique IDs for accessibility attributes.

### Backend and Database (Supabase)

- Use the Supabase client from `context.locals.supabase` in Astro pages and API routes, not by importing `supabaseClient` directly.
- Use the `SupabaseClient` type from `src/db/supabase.client.ts`, not from `@supabase/supabase-js`.
- Use Zod schemas to validate data exchanged with the backend.