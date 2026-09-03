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
GET https://office-tracker-theta.vercel.app/api/integrations/alerts?types=hours_started,hours_met
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
      "settingsUrl": "https://office-tracker-theta.vercel.app/settings",
      "helpUrl": "https://office-tracker-theta.vercel.app/help",
      "outOfOfficeUrl": "https://office-tracker-theta.vercel.app/ooo?token=..."
    }
  ]
}
```

**Alert types:**

| Type | When |
|------|------|
| `absent` | Usual office day, past start + grace, no office presence, and the latest healthy pulse has no SSID |
| `stale` | Usual office day, no office presence, agent not responding, and user has a registered laptop |
| `behind` | Work day, past check time, hours below user threshold |
| `hours_started` | First office Wi-Fi heartbeat for that user and local calendar day |
| `hours_met` | Office hours span reaches the user&apos;s daily hours target |

Each type is sent **at most once per user per local calendar day** after acknowledgement. Reminder types (`absent`, `stale`, and `behind`) only run on the user&apos;s configured usual office days, which default to Wednesday and Friday. `hours_started` and `hours_met` can run on any day because verified office Wi-Fi presence triggers them. No alerts are sent on out-of-office days.

A recent heartbeat with an SSID that is not on the office allowlist is treated as working from home. It does not produce `absent` or `stale`. A reminder is only produced when the latest heartbeat has no SSID or the agent is not responding.

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
- **Days**: every day that pilot users may attend the office
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
Install help: @{helpUrl}
Out of office today: @{outOfOfficeUrl}
```

The **outOfOfficeUrl** link is unique per user per day. When clicked, it marks them out of office and stops further alerts for that day (no login required).

#### 3b — Email (if `notifyEmail` is true)

- **Send an email (V2)** (Office 365 Outlook)
- **To**: `email`
- **Subject**: `PwC Office Pulse reminder`
- **Body**: HTML with `message`, `dashboardUrl`, `settingsUrl`, and a link using `outOfOfficeUrl` (“I’m out of office today”)

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

## Duplicate the flow for positive hours alerts

Create a second Power Automate flow so Teams and email templates for positive updates are separate from reminders:

1. Open the existing reminder flow and choose **Save As**.
2. Name the copy `Office Pulse - hours updates`.
3. In its HTTP GET action, set the URI to `https://office-tracker-theta.vercel.app/api/integrations/alerts?types=hours_started,hours_met`.
4. Keep the same Parse JSON fields. The `type` value is either `hours_started` or `hours_met`.
5. Add a Condition or Switch on `type`:
   - `hours_started`: use a template such as `Office hours have started counting. Daily target: @{hoursTarget}h.`
   - `hours_met`: use a template such as `Daily office target met. Counted today: @{hoursToday}h.`
6. Keep the POST acknowledgement step and send `userId`, `type`, and `dayKey` exactly as returned.
7. Turn on both flows.

The second flow can reuse the same Integration API key. For separate ownership or easier revocation, generate another key under Admin settings and use it only in the positive-alert flow. Both flows use the same `/api/integrations/alerts` path; the `types` query parameter separates their queues. Do not configure both flows to request all types, or they can race to deliver the same alert.

## User settings

Users control alerts at **Settings → Office schedule and alerts**:

- Usual office days (Mon–Sun toggles)
- Start / end time
- Grace period before “not in office” alert
- Teams / email toggles
- Alert types: not in office, agent stale, behind on hours
- Positive alert types: hours started and daily hours target met

**Out of office** (Settings → Out of office):

- Mark today or future days when away — no alerts for those days
- Or use the one-click link in a Teams/email alert (`outOfOfficeUrl`)

## Limitations

- Heartbeats cannot be recreated if the laptop was off; alerts nudge users to fix the agent or check in manually.
- “Not in office” means no office Wi-Fi SSID detected, not badge/HR presence.
- A recent pulse on home or another non-office Wi-Fi is treated as WFH and does not trigger a not-in-office reminder.

## Testing the API

```powershell
$key = "your-integration-api-key-from-admin-panel"
Invoke-RestMethod -Uri "https://office-tracker-theta.vercel.app/api/integrations/alerts" `
  -Headers @{ Authorization = "Bearer $key" }
```
