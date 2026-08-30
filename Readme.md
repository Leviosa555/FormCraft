# FormCraft — local setup and Milestone 2 test guide

FormCraft is a Django REST API and React form-builder application. Milestone 2 adds conditional rules, submission validation, response storage, and protected local file uploads.

## 1. Prerequisites

- Python 3.12+ and Node.js 20+
- PostgreSQL running on `localhost:5432`
- A database called `formcraft_db` and a PostgreSQL user matching `backend/config/settings.py`. For real deployments, move these database settings and Django `SECRET_KEY` to environment variables.

## 2. First-time setup

Open PowerShell in the project folder.

```powershell
# Backend
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py createsuperuser

# Frontend (open a second terminal)
cd frontend
npm install
```

Create `frontend/.env` if it does not already exist:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

Start both applications:

```powershell
# Terminal 1, from backend
..\.venv\Scripts\python.exe manage.py runserver

# Terminal 2, from frontend
npm run dev
```

Open these URLs:

| Purpose | URL |
| --- | --- |
| React application | http://localhost:5173 |
| Swagger UI | http://127.0.0.1:8000/api/docs/ |
| OpenAPI schema | http://127.0.0.1:8000/api/schema/ |
| Django admin | http://127.0.0.1:8000/admin/ |

## 3. Swagger UI: authenticated API test

1. Open Swagger UI and expand `POST /api/login/`.
2. Click **Try it out** and submit your superuser credentials:

```json
{
  "username": "your_username",
  "password": "your_password"
}
```

3. Copy the `access` token from the response. Click **Authorize**, enter `Bearer <access-token>` (if the dialog already adds `Bearer`, paste only the token), then authorize. All owner endpoints below now use that token.

### Create a complete test form

Use `POST /api/forms/`:

```json
{
  "title": "Milestone 2 verification form",
  "description": "Validates rules, field values, submissions and uploads."
}
```

Save the returned form `id` as `FORM_ID`. Add these fields using `POST /api/forms/{FORM_ID}/fields/`; replace the values in braces with returned field IDs in the later steps.

**Dropdown trigger**

```json
{
  "label": "Do you have a licence?",
  "field_type": "dropdown",
  "required": true,
  "display_order": 1,
  "config": {},
  "options": [
    {"label": "Yes", "value": "yes", "display_order": 1},
    {"label": "No", "value": "no", "display_order": 2}
  ]
}
```

**Conditionally required text field**

```json
{
  "label": "Licence number",
  "field_type": "text",
  "required": false,
  "display_order": 2,
  "config": {"min_length": 5, "max_length": 20},
  "options": []
}
```

**Email field**

```json
{
  "label": "Contact email",
  "field_type": "email",
  "required": true,
  "display_order": 3,
  "config": {},
  "options": []
}
```

**Optional file field**

```json
{
  "label": "Proof document",
  "field_type": "file",
  "required": false,
  "display_order": 4,
  "config": {"allowed_extensions": ["pdf"], "max_size_mb": 2},
  "options": []
}
```

Create two rules with `POST /api/forms/{FORM_ID}/conditional_rules/` while the form is still a draft.

```json
{
  "trigger_field": 1,
  "operator": "equals",
  "comparison_value": "yes",
  "action": "require",
  "target_field": 2
}
```

```json
{
  "trigger_field": 1,
  "operator": "equals",
  "comparison_value": "no",
  "action": "hide",
  "target_field": 2
}
```

Replace `1` and `2` with the dropdown and text field IDs actually returned by Swagger. Confirm the rules using `GET /api/forms/{FORM_ID}/conditional_rules/`, then publish with `POST /api/forms/{FORM_ID}/publish/`. The response contains `share_token`.

## 4. Swagger UI: public submission tests

These endpoints require no authorization. Replace `SHARE_TOKEN` and field IDs.

First call `GET /api/forms/share/{SHARE_TOKEN}/`. It should return the published schema, options, and `conditional_rules`.

Use `POST /api/forms/share/{SHARE_TOKEN}/submit/` for these JSON tests:

**Valid: “No” hides the licence number**

```json
{
  "responses": [
    {"field": 1, "value": "no"},
    {"field": 3, "value": "person@example.com"}
  ]
}
```

Expected result: `201 Created` with a unique `submission_id`.

**Invalid: hidden field submitted**

```json
{
  "responses": [
    {"field": 1, "value": "no"},
    {"field": 2, "value": "ABCDE"},
    {"field": 3, "value": "person@example.com"}
  ]
}
```

Expected result: `400` and a message that field 2 is hidden.

**Invalid: conditional requirement missing**

```json
{
  "responses": [
    {"field": 1, "value": "yes"},
    {"field": 3, "value": "person@example.com"}
  ]
}
```

Expected result: `400` and a message that the licence number is required.

**Invalid: field validation**

Submit `"not-an-email"` for field 3 or fewer than five characters for field 2. Each must return `400` without creating a submission.

You can also test `not_equals`, `contains`, `greater_than`, and `is_empty` by creating a rule with those operator values. `is_empty` must use `null` for `comparison_value`.

## 5. Browser (localhost) end-to-end test

1. Open http://localhost:5173 and sign in with the same superuser credentials.
2. Create a form, add fields from the palette, and configure their labels/options in the properties panel.
3. In **Conditional Logic**, add rules. The builder prevents rule changes on a published version; click **Edit Draft** first when changing a published form.
4. Publish the draft and use **Copy Share Link**.
5. Open the copied link in an incognito/private window. This verifies that the public form is truly anonymous.
6. Select **No** and confirm the licence field disappears. Select **Yes** and confirm it is visible and required.
7. Submit invalid values to see client-side required checks, then valid values to reach the success screen.
8. Attach a PDF under 2 MB to the file field and submit. A non-PDF or a file larger than 2 MB must be rejected by the API.
9. Return to the builder and select **View Responses**. Confirm the saved values are visible. File responses contain a protected download URL valid for 24 hours.

## 6. File upload API test (PowerShell)

Swagger is best for JSON submissions. For an actual attachment, use `curl.exe` after publishing. `responses` must be a JSON string and each file input key is `file_<FIELD_ID>`.

The Swagger schema displays `file_<field_id>` as a naming pattern, not a literal upload key. For a file field with ID `162`, the multipart key must be `file_162`; use the browser or the command below for that dynamic key.

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/forms/share/SHARE_TOKEN/submit/" `
  -F 'responses=[{"field":1,"value":"yes"},{"field":2,"value":"ABCDE"},{"field":3,"value":"person@example.com"}]' `
  -F "file_4=@C:\path\to\proof.pdf"
```

For the licence form with fields `159`–`162` and `C:\Users\MOHAMMED\Desktop\TestUpload.pdf`, use this exact request (replace only `SHARE_TOKEN`):

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/forms/share/SHARE_TOKEN/submit/" `
  -F 'responses=[{"field":159,"value":"yes"},{"field":160,"value":"ABCDE"},{"field":161,"value":"person@example.com"}]' `
  -F "file_162=@C:\Users\MOHAMMED\Desktop\TestUpload.pdf;type=application/pdf"
```

Expected result: `201 Created` with a `submission_id` and one `files` item containing the stored PDF name and signed `download_url`.

The response includes a `files` array with a signed `download_url`. Open it in a browser; it downloads the attachment. Changing the token or waiting 24 hours must make the link unavailable.

## 7. Automated checks

Run these from `backend`:

```powershell
..\.venv\Scripts\python.exe manage.py check
..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
..\.venv\Scripts\python.exe -m compileall -q forms fields
```

Run this from `frontend`:

```powershell
npm run build
```

`npm run lint` currently reports existing scaffold lint errors in unrelated UI files. The production build is the current frontend verification command.

## 8. Milestone 3: analytics, exports, retention, and response management

Milestone 3 adds response operations to the existing form builder. Run the migration before using these features:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py migrate
```

### Dashboard

Open `http://localhost:5173/dashboard` after signing in.

- **Form portfolio:** Select a form from the left-side list to view its details. Use **Open builder** to edit it or **Duplicate** to create a new draft with the same active fields, options, validation configuration, and conditional rules.
- **Analytics:** The selected form displays submitted count, completion rate, average completion time, and a Recharts distribution chart for the first dropdown/rating field with data.
- **Completion tracking:** Opening a public form starts a response session. Submitting the form completes that same session, allowing completion rate and duration to be calculated.
- **Retention:** Enter a number of days and save. Submitted responses older than that period are archived automatically when analytics or the response browser is opened. Archived responses remain visible when filtered.

### Response browser

Open **View responses** from the dashboard or Builder.

- Each submission is displayed with its field labels and values.
- Uploaded files display as signed, clickable download links.
- **Export CSV** and **Export JSON** download responses for the active form version. Columns use form field labels; attachment cells contain signed download URLs.
- The responses API supports `page`, `page_size`, `start_date`, `end_date`, `status`, `field_id`, `field_value`, and `search` query parameters. The current response page uses the paginated API response.

### API endpoints

Authenticated owner endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/forms/{id}/analytics/` | Metrics and dropdown/rating distributions. |
| `GET /api/forms/{id}/responses/` | Paginated responses with optional filters. |
| `GET /api/forms/{id}/export/?format=csv` | CSV response export. |
| `GET /api/forms/{id}/export/?format=json` | JSON response export. |
| `POST /api/forms/{id}/duplicate/` | Copies the active schema and rules to a new draft. Optional JSON body: `{"title": "Copy name"}`. |
| `POST /api/forms/{id}/retention/` | Sets retention policy. Body: `{"retention_days": 90}`. |
| `POST /api/forms/{id}/responses/bulk-delete/` | Deletes selected responses and adds an audit log. Body: `{"submission_ids": [1, 2]}`. |

Public lifecycle endpoint:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/forms/share/{share_token}/start/` | Creates a started-response session and returns `session_token`. The public frontend sends this token at submission. |

### Scheduled retention cleanup

To enforce retention independently of dashboard/API activity, schedule this command once daily using Windows Task Scheduler or your deployment scheduler:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py archive_expired_submissions
```

### Audit records

Bulk response deletions, retention-policy updates, automatic archival, and form duplication write audit records. Admin users can inspect them in Django Admin at `http://127.0.0.1:8000/admin/` under **Audit logs**.

## 9. Frontend feature test checklist

Use this checklist after starting the backend at `http://127.0.0.1:8000` and the frontend at `http://localhost:5173`.

### Preparation

1. Sign in at `http://localhost:5173` with a user who owns at least one form.
2. Ensure one form is published and contains either a dropdown or rating field.
3. Submit at least two public responses through the form share link. Use different dropdown/rating values so the chart has data.
4. Refresh the dashboard after submissions.

### Dashboard layout and portfolio

1. Open `http://localhost:5173/dashboard`.
2. Confirm the header shows **Your form portfolio**, **New form**, and **Log out**.
3. Confirm the three summary cards show Total forms, Published, and Selected responses.
4. Click different forms in the left-side form list.

Expected: the selected card receives a green tinted state, and the right-side analytics workspace updates to the selected form.

5. Resize the browser to tablet/mobile width.

Expected: the form list and analytics workspace stack vertically without horizontal page scrolling.

### Form actions

1. Click **Open builder** for a form.

Expected: it opens `/builder/{form_id}`.

2. Return to the dashboard and click the copy icon / **Duplicate** action for a form.

Expected: a success toast appears and the new draft opens in Builder. Its fields, options, validation settings, and conditional rules match the source form.

3. Click **New form**, create a new form, and return to the dashboard.

Expected: the new draft appears in the left-side portfolio list.

### Analytics

1. Select a published form with submitted responses.
2. Verify **Submitted**, **Completion rate**, and **Avg. completion** values.
3. Confirm the response-distribution chart is visible for the first dropdown/rating field with answers.
4. Hover a chart bar.

Expected: the tooltip shows the selected answer value and its response count.

5. Submit another response with a different dropdown/rating answer, then reload the dashboard.

Expected: Submitted count increases and the chart distribution changes accordingly.

### Retention policy

1. Select a form, enter `90` in **Retention period**, then click **Save policy**.

Expected: a success toast confirms that the policy was saved. Refreshing or selecting the form again retains the value.

2. In Django Admin, inspect **Audit logs**.

Expected: an `retention_policy_updated` audit entry exists.

3. To test auto-archival with old data, set a short period on test data and run:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py archive_expired_submissions
```

Expected: old submitted responses change to `archived` and an audit entry is written.

### Response browser and files

1. From the selected dashboard form, click **View responses**.

Expected: the route opens `/builder/{form_id}/responses` and displays submitted responses.

2. Confirm every response displays its submitted time, labels, and values.
3. For a file-upload answer, click its filename.

Expected: the signed URL downloads the file. The file value must not display as `[object Object]`.

4. Click **Export CSV** and **Export JSON**.

Expected: both downloads start successfully. CSV headers match form field labels; JSON includes response objects. File fields contain signed download URLs.

### Conditional logic regression test

1. Open a public form link in an incognito/private browser window.
2. Change the field that controls a show/hide or require rule.

Expected: the affected target field appears, disappears, or becomes required immediately.

3. Submit a valid response and return to the dashboard.

Expected: analytics and the response browser show the new submitted response after refresh.

### Final frontend build test

Run this from the `frontend` directory:

```powershell
npm run build
```

Expected: Vite completes with `built in ...` and no build errors. A bundle-size warning can appear; it does not prevent the build.
