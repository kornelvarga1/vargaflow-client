# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run lint       # Run ESLint
npm run test       # Run Vitest (single pass)
npm run test:watch # Run Vitest in watch mode
```

## Architecture

**VargaFlow** is a CRM app built with React 18 + TypeScript + Vite, using Supabase as the backend (PostgreSQL + Auth).

### Stack
- **UI:** React + shadcn/ui (Radix UI) + Tailwind CSS
- **Routing:** React Router v6
- **Server state:** TanStack React Query (primary state management)
- **Forms:** React Hook Form + Zod validation
- **Backend:** Supabase JS SDK
- **Drag & drop:** @hello-pangea/dnd (kanban boards)
- **Notifications:** Sonner toasts

### Data Access Pattern

All data access goes through custom hooks in `src/hooks/` that wrap React Query + Supabase. The pattern is:

```typescript
// Read: useQuery wrapping supabase.from(...).select(...)
export function useContacts() {
  return useQuery({ queryKey: ["contacts"], queryFn: async () => { ... } });
}

// Write: useMutation with invalidateQueries on success
export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => { /* supabase insert */ },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] })
  });
}
```

When adding new data operations, follow this pattern and add them to the relevant hook file.

### Supabase Types

Auto-generated types live in `src/integrations/supabase/types.ts`. The Supabase client is initialized in `src/integrations/supabase/client.ts` and re-exported from `src/lib/supabase.ts`.

### Routing & Layout

Routes are defined in `src/App.tsx`. All routes are wrapped in `AppLayout` which provides:
- Desktop: Fixed left sidebar (240px)
- Mobile: Bottom navigation + slide-out overlay menu

### Database Tables
- `contacts` — main records with pipeline stage fields
- `sequences` / `sequence_steps` — message sequence definitions
- `contact_sequences` — junction table for contact enrollment
- `message_queue` — scheduled/sent messages
- `activity_log` — interaction history
- `custom_values` — custom contact fields

### Styling
- Tailwind CSS with HSL CSS variables for theming
- Custom animations defined in `tailwind.config.ts`: `fade-in`, `slide-up`, `pulse-glow`, `shimmer`
- Fonts: Space Grotesk (display), Inter (body)
- Path alias: `@/` maps to `src/`
