# Power Automate integration (Teams + email)

Office Tracker exposes a secured API for **Power Automate** to poll for alerts. Delivery (Teams, Outlook email) happens in Power Automate using approved PwC Microsoft connectors.

## Prerequisites

1. Deploy Office Tracker with env var **`INTEGRATION_API_KEY`** (long random string).
2. Users configure **Office schedule and alerts** in Settings (`/settings`).
3. Power Automate access to HTTP, Teams, and Outlook connectors.

## API

### Get pending alerts

```
GET https://office-tracker-theta.vercel.app/api/integrations/alerts
GET https://office-tracker-theta.vercel.app/api/integrations/alerts?types=stale,absent
```

**Auth** (either):

- `Authorization: Bearer <INTEGRATION_API_KEY>`
- `X-Api-Key: <INTEGRATION_API_KEY>`

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
Authorization: Bearer <INTEGRATION_API_KEY>
Content-Type: application/json

{
  "alerts": [
    { "userId": "clx...", "type": "absent", "dayKey": "2026-09-01" }
  ]
}
```

Call this after Teams/email succeed so users are not spammed.

## Sample Power Automate flow

### Trigger

- **Recurrence**: every 30 minutes
- **Days**: Monday–Friday
- **Hours**: 8:00–18:00 (India Standard Time)

### Step 1 — HTTP GET alerts

- **Method**: GET
- **URI**: `https://office-tracker-theta.vercel.app/api/integrations/alerts`
- **Headers**:
  - `Authorization`: `Bearer <your INTEGRATION_API_KEY>`

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

## Vercel env

Add in Vercel project settings:

```
INTEGRATION_API_KEY=<openssl rand -hex 32>
```

Redeploy after setting.

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
$key = "your-integration-api-key"
Invoke-RestMethod -Uri "https://office-tracker-theta.vercel.app/api/integrations/alerts" `
  -Headers @{ Authorization = "Bearer $key" }
```
