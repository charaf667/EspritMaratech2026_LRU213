# OMNIA API Contract

All endpoints are prefixed with `http://localhost:8000/api/`.

## Authentication

Session-based auth with httpOnly cookies + CSRF protection.

### GET /api/auth/csrf/
No auth required. Returns CSRF token and sets `csrftoken` cookie.
```json
// Response 200
{ "csrfToken": "abc123..." }
```

### POST /api/auth/login/
No auth required. Sets `sessionid` cookie on success.
```json
// Request
{ "email": "sara@omnia.org", "password": "dev12345" }

// Response 200
{
  "id": "uuid",
  "email": "sara@omnia.org",
  "first_name": "Sara",
  "last_name": "Mansouri",
  "role": "agent"
}

// Response 401
{ "detail": "Invalid credentials." }
```

### POST /api/auth/logout/
Auth required.
```json
// Response 200
{ "detail": "Logged out." }
```

### GET /api/auth/me/
Auth required.
```json
// Response 200
{
  "id": "uuid",
  "email": "sara@omnia.org",
  "first_name": "Sara",
  "last_name": "Mansouri",
  "role": "agent"
}
```

---

## Aid Types

### GET /api/aid-types/
Auth required. Returns flat array (no pagination).
```json
// Response 200
[
  {
    "id": "uuid",
    "key": "food_parcel",
    "label_fr": "Colis alimentaire",
    "label_ar": "طرد غذائي"
  },
  // ... 10 total
]
```

---

## Families

### GET /api/families/
Auth required. Paginated. RBAC: agent=assigned/created, admin=all.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search head_name, phone, or id |
| `priority` | `overdue\|urgent\|normal` | Filter by computed priority |
| `zone` | string | Filter by zone_label |
| `assigned_to` | `me\|uuid` | Filter by assigned agent |
| `aid_type` | string (key) | Filter by aid type received |
| `today` | `true` | Families with next_due_at today |
| `bbox` | `minLng,minLat,maxLng,maxLat` | Bounding-box filter on lat/lng (all floats, comma-separated) |
| `page` | int | Page number (default 1) |
| `page_size` | int | Items per page (default 25, max 100) |

```json
// Response 200
{
  "count": 7,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "head_name": "Fatima Ben Ali",
      "household_size": 5,
      "phone": "+21671000001",
      "address_text": "12 Rue de la Liberté, Tunis",
      "zone_label": "Zone Nord",
      "lat": 36.8065,
      "lng": 10.1815,
      "last_visit_at": "2026-01-18T06:31:24.664Z",
      "next_due_at": "2026-02-02T06:31:24.664Z",
      "priority": "overdue",
      "priority_override": null,
      "assigned_to_id": "uuid",
      "created_by_id": "uuid",
      "vulnerability_tags": [],
      "has_accessibility_need": false,
      "accessibility_types": null,
      "accessibility_verification": "none",
      "vulnerability_notes": null,
      "ocr_used": false,
      "created_at": "2026-02-07T06:31:24.664Z",
      "updated_at": "2026-02-07T06:31:24.664Z"
    }
  ]
}
```

**Sort order:** overdue (0) > urgent (1) > normal (2), then `next_due_at` ascending.

### GET /api/families/map/
Auth required. **Not paginated** — returns flat JSON array. Same RBAC as `/api/families/`.
Lightweight endpoint for map markers only.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `bbox` | `minLng,minLat,maxLng,maxLat` | Bounding-box filter (recommended for large datasets) |

```json
// Response 200
[
  {
    "id": "uuid",
    "head_name": "Fatima Ben Ali",
    "lat": 36.8065,
    "lng": 10.1815,
    "zone_label": "Zone Nord",
    "priority": "overdue",
    "next_due_at": "2026-02-02T06:31:24.664Z",
    "last_visit_at": "2026-01-18T06:31:24.664Z"
  }
]
```

**curl examples:**
```bash
# All markers (admin)
curl -b cookies.txt http://localhost:8000/api/families/map/

# Markers within Tunis bounding box
curl -b cookies.txt "http://localhost:8000/api/families/map/?bbox=10.05,36.75,10.35,36.90"

# Families list with bbox (paginated)
curl -b cookies.txt "http://localhost:8000/api/families/?bbox=10.05,36.75,10.35,36.90"
```

### GET /api/families/{id}/
Auth required. Same response shape as list item.

### POST /api/families/
Auth required. Creates a family (created_by = current user).
```json
// Request
{
  "head_name": "New Family",
  "household_size": 3,
  "phone": "+21600000000",
  "address_text": "Some address",
  "zone_label": "Zone Nord",
  "lat": 36.8,
  "lng": 10.1,
  "assigned_to": "uuid-or-null"
}
```

---

## Visits

### GET /api/visits/?family_id={uuid}
Auth required. Returns flat array ordered by `visited_at` desc.

**Additional query params:**
| Param | Type | Description |
|-------|------|-------------|
| `attested` | `true\|false` | Filter by attestation status |
```json
// Response 200
[
  {
    "id": "uuid",
    "family_id": "uuid",
    "created_by_id": "uuid",
    "visited_at": "2026-02-07T06:42:43.229Z",
    "motive": "distribution",
    "visit_lat": null,
    "visit_lng": null,
    "is_urgent": false,
    "urgent_reason": "",
    "notes": "Distribution visit.",
    "next_due_at": "2026-03-09T06:42:43.229Z",
    "aids": [
      {
        "id": "uuid",
        "aid_type_id": "uuid",
        "aid_type_key": "food_parcel",
        "label_fr": "Colis alimentaire",
        "label_ar": "طرد غذائي",
        "quantity": 2,
        "note_short": "",
        "is_urgent": null
      }
    ],
    "feeling_token": "P7O2S1",
    "has_attestation": false,
    "attestation_status": null,
    "attested_at": null,
    "created_at": "2026-02-07T06:42:43.229Z"
  }
]
```

### POST /api/visits/
Auth required. Creates visit from wizard payload.
```json
// Request
{
  "family_id": "uuid",
  "motive": "distribution",
  "notes": "Visit notes here",
  "is_urgent": false,
  "urgent_reason": "",
  "aids": [
    { "aid_type_key": "food_parcel", "qty": 2 },
    { "aid_type_key": "medicines", "qty": 1, "note_short": "Paracetamol" }
  ],
  "complaint_text": ""
}

// Response 201 — same shape as GET item above
```

**Side effects:**
- Updates `family.last_visit_at` and `family.next_due_at` (+30 days)
- Creates BeneficiaryCard with 6-char code (returned as `feeling_token`)
- If `complaint_text` is non-empty, creates Complaint + first ComplaintMessage

---

## Attachments

### POST /api/attachments/
Auth required. Multipart form-data.

| Field | Type | Required |
|-------|------|----------|
| `file` | File | Yes |
| `owner_type` | `visit\|complaint_message\|emergency_incident` | Yes |
| `owner_id` | UUID | Yes |

**Constraints:**
- Max 3 attachments per owner
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Max file size: 5 MB

```json
// Response 201
{
  "id": "uuid",
  "owner_type": "visit",
  "owner_id": "uuid",
  "mime_type": "image/jpeg",
  "original_filename": "photo.jpg",
  "size_bytes": 123456,
  "created_at": "2026-02-07T06:42:43.229Z"
}
```

### GET /api/attachments/?owner_type=visit&owner_id={uuid}
Auth required. Returns list of active (non-deleted) attachments.

### DELETE /api/attachments/{id}/
Auth required. Soft delete. RBAC: uploader or admin only.

---

## Feeling Portal

### POST /api/feeling/redeem/
No auth required.
```json
// Request
{ "code_short": "P7O2S1" }

// Response 200
{ "token": "P7O2S1", "family_name": "Fatima Ben Ali" }

// Response 404 — invalid code
// Response 403 — revoked
// Response 410 — expired
```

### GET /api/feeling/card/{token}/
No auth required.
```json
// Response 200
{
  "family_name": "Fatima Ben Ali",
  "family_id": "uuid",
  "phone": "+21671000001",
  "visit_date": "2026-02-07T06:42:43.229Z",
  "aids": [
    {
      "id": "uuid",
      "aid_type_id": "uuid",
      "aid_type_key": "food_parcel",
      "label_fr": "Colis alimentaire",
      "label_ar": "طرد غذائي",
      "quantity": 2,
      "note_short": "",
      "is_urgent": null
    }
  ],
  "next_action": "Prochain suivi dans 30 jours",
  "code_short": "P7O2S1"
}
```

---

## Dashboard

### GET /api/dashboard/
Auth required. **Admin only.**
```json
// Response 200
{
  "kpis": {
    "families_total": 7,
    "visits_30d": 8,
    "visits_7d": 1,
    "visits_trend": 1,
    "overdue": 3,
    "overdue_trend": 0,
    "urgent": 2,
    "urgent_trend": 0,
    "new_families_7d": 7,
    "new_families_trend": 1
  },
  "top_aids_30d": [
    { "aid_type_key": "food_parcel", "label": "Colis alimentaire", "count": 8 }
  ],
  "critical_queue": [
    {
      "id": "uuid",
      "head_name": "Mohamed Trabelsi",
      "zone_label": "Zone Est",
      "priority": "overdue",
      "next_due_at": "2026-01-23T06:31:24.664Z",
      "last_visit_at": "2026-01-08T06:31:24.664Z",
      "phone": "+21671000004"
    }
  ],
  "complaints_summary": {
    "open": 3,
    "in_progress": 0,
    "resolved": 0,
    "closed": 0
  },
  "data_quality": {
    "global_score": 95,
    "missing_phone": 1,
    "missing_location": 0,
    "overdue_without_visit": 0
  }
}
```

---

## Complaints

### GET /api/complaints/?status=open
Auth required. RBAC: agent=own families, admin=all.
```json
// Response 200 (paginated)
{
  "count": 3,
  "results": [
    {
      "id": "uuid",
      "family": "uuid",
      "family_name": "Fatima Ben Ali",
      "visit": "uuid",
      "created_by": "uuid",
      "created_by_name": "Sara Mansouri",
      "category": "missing_aid",
      "priority": "medium",
      "status": "open",
      "messages": [
        {
          "id": "uuid",
          "complaint": "uuid",
          "author": "uuid",
          "author_name": "Sara Mansouri",
          "message": "Aide manquante...",
          "created_at": "2026-02-07T06:31:24.664Z"
        }
      ],
      "created_at": "2026-02-07T06:31:24.664Z",
      "updated_at": "2026-02-07T06:31:24.664Z"
    }
  ]
}
```

---

## STT Proxy

### POST /api/stt/transcribe-segment
Auth required. Multipart: `audio` file field.
```json
// Response 200 (proxied from FastAPI)
{ "text": "transcribed text here" }

// Response 502 — FastAPI service unreachable
```

---

## WebAuthn (Passkeys) — Optional Passwordless Login

All endpoints under `/api/auth/webauthn/`. Email/password login remains unchanged.
No biometric data is stored — only WebAuthn public-key credentials.

### POST /api/auth/webauthn/register/options/
Auth required. Generates registration (creation) options. Challenge stored in session (5 min TTL).
```json
// Response 200 (PublicKeyCredentialCreationOptions JSON)
{
  "rp": { "name": "OMNIA Charity Tracking", "id": "localhost" },
  "user": {
    "id": "base64url-encoded-user-id",
    "name": "sara@omnia.org",
    "displayName": "Sara Mansouri"
  },
  "challenge": "base64url-encoded-challenge",
  "pubKeyCredParams": [
    { "type": "public-key", "alg": -7 },
    { "type": "public-key", "alg": -257 }
  ],
  "timeout": 300000,
  "excludeCredentials": [],
  "authenticatorSelection": {
    "residentKey": "preferred",
    "userVerification": "preferred"
  },
  "attestation": "none"
}
```

### POST /api/auth/webauthn/register/verify/
Auth required. Body: raw JSON from `navigator.credentials.create()` response.
```json
// Response 201
{
  "id": "uuid",
  "credential_id": "base64url-encoded",
  "created_at": "2026-02-07T14:30:00.000Z"
}

// Response 400 — verification failed or challenge expired
{ "detail": "Registration verification failed: ..." }

// Response 409 — credential already registered
{ "detail": "Credential already registered." }
```

### POST /api/auth/webauthn/login/options/
No auth required. Rate-limited (5/min per IP).
Does **not** leak user existence — always returns 200.
```json
// Request
{ "email": "sara@omnia.org" }

// Response 200 (PublicKeyCredentialRequestOptions JSON)
{
  "rpId": "localhost",
  "challenge": "base64url-encoded-challenge",
  "allowCredentials": [
    {
      "id": "base64url-credential-id",
      "type": "public-key",
      "transports": ["internal", "hybrid"]
    }
  ],
  "timeout": 300000,
  "userVerification": "preferred"
}
```
If the user has no passkeys or doesn't exist, `allowCredentials` will be empty/absent (generic response).

### POST /api/auth/webauthn/login/verify/
No auth required. Rate-limited (5/min per IP).
Body: raw JSON from `navigator.credentials.get()` response.
Sets `sessionid` cookie on success — **same as password login**.
```json
// Response 200 — same shape as POST /api/auth/login/
{
  "id": "uuid",
  "email": "sara@omnia.org",
  "first_name": "Sara",
  "last_name": "Mansouri",
  "role": "agent"
}

// Response 400 — no pending challenge or expired
{ "detail": "Challenge expired." }

// Response 401 — invalid credential
{ "detail": "Invalid credentials." }
```

### GET /api/auth/webauthn/credentials/
Auth required. Lists the authenticated user's registered passkeys.
```json
// Response 200
[
  {
    "id": "uuid",
    "credential_id": "base64url-encoded",
    "sign_count": 42,
    "transports": ["internal", "hybrid"],
    "aaguid": "00000000-0000-0000-0000-000000000000",
    "created_at": "2026-02-07T14:30:00.000Z",
    "last_used_at": "2026-02-07T15:00:00.000Z"
  }
]
```

### DELETE /api/auth/webauthn/credentials/{id}/
Auth required. Users can only delete their own passkeys.
```json
// Response 200
{ "detail": "Credential removed." }

// Response 404
{ "detail": "Credential not found." }
```

**Audit log actions:** `passkey_registered`, `passkey_login_success`, `passkey_removed`

**curl examples:**
```bash
# 1. Get CSRF token
curl -c cookies.txt http://localhost:8000/api/auth/csrf/

# 2. Login with password (existing flow)
curl -b cookies.txt -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <token>" \
  -d '{"email":"sara@omnia.org","password":"dev12345"}'

# 3. Register passkey — get options
curl -b cookies.txt -X POST http://localhost:8000/api/auth/webauthn/register/options/ \
  -H "X-CSRFToken: <token>"

# 4. Register passkey — verify (body from navigator.credentials.create())
curl -b cookies.txt -X POST http://localhost:8000/api/auth/webauthn/register/verify/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <token>" \
  -d '<attestation-response-json>'

# 5. Login with passkey — get options (unauthenticated)
curl -c cookies.txt -X POST http://localhost:8000/api/auth/webauthn/login/options/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <token>" \
  -d '{"email":"sara@omnia.org"}'

# 6. Login with passkey — verify (body from navigator.credentials.get())
curl -b cookies.txt -X POST http://localhost:8000/api/auth/webauthn/login/verify/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <token>" \
  -d '<assertion-response-json>'

# 7. List registered passkeys
curl -b cookies.txt http://localhost:8000/api/auth/webauthn/credentials/

# 8. Delete a passkey
curl -b cookies.txt -X DELETE http://localhost:8000/api/auth/webauthn/credentials/<uuid>/ \
  -H "X-CSRFToken: <token>"
```

**Browser manual test guide:**
1. Login with email/password → navigate to account settings
2. Click "Add Passkey" → browser prompts biometric/security key → confirm
3. Logout → on login page click "Sign in with Passkey"
4. Enter email → browser prompts biometric → session cookie set → redirected to /app
5. Verify `GET /api/auth/me/` returns user data (same as password login)
6. List credentials → verify passkey appears with correct sign_count
7. Delete passkey → verify it no longer appears in list
8. Try passkey login again → should return 401 (credential removed)

---

## Health

### GET /api/health/
No auth required.
```json
{ "status": "ok", "version": "0.1.0" }
```

---

## Emergencies

Emergency incidents triggered during field visits or standalone (agent safety).

### GET /api/emergencies/types/
Auth required. Returns active emergency types.
```json
// Response 200
[
  {
    "id": "uuid",
    "key": "medical",
    "label_fr": "Urgence médicale",
    "label_ar": "طوارئ طبية",
    "severity_level": 5,
    "is_agent_safety": false
  }
]
```

### POST /api/emergencies/trigger/
Auth required. Creates a new emergency incident.

**Idempotency:** If `client_id` is provided and an incident with that `client_id` already exists, returns the existing incident (200).

```json
// Request
{
  "client_id": "uuid-optional",
  "type_key": "medical",
  "family_id": "uuid-optional",
  "visit_id": "uuid-optional",
  "summary": "Elderly woman collapsed",
  "details": "Found unconscious on floor, called ambulance",
  "trigger_method": "slide",
  "lat": 36.8065,
  "lng": 10.1815,
  "accuracy_m": 12,
  "network_state": "online"
}

// Response 201 (new) or 200 (idempotent)
{
  "id": "uuid",
  "client_id": "uuid",
  "type": "uuid",
  "type_key": "medical",
  "type_label_fr": "Urgence médicale",
  "type_label_ar": "طوارئ طبية",
  "family": "uuid",
  "family_name": "Fatima Ben Ali",
  "visit": null,
  "status": "open",
  "severity_level": 5,
  "summary": "Elderly woman collapsed",
  "details": "Found unconscious on floor, called ambulance",
  "trigger_method": "slide",
  "lat": 36.8065,
  "lng": 10.1815,
  "accuracy_m": 12,
  "network_state": "online",
  "created_by": "uuid",
  "created_by_name": "Sara Mansouri",
  "assigned_admin": null,
  "assigned_admin_name": null,
  "acknowledged_at": null,
  "resolved_at": null,
  "closed_at": null,
  "created_at": "2026-02-07T10:00:00.000Z",
  "updated_at": "2026-02-07T10:00:00.000Z",
  "actions": [
    {
      "id": "uuid",
      "action_type": "created",
      "actor": "uuid",
      "actor_name": "Sara Mansouri",
      "message": "Emergency triggered: Urgence médicale (severity 5)",
      "created_at": "2026-02-07T10:00:00.000Z"
    }
  ]
}
```

**Validation rules:**
- `family_id` and `visit_id` can both be null ONLY if `type.is_agent_safety=true`
- If both `visit_id` and `family_id` are provided, visit must belong to family

**Side effects:**
- Creates EmergencyAction (created) + AuditLog entry
- Sends notification to all admins (rate-limited: 1 per incident per 60s)

### GET /api/emergencies/
Auth required. RBAC: agent=own/assigned families, admin=all.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | `open\|acknowledged\|in_progress\|resolved\|closed` | Filter by status |
| `type` | string (key) | Filter by emergency type key |
| `created_by` | UUID | Filter by creator |
| `since` | ISO datetime | Filter created_at >= since |

### GET /api/emergencies/mine/
Auth required. Returns incidents created by current user.

### GET /api/emergencies/{id}/
Auth required. Full incident with actions timeline.

### POST /api/emergencies/{id}/acknowledge/
**Admin only.** Sets status=acknowledged.
```json
// Response 200 — full incident shape
```

### POST /api/emergencies/{id}/status/
**Admin only.** Change incident status.
```json
// Request
{ "status": "in_progress", "message": "Ambulance dispatched" }
```

**Valid transitions:**
- `open` → `acknowledged`, `in_progress`
- `acknowledged` → `in_progress`, `resolved`
- `in_progress` → `resolved`
- `resolved` → `closed`

### POST /api/emergencies/{id}/actions/
Auth required. Add a note to the incident timeline.
```json
// Request
{ "message": "Called emergency services" }

// Response 201
{
  "id": "uuid",
  "action_type": "note",
  "actor": "uuid",
  "actor_name": "Sara Mansouri",
  "message": "Called emergency services",
  "created_at": "2026-02-07T10:05:00.000Z"
}
```

### POST /api/emergencies/{id}/assign/
**Admin only.** Assign an admin to the incident.
```json
// Request
{ "admin_id": "uuid" }

// Response 200 — full incident shape
```

### curl examples
```bash
# 1) Trigger an emergency (online)
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/trigger/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"type_key":"medical","family_id":"FAMILY_UUID","summary":"Medical emergency","trigger_method":"slide","network_state":"online"}'

# 2) Trigger offline (idempotent via client_id)
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/trigger/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"client_id":"550e8400-e29b-41d4-a716-446655440000","type_key":"agent_threat","trigger_method":"long_press","network_state":"offline_queued"}'

# 2b) Replay same client_id → returns existing (200, not 201)
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/trigger/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"client_id":"550e8400-e29b-41d4-a716-446655440000","type_key":"agent_threat","trigger_method":"long_press","network_state":"offline_queued"}'

# 3) List open emergencies (admin)
curl -b cookies.txt "http://localhost:8000/api/emergencies/?status=open"

# 4) My emergencies (agent)
curl -b cookies.txt http://localhost:8000/api/emergencies/mine/

# 5) Acknowledge
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/INCIDENT_UUID/acknowledge/ \
  -H "X-CSRFToken: $CSRF"

# 6) Change status
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/INCIDENT_UUID/status/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"status":"in_progress","message":"Ambulance dispatched"}'

# 7) Resolve
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/INCIDENT_UUID/status/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"status":"resolved","message":"Patient stabilized"}'

# 8) Close
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/INCIDENT_UUID/status/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"status":"closed"}'

# 9) Add note
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/INCIDENT_UUID/actions/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"message":"Called emergency services, ETA 10 min"}'

# 10) Assign admin
curl -b cookies.txt -X POST http://localhost:8000/api/emergencies/INCIDENT_UUID/assign/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"admin_id":"ADMIN_UUID"}'

# 11) Upload evidence (reuse attachments endpoint)
curl -b cookies.txt -X POST http://localhost:8000/api/attachments/ \
  -H "X-CSRFToken: $CSRF" \
  -F "file=@photo.jpg" \
  -F "owner_type=emergency_incident" \
  -F "owner_id=INCIDENT_UUID"
```

---

## Attestations (Sign on Glass)

Delivery proof via sign-on-glass. NOT authentication — stores SVG path data only.
Accessible: supports "cannot sign" with reason. One attestation per visit (v1).

### GET /api/visits/{visit_id}/attestation/
Auth required. RBAC: agent=own/assigned, admin=all.
```json
// Response 200
{
  "id": "uuid",
  "visit": "uuid",
  "created_by": "uuid",
  "created_by_name": "Sara Mansouri",
  "created_at": "2026-02-07T14:00:00.000Z",
  "signed_at": "2026-02-07T14:00:00.000Z",
  "status": "signed",
  "signer_name": "Fatima Ben Ali",
  "signer_role": "beneficiary",
  "signature_svg": "M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80",
  "reason_cannot_sign": null,
  "witness_name": null,
  "lat": 36.8065,
  "lng": 10.1815,
  "accuracy_m": 12,
  "client_id": "uuid"
}

// Response 404 — no attestation for this visit
```

### POST /api/visits/{visit_id}/attestation/
Auth required. Creates attestation for the visit.

**Idempotency:** If `client_id` already exists, returns existing attestation (200).

```json
// Request — signed
{
  "client_id": "uuid-optional",
  "status": "signed",
  "signer_name": "Fatima Ben Ali",
  "signer_role": "beneficiary",
  "signature_svg": "M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80",
  "lat": 36.8065,
  "lng": 10.1815,
  "accuracy_m": 12
}

// Request — cannot sign (accessible)
{
  "client_id": "uuid-optional",
  "status": "cannot_sign",
  "signer_role": "beneficiary",
  "reason_cannot_sign": "Beneficiary is visually impaired",
  "witness_name": "Ahmed Ben Salem"
}

// Response 201 — same shape as GET above
// Response 200 — idempotent (client_id matched)
// Response 409 — visit already has attestation
```

**Validation rules:**
- `signature_svg` required when `status=signed`
- `reason_cannot_sign` required when `status=cannot_sign`
- `signer_role`: `beneficiary`, `family_member`, or `witness`

### GET /api/attestations/
Auth required. List all attestations. RBAC applied.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | `signed\|cannot_sign` | Filter by attestation status |
| `missing` | `true` | Returns visits WITHOUT attestations instead |

### Visit serializer changes
All visit responses now include:
```json
{
  "has_attestation": true,
  "attestation_status": "signed",
  "attested_at": "2026-02-07T14:00:00.000Z"
}
```

### curl examples
```bash
# 1) Sign on glass (beneficiary signs)
curl -b cookies.txt -X POST http://localhost:8000/api/visits/VISIT_UUID/attestation/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"status":"signed","signer_name":"Fatima Ben Ali","signer_role":"beneficiary","signature_svg":"M 10 80 C 40 10 65 10 95 80","lat":36.8,"lng":10.18}'

# 2) Cannot sign (accessible)
curl -b cookies.txt -X POST http://localhost:8000/api/visits/VISIT_UUID/attestation/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"status":"cannot_sign","signer_role":"beneficiary","reason_cannot_sign":"Visually impaired","witness_name":"Ahmed"}'

# 3) Offline idempotent (replay same client_id)
curl -b cookies.txt -X POST http://localhost:8000/api/visits/VISIT_UUID/attestation/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"client_id":"550e8400-e29b-41d4-a716-446655440000","status":"signed","signer_role":"beneficiary","signature_svg":"M 0 0 L 100 100"}'

# 4) Get attestation for a visit
curl -b cookies.txt http://localhost:8000/api/visits/VISIT_UUID/attestation/

# 5) List visits without attestations
curl -b cookies.txt "http://localhost:8000/api/attestations/?missing=true"

# 6) List visits filtered by attestation status
curl -b cookies.txt "http://localhost:8000/api/visits/?family_id=FAMILY_UUID&attested=false"
```
