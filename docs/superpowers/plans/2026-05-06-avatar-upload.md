# Avatar Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload a personal avatar photo in Settings, stored as base64 in the Cosmos `users` container and displayed in the top-nav `AvatarButton`.

**Architecture:** Backend adds `GET /PUT /api/user_avatar` to `function_app.py`, storing `avatar_b64` in the existing `users` Cosmos document. Frontend: `AvatarButton` gains an `avatar` prop, `HeedApp` fetches the avatar on mount and passes it down, `SettingsSheet` adds a tappable 72×72 circle with a camera badge and a 4-layer client validation chain (MIME → size → magic bytes → canvas normalize) before uploading.

**Tech Stack:** React 18 / Next.js 14 (JSX, hooks, canvas API), Python Azure Functions v2, Azure Cosmos DB `users` container, Playwright for UI tests.

---

## File Map

| File | Change |
|---|---|
| `functions/function_app.py` | Add `user_avatar` route (GET + PUT) after `register_username` |
| `web/app/page.jsx` | `AvatarButton` — add `avatar` prop; `HeedApp` — add state/fetch/callbacks; `SettingsSheet` — add upload UI + handler |
| `tests/qa.spec.ts` | Add "Settings avatar" test group |

---

### Task 1: Backend — GET/PUT /api/user_avatar

**Files:**
- Modify: `functions/function_app.py` (insert after `register_username`, before `_USER_STATE_CONTAINER_NAME = "user_state"`)

- [ ] **Step 1: Add the endpoint**

Search for `_USER_STATE_CONTAINER_NAME = "user_state"` in `functions/function_app.py`. Insert the following block **immediately before** that line:

```python
@app.route(route="user_avatar", methods=["GET", "PUT", "OPTIONS"])
def user_avatar(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-ID",
        })

    user_id = _get_user_id(req)

    if req.method == "GET":
        container = _ensure_users_container()
        try:
            doc = container.read_item(item=user_id, partition_key=user_id)
            return _json_response({"avatar_b64": doc.get("avatar_b64")})
        except CosmosResourceNotFoundError:
            return _json_response({"avatar_b64": None})
        except Exception as e:
            return _error(str(e), 500)

    if req.method == "PUT":
        try:
            body = req.get_json()
        except ValueError:
            return _error("Invalid JSON body", 400)

        raw_b64 = body.get("avatar_b64", "")
        if not raw_b64 or not isinstance(raw_b64, str):
            return _error("avatar_b64 is required", 400)

        import base64
        try:
            if raw_b64.startswith("data:"):
                raw_b64 = raw_b64.split(",", 1)[-1]
            clean = re.sub(r'\s', '', raw_b64)
            if not re.fullmatch(r'[A-Za-z0-9+/]*={0,2}', clean):
                raise ValueError("non-base64 characters")
            decoded = base64.b64decode(clean, validate=True)
        except Exception:
            return _error("avatar_b64 must be valid base64", 400)

        if len(decoded) > 1_048_576:
            return _error("Image too large (max 1 MB)", 400)

        is_jpeg = decoded[:3] == b'\xff\xd8\xff'
        is_png  = decoded[:8] == b'\x89PNG\r\n\x1a\n'
        if not is_jpeg and not is_png:
            return _error("Image must be JPEG or PNG", 400)

        safe_b64 = base64.b64encode(decoded).decode('ascii')

        container = _ensure_users_container()
        try:
            try:
                doc = container.read_item(item=user_id, partition_key=user_id)
            except CosmosResourceNotFoundError:
                doc = {"id": user_id, "created_at": datetime.now(timezone.utc).isoformat()}
            doc["avatar_b64"] = safe_b64
            container.upsert_item(doc)
            return _json_response({"ok": True})
        except Exception as e:
            logging.exception("user_avatar PUT failed")
            return _error(str(e), 500)


```

- [ ] **Step 2: Verify the function starts cleanly**

```powershell
cd functions
func start
```

Expected: no Python errors, the registered routes list includes `user_avatar`. Stop with Ctrl-C.

- [ ] **Step 3: Smoke-test GET and PUT locally**

Run `func start` in one terminal. In a second terminal:

```powershell
# GET for a user with no avatar yet → {"avatar_b64": null}
Invoke-WebRequest -Uri "http://localhost:7071/api/user_avatar" `
  -Headers @{"X-User-ID"="testuser"} | Select-Object -ExpandProperty Content

# PUT a valid 1×1 JPEG (tiny fixture)
$body = '{"avatar_b64":"/9j/4AAQSkZJRgABAQEASABIAAD/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB/8QAIRAAAQQCAgMBAAAAAAAAAAAAAQIDBBEFITFBUWH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Aw2yk5VjDJvgO0sMM0ORQxBJSoEBwHkEglAJgMklKJvkAB//Z"}'
Invoke-WebRequest -Uri "http://localhost:7071/api/user_avatar" -Method PUT `
  -ContentType "application/json" `
  -Headers @{"X-User-ID"="testuser"} -Body $body | Select-Object -ExpandProperty Content

# GET again → should echo back the stored base64
Invoke-WebRequest -Uri "http://localhost:7071/api/user_avatar" `
  -Headers @{"X-User-ID"="testuser"} | Select-Object -ExpandProperty Content
```

Expected:
- First GET: `{"avatar_b64": null}`
- PUT: `{"ok": true}`
- Second GET: `{"avatar_b64": "<stored base64 string>"}`

- [ ] **Step 4: Verify PUT rejects invalid inputs**

```powershell
# Bad base64 → 400
Invoke-WebRequest -Uri "http://localhost:7071/api/user_avatar" -Method PUT `
  -ContentType "application/json" `
  -Headers @{"X-User-ID"="testuser"} `
  -Body '{"avatar_b64":"not!!base64@@"}' | Select-Object -ExpandProperty Content
# Expected: {"error": "avatar_b64 must be valid base64"}

# Valid base64 of a text file (not JPEG/PNG) → 400
$textB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("hello world"))
Invoke-WebRequest -Uri "http://localhost:7071/api/user_avatar" -Method PUT `
  -ContentType "application/json" `
  -Headers @{"X-User-ID"="testuser"} `
  -Body "{`"avatar_b64`":`"$textB64`"}" | Select-Object -ExpandProperty Content
# Expected: {"error": "Image must be JPEG or PNG"}
```

- [ ] **Step 5: Commit**

```bash
git add functions/function_app.py
git commit -m "feat: add GET/PUT /api/user_avatar endpoint with 5-layer server validation"
```

---

### Task 2: AvatarButton — add avatar prop

**Files:**
- Modify: `web/app/page.jsx` — `AvatarButton` function (~line 696)
- Modify: `tests/qa.spec.ts` — add "Settings avatar" test group

- [ ] **Step 1: Write the failing Playwright tests**

Add the following test group at the **bottom** of `tests/qa.spec.ts` (after the closing `})` of the last group):

```typescript
// ── SETTINGS AVATAR ──────────────────────────────────────────────────────────

test.describe('Settings avatar', () => {
  // A 1×1 JPEG encoded as data URL — used to seed localStorage before load
  const FIXTURE_AVATAR =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/wAARCAABAAEDASIAAhEBAxEB/' +
    '8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB/8QAIRAAAQQCAgMBAAAAAAAAAAAAAQIDBBEFITFBUWH/' +
    'xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A' +
    'w2yk5VjDJvgO0sMM0ORQxBJSoEBwHkEglAJgMklKJvkAB//Z'

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((url) => {
      localStorage.setItem('heed.use-demo', '1')
      localStorage.setItem('heed.username', 'demo')
      localStorage.setItem('heed.avatar', url)
    }, FIXTURE_AVATAR)
    await page.goto('/')
    await page.waitForTimeout(500)
  })

  test('AvatarButton renders img element when avatar is seeded', async ({ page }) => {
    const img = page.locator('header img[alt="avatar"]').first()
    await expect(img).toBeVisible()
  })

  test('Settings sheet shows tappable avatar circle', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('[aria-label="Change avatar"]')).toBeVisible()
  })

  test('Settings sheet shows camera badge', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('text=📷')).toBeVisible()
  })

  test('hidden file input exists in settings sheet', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('input[type="file"][accept="image/*"]')).toBeAttached()
  })

  test('Settings sheet avatar circle shows img when avatar is set', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('.heed-settings-avatar img')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```powershell
npx playwright test --grep "Settings avatar" --reporter=line
```

Expected: all 5 tests FAIL (`AvatarButton renders img` fails because the prop doesn't exist yet; the rest fail because the Settings sheet changes haven't been made).

- [ ] **Step 3: Update AvatarButton**

Find the `AvatarButton` function (search for `function AvatarButton({ name, onClick })`). Replace it entirely with:

```jsx
function AvatarButton({ name, avatar, onClick }) {
  const initials = (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <button
      onClick={onClick}
      aria-label="Settings"
      style={{
        width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
        background: C.warmDark, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, letterSpacing: 0.3, transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.82' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {avatar
        ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        : <span style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 14, fontWeight: 600, color: C.cream }}>{initials}</span>
      }
    </button>
  )
}
```

- [ ] **Step 4: Run only the first test to confirm AvatarButton renders img**

```powershell
npx playwright test --grep "AvatarButton renders img element" --reporter=line
```

Expected: PASS. (The other 4 tests still fail — SettingsSheet changes come in Task 4.)

- [ ] **Step 5: Commit**

```bash
git add web/app/page.jsx tests/qa.spec.ts
git commit -m "feat: AvatarButton renders avatar image when prop is set"
```

---

### Task 3: HeedApp — avatar state, fetch on mount, pass down

**Files:**
- Modify: `web/app/page.jsx` — `HeedApp` function

- [ ] **Step 1: Add avatar state**

Inside `HeedApp`, find the line:
```jsx
const [settingsOpen, setSettingsOpen] = useState(false)
```

Add the following immediately **after** it:
```jsx
const [avatar, setAvatar] = useState(() => {
  try { return localStorage.getItem('heed.avatar') || null } catch { return null }
})
```

- [ ] **Step 2: Add useEffect to fetch avatar from backend on mount**

Inside `HeedApp`, find the block that ends with:
```jsx
const [customEventTypes, setCustomEventTypes] = useState([])
```

Add the following `useEffect` immediately **after** that line:
```jsx
useEffect(() => {
  if (!username || isDemoMode()) return
  fetch(`${FUNCTIONS_URL}/api/user_avatar`, {
    headers: { 'X-User-ID': username },
  })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.avatar_b64) {
        const dataUrl = `data:image/jpeg;base64,${data.avatar_b64}`
        setAvatar(dataUrl)
        try { localStorage.setItem('heed.avatar', dataUrl) } catch (_) {}
      }
    })
    .catch(() => {})
}, [username, FUNCTIONS_URL])
```

- [ ] **Step 3: Add handleAvatarChange callback**

Inside `HeedApp`, find `const handleSetEfMode = useCallback(...)`. Add the following immediately after it (after the closing `}, [])` of that callback):

```jsx
const handleAvatarChange = useCallback((dataUrl) => {
  setAvatar(dataUrl)
  try { localStorage.setItem('heed.avatar', dataUrl) } catch (_) {}
}, [])
```

- [ ] **Step 4: Pass avatar to both AvatarButton renders**

There are exactly two occurrences of `<AvatarButton name={username} onClick={() => setSettingsOpen(true)}/>` in `HeedApp`. Replace **both** with:

```jsx
<AvatarButton name={username} avatar={avatar} onClick={() => setSettingsOpen(true)}/>
```

- [ ] **Step 5: Pass avatar and onAvatarChange to SettingsSheet**

Find the `<SettingsSheet .../>` render in `HeedApp`. It currently ends with `onSetEfMode={handleSetEfMode}/>`. Add two props before the closing `/>`:

```jsx
avatar={avatar} onAvatarChange={handleAvatarChange}
```

So the closing of the element becomes:
```jsx
... onSetEfMode={handleSetEfMode} avatar={avatar} onAvatarChange={handleAvatarChange}/>
```

- [ ] **Step 6: Re-run the first test to verify nothing regressed**

```powershell
npx playwright test --grep "AvatarButton renders img element" --reporter=line
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: HeedApp fetches avatar on mount and wires it to AvatarButton and SettingsSheet"
```

---

### Task 4: SettingsSheet — upload UI and handler

**Files:**
- Modify: `web/app/page.jsx` — `SettingsSheet` function

- [ ] **Step 1: Update SettingsSheet signature**

Find the SettingsSheet function declaration:
```jsx
function SettingsSheet({ open, onClose, userName, onUserName, theme, onTheme, customCategories, onAddCategory, customEventTypes, onAddEventType, onResetAllData, onLoadDemoData, onSwitchToRealData, efMode, onSetEfMode }) {
```

Replace it with:
```jsx
function SettingsSheet({ open, onClose, userName, onUserName, theme, onTheme, customCategories, onAddCategory, customEventTypes, onAddEventType, onResetAllData, onLoadDemoData, onSwitchToRealData, efMode, onSetEfMode, avatar, onAvatarChange }) {
```

- [ ] **Step 2: Add avatarUploading, avatarError state and fileInputRef**

Inside `SettingsSheet`, find:
```jsx
const [evtOpen, setEvtOpen] = useState(false)
```

Add the following immediately **after** it:
```jsx
const [avatarUploading, setAvatarUploading] = useState(false)
const [avatarError, setAvatarError] = useState('')
const fileInputRef = useRef(null)
```

(`useRef` is already imported on line 2 of the file — no import change needed.)

- [ ] **Step 3: Add handleAvatarFile upload handler**

Inside `SettingsSheet`, find the `submitEvent` function. It ends with:
```jsx
setEvtLabel(''); setEvtIcon('◈'); setEvtDays('3'); setEvtOpen(false)
```

Add the following `handleAvatarFile` function immediately **after** the closing `}` of `submitEvent`:

```jsx
async function handleAvatarFile(e) {
  const file = e.target.files?.[0]
  if (!file) return

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    setAvatarError('Please use a JPEG, PNG, WebP, or GIF image.')
    setTimeout(() => setAvatarError(''), 3000)
    return
  }

  if (file.size > 1_048_576) {
    setAvatarError('Image must be under 1 MB.')
    setTimeout(() => setAvatarError(''), 3000)
    return
  }

  const header = await file.slice(0, 12).arrayBuffer()
  const bytes = new Uint8Array(header)
  const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
  const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
               && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  const isGif  = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
  if (!isJpeg && !isPng && !isWebp && !isGif) {
    setAvatarError('File does not appear to be a valid image.')
    setTimeout(() => setAvatarError(''), 3000)
    return
  }

  setAvatarUploading(true)
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const ctx = canvas.getContext('2d')
    const scale = Math.min(256 / bitmap.width, 256 / bitmap.height)
    const w = bitmap.width * scale, h = bitmap.height * scale
    ctx.drawImage(bitmap, (256 - w) / 2, (256 - h) / 2, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const b64 = dataUrl.split(',')[1]

    const res = await fetch(`${FUNCTIONS_URL}/api/user_avatar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': getUsername() || 'demo' },
      body: JSON.stringify({ avatar_b64: b64 }),
    })
    if (!res.ok) throw new Error('Upload failed')

    onAvatarChange(dataUrl)
  } catch {
    setAvatarError('Upload failed — try again.')
    setTimeout(() => setAvatarError(''), 3000)
  } finally {
    setAvatarUploading(false)
    e.target.value = ''
  }
}
```

- [ ] **Step 4: Replace the static profile circle with the tappable avatar circle**

Inside SettingsSheet, find the profile section circle (the `<div>` that renders `{initials}` inside a gradient circle). The exact block to replace is:

```jsx
<div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${C.warmDark} 0%, ${C.ochre} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Lora, Georgia, serif', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5, boxShadow: `0 4px 16px ${C.warmDark}33`, marginBottom: 10 }}>
  {initials}
</div>
```

Replace it with:

```jsx
<div aria-label="Change avatar"
     style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 10px', cursor: 'pointer' }}
     onClick={() => !avatarUploading && fileInputRef.current?.click()}>
  <div className="heed-settings-avatar"
       style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                background: `linear-gradient(135deg, ${C.warmDark} 0%, ${C.ochre} 100%)`,
                border: `2px solid ${avatarError ? C.rust : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 16px ${C.warmDark}33` }}>
    {avatarUploading
      ? <div style={{ width: 24, height: 24, border: `3px solid #fff`, borderTopColor: 'transparent',
                      borderRadius: '50%', animation: 'heed-spin 0.7s linear infinite' }}/>
      : avatar
        ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        : <span style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 22, fontWeight: 700,
                         color: '#fff', letterSpacing: -0.5 }}>{initials}</span>
    }
  </div>
  {!avatarUploading && (
    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22,
                  borderRadius: '50%', background: C.ochre, border: `2px solid ${C.paperHi}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
      📷
    </div>
  )}
</div>
{avatarError && (
  <div style={{ color: C.rust, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
    {avatarError}
  </div>
)}
<input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile}/>
```

- [ ] **Step 5: Run the settings avatar tests**

```powershell
npx playwright test --grep "Settings avatar" --reporter=line
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run the full test suite for regressions**

```powershell
npx playwright test --reporter=line
```

Expected: all tests pass (no regressions from the profile section change).

- [ ] **Step 7: Commit**

```bash
git add web/app/page.jsx
git commit -m "feat: SettingsSheet avatar upload — tappable circle, camera badge, 4-layer client validation"
```

---

### Task 5: Deploy and manual end-to-end verification

**Files:**
- No code changes — deploy and verify

- [ ] **Step 1: Deploy the updated Functions**

```powershell
.\functions\deploy_functions.ps1
```

Expected: deployment succeeds, `user_avatar` route appears in the Azure portal / func output.

- [ ] **Step 2: Start the Next.js dev server (or use the deployed static site)**

```powershell
cd web && npm run dev
```

Open `http://localhost:3000` in a browser (or the Azure Static Web App URL for the deployed version).

- [ ] **Step 3: Verify the avatar UI in Settings**

Log in (or use an existing account). Click the avatar button in the top-right. Confirm:
- Settings sheet opens.
- The profile circle is now 72×72 with a 📷 badge in the bottom-right.
- Clicking the circle (or the badge) opens the OS file picker.

- [ ] **Step 4: Upload a valid JPEG**

Select any JPEG photo. Confirm:
- A spinner appears while uploading.
- The circle updates to show the photo.
- The top-nav `AvatarButton` also shows the photo.
- No error message appears.

- [ ] **Step 5: Reload and confirm the avatar persists**

Reload the page. Confirm:
- Avatar appears immediately on load (from `localStorage`).
- After a moment the GET fetch confirms it matches what's in Cosmos.

- [ ] **Step 6: Verify invalid file is rejected**

Rename a `.txt` file to `.jpg` and try to upload it. Confirm:
- The error message "File does not appear to be a valid image." appears.
- It clears automatically after 3 seconds.
- The circle remains unchanged.

- [ ] **Step 7: Push**

```bash
git push
```
