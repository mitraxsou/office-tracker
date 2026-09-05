# Power Automate notifications

Office Pulse sends OTP sign-in codes and office alerts through a single Power Automate HTTP trigger (`POWER_AUTOMATE_WEBHOOK_URL`). Power Automate validates a shared header secret, then delivers messages to Microsoft Teams only. Email is not used.

You need only **one** flow: `Office Pulse - notify user`.

## 1. Create or update the HTTP trigger

Open your existing instant cloud flow **Office Pulse - notify user** (or create it).

Choose **When an HTTP request is received**:

- Who can trigger the flow: **Anyone**
- Method: `POST`
- Request Body JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "type": { "type": "string" },
    "email": { "type": "string" },
    "name": { "type": "string" },
    "message": { "type": "string" },
    "otp": { "type": "string" },
    "otpExpiresMinutes": { "type": "number" },
    "hoursToday": { "type": "number" },
    "hoursTarget": { "type": "number" },
    "notifyTeams": { "type": "boolean" },
    "dashboardUrl": { "type": "string" },
    "settingsUrl": { "type": "string" },
    "helpUrl": { "type": "string" },
    "outOfOfficeUrl": { "type": "string" }
  },
  "required": ["type", "email", "name", "message"]
}
```

Notes:

- `otp` and `otpExpiresMinutes` are present only for `type: login_otp`.
- URL fields are present for alert types (`hours_started`, `hours_met`, `custom`, and reminder types). Office Pulse always sends them for alerts with defaults from `NEXT_PUBLIC_APP_URL`.
- The shared secret is **not** part of the JSON body.

Save the flow once. Copy the generated HTTP POST URL into the Vercel environment variable `POWER_AUTOMATE_WEBHOOK_URL`. Treat this URL as a secret and never commit it.

## 2. Generate the header secret

1. Sign in to Office Pulse as an admin.
2. Open **Admin > Global settings**.
3. Find **Power Automate webhook secret**.
4. Enter a label and select **Generate new secret**.
5. Copy the value immediately. It is shown once.

Generating a new secret revokes the previous active secret. Office Pulse stores a bcrypt hash and an AES-256-GCM encrypted copy protected by `AUTH_SECRET`.

## 3. Reject requests with the wrong secret

The first flow action after the trigger must be a **Condition**. Compare the incoming `X-Office-Pulse-Token` header with the admin-generated secret.

Use this expression and replace the placeholder with the copied secret:

```
equals(
  coalesce(
    triggerOutputs()?['headers']?['X-Office-Pulse-Token'],
    triggerOutputs()?['headers']?['x-office-pulse-token']
  ),
  '<paste admin-generated secret>'
)
```

Header names may be normalized to lowercase, so the expression checks both forms.

- If **No**, add **Terminate** with status **Cancelled**.
- If **Yes**, continue to the Switch on `type` below.

Do not place delivery actions outside the **Yes** branch.

## 4. Branch on notification type

Inside the valid-token branch, add a **Switch** on:

```
triggerBody()?['type']
```

Cases:

| Case | When it fires |
|------|----------------|
| `login_otp` | OTP sign-in code |
| `hours_started` | Office Wi-Fi first detected today |
| `hours_met` | Daily hours target met |
| Default | `custom` and other alert types |

## 5. OTP branch (`login_otp`)

For the `login_otp` case only:

1. Add **Post adaptive card in a chat or channel** (or **Post message in a chat or channel**).
2. Post as: **User**
3. Post in: **Chat with**
4. Recipient: use dynamic content `email` from the trigger body (not a hardcoded address):

```
triggerBody()?['email']
```

5. Message body (no action buttons):

```
PwC Office Pulse sign-in

Your code: @{triggerBody()?['otp']}

@{triggerBody()?['message']}

Expires in @{triggerBody()?['otpExpiresMinutes']} minutes.
```

Do not add Open URL actions for OTP messages.

## 6. Alert branches (`hours_started`, `hours_met`, default)

For each alert case (`hours_started`, `hours_met`, and **Default** for `custom` / reminder types):

### 6a. Set base URLs with coalesce defaults

Create compose variables (or inline in the card) so missing URLs still work. Replace `https://your-app.vercel.app` with your `NEXT_PUBLIC_APP_URL`:

| Variable | Expression |
|----------|------------|
| dashboardUrl | `coalesce(triggerBody()?['dashboardUrl'], 'https://your-app.vercel.app/dashboard')` |
| settingsUrl | `coalesce(triggerBody()?['settingsUrl'], 'https://your-app.vercel.app/settings')` |
| helpUrl | `coalesce(triggerBody()?['helpUrl'], 'https://your-app.vercel.app/help')` |
| outOfOfficeUrl | `coalesce(triggerBody()?['outOfOfficeUrl'], 'https://your-app.vercel.app/settings#out-of-office')` |

### 6b. Post adaptive card with dynamic actions

1. Add **Post adaptive card in a chat or channel**.
2. Post as: **User**
3. Recipient: `triggerBody()?['email']`
4. Card body example:

```json
{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "PwC Office Pulse (@{triggerBody()?['type']})",
      "weight": "Bolder"
    },
    {
      "type": "TextBlock",
      "text": "@{triggerBody()?['message']}",
      "wrap": true
    }
  ],
  "actions": []
}
```

### 6c. Build the actions array dynamically

For each URL you want as a button, use **Condition** + **Append to array variable**:

1. Initialize an array variable `actions` to `[]`.
2. For each link, add a **Condition** (e.g. dashboard URL is not empty, or always true if you use coalesce above).
3. On **Yes**, **Append to array variable** `actions`:

```json
{
  "type": "Action.OpenUrl",
  "title": "Dashboard",
  "url": "@{variables('dashboardUrl')}"
}
```

Repeat for Settings, Help, and Out of office with the coalesced URL variables.

4. Pass `actions` into the adaptive card JSON.

Simpler alternative: use **Post message in a chat or channel** with plain text and link lines:

```
PwC Office Pulse (@{triggerBody()?['type']})

@{triggerBody()?['message']}

Dashboard: @{coalesce(triggerBody()?['dashboardUrl'], 'https://your-app.vercel.app/dashboard')}
Settings: @{coalesce(triggerBody()?['settingsUrl'], 'https://your-app.vercel.app/settings')}
Help: @{coalesce(triggerBody()?['helpUrl'], 'https://your-app.vercel.app/help')}
Out of office: @{coalesce(triggerBody()?['outOfOfficeUrl'], 'https://your-app.vercel.app/settings#out-of-office')}
```

## 7. Test and enable

1. Turn the flow on.
2. In Office Pulse, open **Admin > Global settings**.
3. Confirm **Webhook URL: Configured**.
4. Select **Send test notification** (exercises `hours_started`).
5. Sign in with OTP on `/login` and confirm the Teams code arrives.
6. Send or inspect a request without the token and confirm the flow terminates before delivery.

Office Pulse acknowledges an alert only after Power Automate returns HTTP 2xx. Failed requests remain pending. The daily agent-alerts cron retries them, and in-office `hours_started` and `hours_met` alerts also send from agent heartbeats.

## 8. Updating an existing flow (checklist)

If you already have **Office Pulse - notify user** with the old schema:

1. Open the flow in edit mode.
2. Click the **When an HTTP request is received** trigger.
3. Replace the Request Body JSON Schema with the schema in section 1 (add `otp`, `otpExpiresMinutes`; remove `notifyEmail` from required and properties).
4. Save the trigger (Power Automate may regenerate the URL; if so, update `POWER_AUTOMATE_WEBHOOK_URL` in Vercel).
5. Confirm the token **Condition** from section 3 is still the first action after the trigger.
6. Remove any **Send an email (V2)** actions and conditions on `notifyEmail`.
7. Add the **Switch** on `triggerBody()?['type']` after the token check.
8. Add the `login_otp` branch (section 5) with recipient `triggerBody()?['email']`.
9. Update alert branches to use dynamic recipient `triggerBody()?['email']` instead of a fixed user.
10. Add coalesce defaults for URL fields in alert messages (section 6).
11. Save and turn the flow on.
12. Run **Send test notification** and a test OTP sign-in.

## Rotation and operations

To rotate the shared secret:

1. Generate a new secret in Admin.
2. Copy it into the first Power Automate Condition.
3. Save the flow.
4. Send a test notification.

Only one database secret remains active. Revoking it stops outbound delivery until another secret is generated.

The webhook URL and header token must never be logged or exposed in browser responses. Limit flow run history access to flow owners because HTTP trigger headers may appear there.

Disable old Recurrence flows that called `GET /api/integrations/alerts`. That inbound API no longer exists.

## Payload reference

### `login_otp`

```json
{
  "type": "login_otp",
  "email": "colleague@pwc.com",
  "name": "Colleague",
  "message": "Your PwC Office Pulse sign-in code is 123456. It expires in 10 minutes.",
  "otp": "123456",
  "otpExpiresMinutes": 10
}
```

### `hours_started` / `hours_met` / `custom`

```json
{
  "type": "hours_started",
  "email": "colleague@pwc.com",
  "name": "Colleague",
  "message": "Office Wi-Fi detected. Your office hours count has started for today.",
  "hoursToday": 0.5,
  "hoursTarget": 5,
  "notifyTeams": true,
  "dashboardUrl": "https://your-app.vercel.app/dashboard",
  "settingsUrl": "https://your-app.vercel.app/settings",
  "helpUrl": "https://your-app.vercel.app/help",
  "outOfOfficeUrl": "https://your-app.vercel.app/settings#out-of-office"
}
```
