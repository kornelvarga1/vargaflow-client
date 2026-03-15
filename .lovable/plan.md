

## Plan: Add "Sequence Templates" Tab to Sequences Page

### Overview
Wrap the existing SequencesPage content in a Tabs component with two tabs: "Active Automations" (current content) and "Sequence Templates" (new view).

### Changes

**1. Refactor `src/pages/SequencesPage.tsx`**
- Add Radix Tabs at the top of the page with two tabs
- Extract current "Active Automations" content into the first tab
- Create a new "Sequence Templates" tab content

**2. New "Sequence Templates" tab content (inline in SequencesPage or as a separate component)**
- Fetch all `sequences` rows using `useSequences()` from existing hook
- Display as cards in a list, each showing:
  - **name** (title)
  - **pipeline** (Badge)
  - **stage** (text)
  - **is_active** (Switch toggle) — updates `sequences.is_active` via `useUpdateSequence()`
- Clicking a card expands/selects it to show its steps

**3. Sequence detail view (expanded card or side panel)**
- Fetch `sequence_steps` for selected sequence using `useSequenceSteps(sequenceId)`
- Each step rendered as a mini-card showing:
  - Step number (`step_order`)
  - Type badge (`message_type` — SMS/Email)
  - Delay display (`{delay_hours}h {delay_minutes}m`)
  - Editable textarea for `message_template`
  - Save button that calls `useUpdateStep()` to update `message_template`

### Existing hooks reused
- `useSequences()` — fetch all sequences
- `useSequenceSteps(id)` — fetch steps for a sequence
- `useUpdateSequence()` — toggle `is_active`
- `useUpdateStep()` — save edited `message_template`

### UI Components used
- `Tabs, TabsList, TabsTrigger, TabsContent` (existing)
- `Card`, `Badge`, `Switch`, `Button`, `Textarea` (all existing)
- Icons: `Activity`, `ListChecks`, `Loader2`, `Save`

### No database changes needed
All required tables and columns already exist.

