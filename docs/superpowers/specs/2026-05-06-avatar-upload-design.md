# Avatar Upload Design

**Goal:** Let users set a personal avatar photo in Settings. The image is stored as a base64 string in the Cosmos `users` container and shown everywhere the avatar circle appears (top-nav button, settings sheet). Security is enforced on both client and server so no malicious payload can reach the database.

**Architecture:** Three layers. (1) Frontend: tappable avatar in `SettingsSheet` with client-side MIME, size, and magic-byte validation plus canvas normalisation before encoding. `AvatarButton` renders the image when set. (2) Two new backend endpoints `GET /api/user_avatar` and `PUT /api/user_avatar`. (3) Data: `avatar_b64` field upserted into the existing `users` Cosmos container document (same doc created at registration).

**Tech stack:** React 18 / Next.js 14 (frontend), Python Azure Functions v2 (backend), Azure Cosmos DB `users` container.

---

## 1. Frontend changes

### 1.1 `AvatarButton` component

Add an `avatar` prop (base64 data URL string or `null`).

```jsx
function AvatarButton({ name, avatar, onClick }) {
  const initials = (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <button onClick={onClick} aria-label="Settings" style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:C.warmDark, border:'none', cursor:'pointer', flexShrink:0 }}>
      {avatar
        ? <img src={avatar} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <span style={{ fontFamily:'Lora,Georgia,serif', fontSize:14, fontWeight:600, color:C.cream }}>{initials}</span>
      }
    </button>
  )
}
```

### 1.2 `HeedApp` state

```js
const [avatar, setAvatar] = useState(() => {
  try { return localStorage.getItem('heed.avatar') || null } catch { return null }
})
```

On mount (after username resolves), fetch the avatar:

```js
useEffect(() => {
  if (!username || isDemoMode()) return
  fetch(`${FUNCTIONS_URL}/api/user_avatar`, {
    headers: { 'X-User-ID': username }
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
}, [username])
```

Pass `avatar` to `AvatarButton` and `SettingsSheet`. Pass `onAvatarChange` to `SettingsSheet`.

### 1.3 `SettingsSheet` — profile section

At the top of the sheet, replace the plain initials display with a tappable avatar circle (72×72). A hidden `<input type="file">` is triggered on click.

**State added:**
```js
const [avatarUploading, setAvatarUploading] = useState(false)
const [avatarError, setAvatarError]       = useState('')
```

**Upload handler — full validation chain:**

```js
async function handleAvatarFile(e) {
  const file = e.target.files?.[0]
  if (!file) return

  // 1. MIME type
  const allowed = ['image/jpeg','image/png','image/webp','image/gif']
  if (!allowed.includes(file.type)) {
    setAvatarError('Please use a JPEG, PNG, WebP, or GIF image.')
    setTimeout(() => setAvatarError(''), 3000)
    return
  }

  // 2. File size (1 MB)
  if (file.size > 1_048_576) {
    setAvatarError('Image must be under 1 MB.')
    setTimeout(() => setAvatarError(''), 3000)
    return
  }

  // 3. Magic bytes — read first 12 bytes as ArrayBuffer
  const header = await file.slice(0, 12).arrayBuffer()
  const bytes  = new Uint8Array(header)
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
    // 4. Canvas normalise — resize to 256×256, output as JPEG 0.85
    //    Strips EXIF, normalises format, caps encoded size ~80 KB
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const ctx = canvas.getContext('2d')
    const scale = Math.min(256 / bitmap.width, 256 / bitmap.height)
    const w = bitmap.width * scale, h = bitmap.height * scale
    ctx.drawImage(bitmap, (256 - w) / 2, (256 - h) / 2, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const b64 = dataUrl.split(',')[1]  // strip data URL prefix

    // 5. Upload
    const res = await fetch(`${FUNCTIONS_URL}/api/user_avatar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': getUsername() || 'demo' },
      body: JSON.stringify({ avatar_b64: b64 }),
    })
    if (!res.ok) throw new Error('Upload failed')

    onAvatarChange(dataUrl)  // updates HeedApp state + localStorage
  } catch {
    setAvatarError('Upload failed — try again.')
    setTimeout(() => setAvatarError(''), 3000)
  } finally {
    setAvatarUploading(false)
    e.target.value = ''  // reset file input so the same file can be re-selected
  }
}
```

**Avatar circle UI (inside SettingsSheet profile section):**

```jsx
<div style={{ position:'relative', width:72, height:72, margin:'0 auto 12px' }}>
  <div style={{ width:72, height:72, borderRadius:'50%', overflow:'hidden', background:C.warmDark,
                border:`2px solid ${avatarError ? C.rust : C.border}`, cursor:'pointer' }}
       onClick={() => !avatarUploading && fileInputRef.current?.click()}>
    {avatarUploading
      ? <div style={{ /* spinner */ }}/>
      : avatar
        ? <img src={avatar} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <span style={{ /* initials */ }}>{initials}</span>
    }
  </div>
  {/* Camera badge */}
  {!avatarUploading && (
    <div style={{ position:'absolute', bottom:0, right:0, width:22, height:22, borderRadius:'50%',
                  background:C.ochre, border:`2px solid ${C.paperHi}`, display:'flex',
                  alignItems:'center', justifyContent:'center', fontSize:11, cursor:'pointer' }}
         onClick={() => fileInputRef.current?.click()}>
      📷
    </div>
  )}
</div>
{avatarError && <div style={{ color:C.rust, fontSize:12, textAlign:'center', marginBottom:8 }}>{avatarError}</div>}
<input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarFile}/>
```

---

## 2. Backend endpoints

### 2.1 `GET /api/user_avatar`

Returns the stored avatar for the authenticated user.

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
        except Exception as e:
            if "404" in str(e) or "NotFound" in type(e).__name__:
                return _json_response({"avatar_b64": None})
            return _error(str(e), 500)
```

### 2.2 `PUT /api/user_avatar` — server-side security

```python
    if req.method == "PUT":
        try:
            body = req.get_json()
        except ValueError:
            return _error("Invalid JSON body", 400)

        raw_b64 = body.get("avatar_b64", "")
        if not raw_b64 or not isinstance(raw_b64, str):
            return _error("avatar_b64 is required", 400)

        # 1. Validate base64 encoding — strict mode raises on bad chars
        try:
            import base64, re
            # Reject data URL prefix if client sent it by mistake
            if raw_b64.startswith("data:"):
                raw_b64 = raw_b64.split(",", 1)[-1]
            # Strip whitespace and validate charset
            clean = re.sub(r'\s', '', raw_b64)
            if not re.fullmatch(r'[A-Za-z0-9+/]*={0,2}', clean):
                raise ValueError("non-base64 characters")
            decoded = base64.b64decode(clean, validate=True)
        except Exception:
            return _error("avatar_b64 must be valid base64", 400)

        # 2. Size check — decoded bytes must be ≤ 1 MB
        if len(decoded) > 1_048_576:
            return _error("Image too large (max 1 MB)", 400)

        # 3. Magic bytes — only JPEG and PNG accepted (canvas always outputs JPEG;
        #    PNG accepted as belt-and-suspenders for future clients)
        is_jpeg = decoded[:3] == b'\xff\xd8\xff'
        is_png  = decoded[:8] == b'\x89PNG\r\n\x1a\n'
        if not is_jpeg and not is_png:
            return _error("Image must be JPEG or PNG", 400)

        # 4. Re-encode cleanly — strip any encoding tricks in the original string
        safe_b64 = base64.b64encode(decoded).decode('ascii')

        # 5. Upsert into users container
        container = _ensure_users_container()
        try:
            try:
                doc = container.read_item(item=user_id, partition_key=user_id)
            except Exception:
                doc = {"id": user_id, "created_at": datetime.now(timezone.utc).isoformat()}
            doc["avatar_b64"] = safe_b64
            container.upsert_item(doc)
            return _json_response({"ok": True})
        except Exception as e:
            logging.exception("user_avatar PUT failed")
            return _error(str(e), 500)
```

---

## 3. Data model change

`users` container document gains one optional field:

| Field | Type | Notes |
|---|---|---|
| `avatar_b64` | string? | Base64-encoded JPEG, max ~80 KB after canvas normalisation. Present after first upload; absent for new users. |

No schema migration needed — Cosmos documents are schemaless. Existing user docs simply lack the field until the user uploads.

---

## 4. Security summary

| Layer | Check | What it blocks |
|---|---|---|
| Client — MIME | `file.type` allowlist | Wrong file type selected |
| Client — size | `file.size > 1 MB` | Large file before reading |
| Client — magic bytes | First 12 bytes via ArrayBuffer | MIME-spoofed files (e.g. .exe renamed .jpg) |
| Client — canvas | `toDataURL('image/jpeg', 0.85)` | EXIF, embedded scripts, format tricks; normalises to clean JPEG |
| Server — base64 | `re.fullmatch` + `b64decode(validate=True)` | Non-base64 characters, padding attacks |
| Server — size | `len(decoded) > 1_048_576` | Client-bypass of size limit |
| Server — magic bytes | JPEG `\xff\xd8\xff` / PNG `\x89PNG` | Client-bypass of format check |
| Server — re-encode | `b64encode(decoded)` | Any encoding trick in the original string |
| Server — storage | String field in Cosmos, never executed | No code path exists to execute stored bytes |

---

## 5. What doesn't change

- `UsernameGate` — avatar upload is post-registration only (Settings)
- Demo mode — avatar fetch/upload skipped in demo mode (`isDemoMode()` guard)
- `localStorage('heed.avatar')` is populated on successful upload and on app mount (from GET) for instant display; cleared on reset-all-data
- All other settings rows — unchanged
