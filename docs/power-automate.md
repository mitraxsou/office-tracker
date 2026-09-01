# Power Automate integration (Teams + email)

Office Tracker exposes a secured API for **Power Automate** to poll for alerts. Delivery (Teams, Outlook email) happens in Power Automate using approved PwC Microsoft connectors.

## Integration API keys (recommended)

Admins generate keys in the app. No Vercel env var is required for new setups.

1. Sign in as **admin** and open **Admin → Global settings**.
2. Scroll to **Integration API keys**.
3. Enter a label (e.g. `Power Automate - AC IAM`) and click **Generate new key**.
4. **Copy the key immediately**; it is shown once and cannot be retrieved later.
5. In Power Automate HTTP actions, set header **`Authorization`** to **`Bearer <key>`** (or use **`X-Api-Key: <key>`**).

You can create **multiple keys** (separate flows, environments, or teams). Revoke a key from the same admin page if it is compromised or no longer needed.

**Security:**

- Keys are stored as bcrypt hashes; only the 8-character prefix is shown in the admin table.
- Revoked keys stop working immediately.
- Create and revoke actions are written to the audit log.

## Legacy env var (`INTEGRATION_API_KEY`)

Older deployments may still use a single key in **Vercel → Project → Settings → Environment Variables** as `INTEGRATION_API_KEY`. That value continues to work alongside admin-generated keys. New pilots should use admin-generated keys instead.

To check legacy setup: Vercel dashboard → your project → **Settings** → **Environment Variables** → look for `INTEGRATION_API_KEY`.

## Prerequisites

1. Deploy Office Tracker (Postgres connected).
2. Admin generates at least one integration key (or legacy env var is set).
3. Users configure **Office schedule and alerts** in Settings (`/settings`).
4. Power Automate access to HTTP, Teams, and Outlook connectors.

## API

### Get pending alerts

```
GET https://office-tracker-theta.vercel.app/api/integrations/alerts
GET https://office-tracker-theta.vercel.app/api/integrations/alerts?types=stale,absent
```

**Auth** (either):

- `Authorization: Bearer <integration-api-key>`
- `X-Api-Key: <integration-api-key>`

**Response:**

```json
{
  "generatedAt": "2026-09-01T10:15:00.000Z",
  "alerts": [
    {
      "type": "absent",
      "userId": "clx...",
      "email": "user@pwc.com",
      "name": "User Name",
      "message": "No office Wi-Fi detected yet today...",
      "hoursToday": 0,
      "hoursTarget": 5,
      "agentHealthy": true,
      "inOfficeNow": false,
      "notifyTeams": true,
      "notifyEmail": true,
      "dayKey": "2026-09-01",
      "dashboardUrl": "https://office-tracker-theta.vercel.app/dashboard",
      "settingsUrl": "https://office-tracker-theta.vercel.app/settings"
    }
  ]
}
```

**Alert types:**

| Type | When |
|------|------|
| `absent` | Work day, past start + grace, no in-office Wi-Fi today |
| `stale` | Agent not pulsing, user has a registered laptop |
| `behind` | Work day, past check time, hours below user threshold |

Each type is sent **at most once per user per day** (after ack).

### Acknowledge alerts (after sending)

```
POST https://office-tracker-theta.vercel.app/api/integrations/alerts
Authorization: Bearer <integration-api-key>
Content-Type: application/json

{
  "alerts": [
    { "userId": "clx...", "type": "absent", "dayKey": "2026-09-01" }
  ]
}
```

Call this after Teams/email succeed so users are not spammed.

## Power Automate flow (step-by-step)

Build this after generating an integration key in the admin panel.

### Troubleshooting: “Your flow should contain at least one trigger and one action”

This usually means the HTTP action was added but **not saved or completed**:

- Open the **HTTP** action and fill in Method, URI, and Headers, then click **Save** on the action card.
- Ensure the HTTP step is **inside** the flow (not a disconnected draft block).
- Add at least one more action after HTTP (e.g. **Parse JSON**) so the flow has trigger + action(s).
- Save the whole flow (**Save** top-right), then try **Test** or turn the flow **On**.

### Trigger

- **Recurrence**: every 15–30 minutes (15 min is fine for pilot)
- **Days**: Monday–Friday
- **Hours**: 8:00–18:00 (India Standard Time)

### Step 1 — HTTP GET alerts

- **Method**: GET
- **URI**: `https://office-tracker-theta.vercel.app/api/integrations/alerts`
- **Headers**:
  - `Authorization`: `Bearer <your integration API key>`

### Step 2 — Parse JSON

- **Content**: body from step 1
- **Schema**: use `generatedAt` (string), `alerts` (array)

### Step 3 — Apply to each alert

For each item in `alerts`:

#### 3a — Teams (if `notifyTeams` is true)

- **Post message in a chat or channel** (Teams connector)
- **Recipient**: user email from `email` field (or post to pilot channel with @mention)
- **Message** example:

```
Office Pulse: @{email}

@{message}

Dashboard: @{dashboardUrl}
Settings: @{settingsUrl}
```

#### 3b — Email (if `notifyEmail` is true)

- **Send an email (V2)** (Office 365 Outlook)
- **To**: `email`
- **Subject**: `PwC Office Pulse reminder`
- **Body**: HTML with `message`, `dashboardUrl`, `settingsUrl`

### Step 4 — HTTP POST ack

After the loop, collect sent items and POST ack:

```json
{
  "alerts": [
    { "userId": "...", "type": "absent", "dayKey": "2026-09-01" }
  ]
}
```

Use **Append to array variable** inside the loop, then POST once at the end.

## User settings

Users control alerts at **Settings → Office schedule and alerts**:

- Usual office days (Mon–Sun toggles)
- Start / end time
- Grace period before “not in office” alert
- Teams / email toggles
- Alert types: not in office, agent stale, behind on hours

## Limitations

- Heartbeats cannot be recreated if the laptop was off; alerts nudge users to fix the agent or check in manually.
- “Not in office” means no office Wi-Fi SSID detected, not badge/HR presence.
- WFH days: user can disable `alertIfNotInOffice` or remove that day from work days.

## Testing the API

```powershell
$key = "your-integration-api-key-from-admin-panel"
Invoke-RestMethod -Uri "https://office-tracker-theta.vercel.app/api/integrations/alerts" `
  -Headers @{ Authorization = "Bearer $key" }
```
