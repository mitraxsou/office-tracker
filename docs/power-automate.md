# Power Automate notifications

Office Pulse sends each eligible alert to a Power Automate HTTP trigger. Power Automate validates a shared header secret, then delivers the alert through Teams and Outlook.

## 1. Create the trigger

Create an instant cloud flow named `Office Pulse - notify user`.

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
    "hoursToday": { "type": "number" },
    "hoursTarget": { "type": "number" },
    "notifyTeams": { "type": "boolean" },
    "notifyEmail": { "type": "boolean" },
    "dashboardUrl": { "type": "string" },
    "settingsUrl": { "type": "string" },
    "helpUrl": { "type": "string" },
    "outOfOfficeUrl": { "type": "string" }
  },
  "required": [
    "type",
    "email",
    "name",
    "message",
    "hoursToday",
    "hoursTarget",
    "notifyTeams",
    "notifyEmail",
    "dashboardUrl",
    "settingsUrl",
    "helpUrl",
    "outOfOfficeUrl"
  ]
}
```

The secret is not part of the JSON body or schema.

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
- If **Yes**, continue to the Teams and email conditions.

Do not place delivery actions outside the **Yes** branch.

## 4. Send a Teams message

Inside the valid-token branch, add a Condition for:

```
triggerBody()?['notifyTeams']
```

When true, add **Post message in a chat or channel**:

- Post as: User
- Post in: Chat with
- Recipient: `email`

Suggested message:

```
PwC Office Pulse (@{triggerBody()?['type']})

@{triggerBody()?['message']}

Dashboard: @{triggerBody()?['dashboardUrl']}
Settings: @{triggerBody()?['settingsUrl']}
Help: @{triggerBody()?['helpUrl']}
Out of office today: @{triggerBody()?['outOfOfficeUrl']}
```

## 5. Send an email

Inside the valid-token branch, add a Condition for:

```
triggerBody()?['notifyEmail']
```

When true, add **Send an email (V2)**:

- To: `email`
- Subject: `PwC Office Pulse reminder`
- Body: use the message and links from the Teams example

## 6. Test and enable

1. Turn the flow on.
2. In Office Pulse, open **Admin > Global settings**.
3. Confirm **Webhook URL: Configured**.
4. Select **Send test notification**.
5. Confirm that Teams and email arrive at the signed-in admin email.
6. Send or inspect a request without the token and confirm the flow terminates before delivery.

Office Pulse acknowledges an alert only after Power Automate returns HTTP 2xx. Failed requests remain pending and the 15-minute cron retries them.

## Rotation and operations

To rotate the shared secret:

1. Generate a new secret in Admin.
2. Copy it into the first Power Automate Condition.
3. Save the flow.
4. Send a test notification.

Only one database secret remains active. Revoking it stops outbound delivery until another secret is generated.

The webhook URL and header token must never be logged or exposed in browser responses. Limit flow run history access to flow owners because HTTP trigger headers may appear there.

Disable old Recurrence flows that call `GET /api/integrations/alerts` and post acknowledgements. That inbound API no longer exists.
