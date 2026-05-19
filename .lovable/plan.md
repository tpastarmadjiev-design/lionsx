## Challenges System + Bug Fixes

### 1. Database (migration)
Create `challenges` table:
- `id`, `user_id`, `difficulty` (easy/medium/hard), `exercises` (jsonb), `status` (active/completed/abandoned), `lp_awarded`, `started_at`, `completed_at`
- RLS: users can select/insert/update their own challenges
- Index on `(user_id, status)` for finding active challenge

### 2. Dashboard: Split TRAIN button
- In `src/pages/Dashboard.tsx`, replace single "Start Training" card with two side-by-side cards: **Training** (existing nav → `/training`) and **Challenges** (new nav → `/challenges`)
- Same visual style (h-32, same gradient/imagery treatment), grid-cols-2

### 3. Challenges page (`src/pages/Challenges.tsx`)
Flow:
1. Check for active challenge in DB → if found, jump to "in progress" view (resume)
2. Otherwise show **difficulty picker** (Easy / Medium / Hard cards with LP reward + target reps)
3. On selection → **slot machine animation** (~2s) cycling through exercise names, lands on 6 random exercises from the 44 in `exerciseLocations.ts` (rep-based only, exclude timed holds)
4. Insert row in `challenges` with status=`active`, exercises=`[{id,name,target,completed}]`
5. Show **exercise list view**: "Push-ups 12/20" with progress bars; tap exercise → opens execution view

Rep targets: easy=15, medium=25, hard=40. Bonus LP: 30/50/75.

### 4. Challenge Execution View
- Reuses `PoseTracker` for selected exercise
- **No 60s countdown** — runs until reps hit target OR user taps Stop
- On rep complete → increment local count + update `exercises` jsonb in DB
- On target hit → mark exercise complete, return to list
- Stop → save partial progress (persisted in jsonb)
- All 6 complete → mark challenge `completed`, award LP bonus directly to profile (bypass daily cap), show celebration, allow starting new one immediately

### 5. Routing
- Add `/challenges` route in `src/App.tsx`

### 6. Bug fixes (same turn)
- **Toast duration**: `src/hooks/useProfile.tsx` — confirm `{ duration: 2000 }` on the `addLP` success toast (~line 184)
- **completeTrainingSession await**: locate in Training flow (likely `src/pages/Training.tsx` / `TimedTrainingFlow.tsx`), ensure `await` so `was_completed=true` is written before navigation
- **Recent Workouts on Profile**: in `src/pages/Profile.tsx`, fix query for `training_sessions` (likely missing filter or wrong table — investigate)
- **Running Endurance XP**: reduce endurance XP awarded per running session in `RunningTracker.tsx`/`TreadmillTracker.tsx`
- **Debug overlay**: remove `S:`, `H:`, `E:` overlay text from `src/components/PoseTracker.tsx` (the file shown has no overlay JSX — need to re-check; may have been already removed or is in render section)

### Technical Notes
- Challenge LP awarded directly via `supabase.from('profiles').update({ lp: profile.lp + bonus })` — explicitly skips `daily_lp` cap logic
- Slot machine: simple `setInterval` cycling random exercise names for ~1.5–2s, then settle
- Exercise pool: filter `exerciseLocations` for non-timed exercises (so rep counting works)
- Resume: on mount, `select * from challenges where user_id=? and status='active' limit 1`
