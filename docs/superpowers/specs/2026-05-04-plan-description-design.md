# Plan Description Design

**Goal:** Let users write a purpose statement when creating a plan, see it on the plan card and detail header, and update it later via the edit panel.

**Architecture:** Add an optional `description` string field to the plan data model. Thread it through `AddPlanSheet` (creation), `PlanCard` (list display), `PlanDetailScreen` header (detail display), and the `PlanDetailScreen` edit panel (editing). No new components needed — all changes are additions to existing ones.

**Tech Stack:** React 18, Next.js 14, inline styles, existing `updatePlan` callback

---

## 1. Data Model

Add `description: ''` (empty string, not null/undefined) to every plan object created in `AddPlanSheet.handleSubmit` (line ~4065). All three plan types (project, event, goal) get the field.

The `updatePlan` function in `usePlans` (line ~3425) already merges any non-`tasks` field — no changes needed there.

Existing plans in localStorage that lack `description` will behave correctly because the display only renders when `plan.description` is non-empty.

---

## 2. Creation Form (`AddPlanSheet`, line ~4085)

Add an optional "Description" field to the form, **after the Name field and before any other fields**, for all three plan types.

- **Label:** `Description` with `(optional)` in muted text beside it
- **Input:** `<textarea>` with `rows={2}`, placeholder `"What's this plan for?"`
- **State:** One new `useState('')` — `const [description, setDescription] = useState('')` — added at the top of the form state block (alongside `name`, `dueDate`, etc.)
- **Reset:** `setDescription('')` added to the reset call after successful submission
- **Submitted:** `description: description.trim()` added to the plan object in `handleSubmit`

---

## 3. Plan Card (`PlanCard`, line ~3436)

Show the description as a single italic line directly under the plan title row, rendered only when `plan.description` is non-empty.

```jsx
{plan.description ? (
  <div style={{
    fontSize: 11.5,
    color: C.inkSoft,
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 4,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }}>
    {plan.description}
  </div>
) : null}
```

Position: after the title line, before the subtitle/progress section.

---

## 4. Plan Detail Header (`PlanDetailScreen`, line ~3160)

Show the description under the icon + title row in the header, full text (wrapping), rendered only when `plan.description` is non-empty.

```jsx
{plan.description ? (
  <div style={{
    fontSize: 13,
    color: C.inkSoft,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 1.5,
  }}>
    {plan.description}
  </div>
) : null}
```

Position: after the title/icon row, before the progress bar.

---

## 5. Edit Panel (`PlanDetailScreen`, line ~3689)

Add a "Description" textarea to the existing edit panel alongside icon, title, and date fields.

- **Label:** `Description` with `(optional)` in muted text
- **Input:** `<textarea>` with `rows={2}`, same styling as the existing icon/title inputs
- **Position in panel:** After the date field (last field in the panel). Goals without a date field show it after the title field.
- **State:** Edit panel already uses `editDraft` (`{ icon, title, date }`). Extend it to `{ icon, title, date, description }`. Initialize from `plan.description` when edit mode opens.
- **Save:** Include `description: editDraft.description.trim()` in the `onUpdatePlan` call inside `saveEditPlan` (line ~3645).

---

## 6. What Doesn't Change

- `updatePlan` in `usePlans` — already handles any non-`tasks` field, no change needed
- Task list, swipe, drag-to-reorder — untouched
- Goal-specific numeric/milestone fields — untouched
- Toast notifications, syncing to localStorage/backend — work automatically since `updatePlan` passes through all fields
