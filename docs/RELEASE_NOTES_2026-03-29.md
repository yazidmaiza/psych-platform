# Release Notes (Work in Progress)

Date: 2026-03-29 (Africa/Lagos)

This document summarizes the changes currently in the working tree (not yet committed) relative to the repo `HEAD` commit `29edccc`.

## 1) Goals and Product Decisions

### One chatbot, automatic session type
- Patients do not choose chatbot types at booking/payment time.
- The first session defaults to pre-consultation (`preparation`).
- After a patient completes their first session, future sessions automatically default to `followup`.
- The chatbot behavior changes via a session-type-specific system prompt, not via separate UIs.
- Primary files:
  - `C:\Users\Mega-PC\psych-platform\server\src\controllers\chatbotController.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\models\Session.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\controllers\sessionController.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\routes\calendar.routes.js`

### Chatbot messages saved incrementally
- User messages are saved before calling the LLM, and assistant replies are saved after the call.
- This enables partial history persistence if the model call fails or the user disconnects.
- Primary files:
  - `C:\Users\Mega-PC\psych-platform\server\src\controllers\chatbotController.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\models\ChatbotMessage.js` (existing model used)

### AI summary generated on patient logout (every logout)
- Logging out as a patient triggers a server request that attempts to summarize active sessions (instead of waiting for a session to finish).
- Client uses a short timeout and `keepalive` to avoid blocking logout.
- Primary files:
  - `C:\Users\Mega-PC\psych-platform\client\src\services\auth.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\controllers\chatbotController.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\routes\chatbotRoutes.js`

## 2) Patient Booking and Restrictions (Your Requirements 1-6)

### Req 1: Hide psychologists already in an open session
Behavior:
- If the patient already has a non-`completed` and non-`canceled` session with a psychologist, that psychologist is hidden from the patient's psychologist list/dashboard.

Implementation:
- Client fetches patient sessions and filters the list of psychologists.
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistList.jsx`

Notes:
- This affects the patient view at `/patient/dashboard` which renders `PsychologistList`.

### Req 2: Prevent rating the same psychologist twice (remove rate button)
Behavior:
- If the patient already rated a psychologist, the rating UI action is removed/blocked.

Implementation:
- Profile checks `/api/ratings/check/:psychologistId` and hides the rate CTA if `hasRated`.
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistProfile.jsx`

### Req 3: Patient cannot message or rate without booking a consultation
Behavior:
- Messaging is blocked at the API level unless the patient has a relevant booked/requested session with that psychologist.
- UI also disables "Send a Message" unless booked.

Implementation:
- Server gates message endpoints based on existence of a session between patient and psychologist.
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\server\src\routes\message.routes.js`

Client gating:
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistProfile.jsx`

### Req 4: Rating automatically reflected everywhere + number of raters
Behavior:
- Psychologist cards show average rating and total ratings count (reviews).
- This is displayed in:
  - Patient psychologist list
  - Psychologist profile
  - Public psychologist profile cards (where applicable)

Implementation:
- Client renders `averageRating` and `totalRatings` fields.
- Primary files:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistList.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistProfile.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\HomePage.jsx`

Backend support:
- Rating aggregation and/or returned fields are handled in:
  - `C:\Users\Mega-PC\psych-platform\server\src\controllers\ratingController.js`

### Req 5: Booking request shows calendar, patient chooses from available confirmed slots
Behavior:
- Patient selects a psychologist availability slot from the calendar view (`/calendar/:psychologistId`).
- Slots show statuses:
  - Available
  - Pending
  - Booked
- Patient can only request an available slot.
- The session type is assigned automatically (no UI selection).

Implementation:
- Calendar UI updated to:
  - load slots for either psychologist or patient context
  - display pending state
  - prevent selecting slots that are booked or pending
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\Calendar.jsx`

Backend:
- Slots endpoint filters pending slots so patients do not see a slot pending for other patients.
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\server\src\routes\calendar.routes.js`

### Req 6: Notifications + payment redirect + auto-cancel unpaid bookings within 1 day
Behavior:
- Patient requests a slot -> psychologist receives a notification.
- Psychologist confirms -> patient receives a notification with a link to payment.
- Payment must be completed within 24 hours, otherwise:
  - the session is canceled automatically (on subsequent relevant reads)
  - the slot is freed
  - the patient receives a cancellation notification

Implementation:
- New notification model and notifications API mounted.
- Payment deadline stored on session as `paymentDueAt`.
- Expiry enforcement runs when fetching slots and when fetching patient sessions, canceling overdue `pending_payment` sessions.
- Primary backend files:
  - `C:\Users\Mega-PC\psych-platform\server\src\models\Notification.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\routes\notificationRoutes.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\routes\calendar.routes.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\controllers\sessionController.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\models\Session.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\index.js`

Client entry points:
- Calendar confirmation alerts and navigation:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\Calendar.jsx`
- Notifications page (new):
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\Notifications.jsx`

## 3) Session UX (New Live Session Page)

### Problem addressed
- Previously, active sessions routed users into a chatbot-only experience (`/chatbot/:sessionId`) which did not provide a unified live session UI with both:
  - AI chatbot
  - Psychologist chat

### New unified session route and page
- New route: `/session/:sessionId`
- New page provides:
  - full-screen dark glass UI
  - top bar with Logout, End Session (confirm), Close view
  - tab switch between Chatbot and Psychologist threads
  - independent chat histories per tab
  - tab close and reopen controls
  - psychologist disabled state when session is not active
  - typing indicators

Primary files:
- Route wiring:
  - `C:\Users\Mega-PC\psych-platform\client\src\App.js`
- Main UI:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\SessionPage.jsx`
- Reusable UI components:
  - `C:\Users\Mega-PC\psych-platform\client\src\components\session\ChatBox.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\components\session\MessageBubble.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\components\session\SessionTabs.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\components\session\SessionTopBar.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\components\session\TypingIndicator.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\components\session\ConfirmDialog.jsx`
- Thread hooks:
  - `C:\Users\Mega-PC\psych-platform\client\src\hooks\useChatbotThread.js`
  - `C:\Users\Mega-PC\psych-platform\client\src\hooks\usePsychologistThread.js`

Backend support added:
- `GET /api/sessions/:id` to load session metadata securely.
- Primary files:
  - `C:\Users\Mega-PC\psych-platform\server\src\controllers\sessionController.js`
  - `C:\Users\Mega-PC\psych-platform\server\src\routes\sessionRoutes.js`

## 4) Navigation Fixes and Bug Fixes

### My Sessions redirect issue (/history)
- Patient "My Sessions" route exists as `/history` and renders `MySessionHistory`.
- The new live session button now routes to `/session/:sessionId` for active sessions.
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\MySessionHistory.jsx`

### Missing "Book" button after patient login
- Patient dashboard is the psychologist list, and now each psychologist card includes a clear "Book a Session" CTA.
- Primary file:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistList.jsx`

## 5) Quality, Lint, and Cleanups

### React hooks dependency warnings addressed
- Several pages were refactored to use `useCallback` and stable dependencies to satisfy `react-hooks/exhaustive-deps`.
- Example primary files:
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\Calendar.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\HomePage.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PatientDetail.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistList.jsx`

### Removed debug logs and avoided non-ASCII glyphs
- Removed `console.log` from `ProtectedRoute`.
- Replaced emoji/star glyphs and arrow glyph strings with ASCII-safe text.
- Primary files:
  - `C:\Users\Mega-PC\psych-platform\client\src\components\ProtectedRoute.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistList.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\Conversation.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\MySessionHistory.jsx`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\VerifyCode.jsx`

### Shared socket instance (prevents duplicate connections)
- Introduced a shared `socket` instance used by both Conversation and SessionPage.
- Primary files:
  - `C:\Users\Mega-PC\psych-platform\client\src\services\socket.js`
  - `C:\Users\Mega-PC\psych-platform\client\src\pages\Conversation.jsx`

### Build verification
- Client production build compiles successfully via `npm.cmd run build`.

## 6) Files Changed (Index)

### Modified (tracked)
- `C:\Users\Mega-PC\psych-platform\README.md`
- `C:\Users\Mega-PC\psych-platform\docs\API.md`
- `C:\Users\Mega-PC\psych-platform\client\src\App.js`
- `C:\Users\Mega-PC\psych-platform\client\src\components\ProtectedRoute.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\AdminPanel.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Calendar.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Chatbot.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Conversation.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\CreateSession.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Dashboard.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\EditProfile.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\HomePage.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Login.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\MySessionHistory.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\PatientDetail.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\PatientHistory.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\PaymentConfirm.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistList.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistProfile.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\PsychologistSetup.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\PublicPsychologistProfile.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\RateConsultation.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Register.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Statistics.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\VerifyCode.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\services\auth.js`
- `C:\Users\Mega-PC\psych-platform\server\src\controllers\chatbotController.js`
- `C:\Users\Mega-PC\psych-platform\server\src\controllers\ratingController.js`
- `C:\Users\Mega-PC\psych-platform\server\src\controllers\reportController.js`
- `C:\Users\Mega-PC\psych-platform\server\src\controllers\sessionController.js`
- `C:\Users\Mega-PC\psych-platform\server\src\index.js`
- `C:\Users\Mega-PC\psych-platform\server\src\models\CalendarSlot.js`
- `C:\Users\Mega-PC\psych-platform\server\src\models\PatientHistory.js`
- `C:\Users\Mega-PC\psych-platform\server\src\models\Session.js`
- `C:\Users\Mega-PC\psych-platform\server\src\models\SessionCode.js`
- `C:\Users\Mega-PC\psych-platform\server\src\routes\calendar.routes.js`
- `C:\Users\Mega-PC\psych-platform\server\src\routes\chatbotRoutes.js`
- `C:\Users\Mega-PC\psych-platform\server\src\routes\dashboard.routes.js`
- `C:\Users\Mega-PC\psych-platform\server\src\routes\message.routes.js`
- `C:\Users\Mega-PC\psych-platform\server\src\routes\sessionRoutes.js`

### Added (untracked; should be added to git)
- `C:\Users\Mega-PC\psych-platform\client\src\services\socket.js`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\SessionPage.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\components\session\ChatBox.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\components\session\ConfirmDialog.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\components\session\MessageBubble.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\components\session\SessionTabs.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\components\session\SessionTopBar.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\components\session\TypingIndicator.jsx`
- `C:\Users\Mega-PC\psych-platform\client\src\hooks\useChatbotThread.js`
- `C:\Users\Mega-PC\psych-platform\client\src\hooks\usePsychologistThread.js`
- `C:\Users\Mega-PC\psych-platform\client\src\pages\Notifications.jsx`
- `C:\Users\Mega-PC\psych-platform\server\src\models\Notification.js`
- `C:\Users\Mega-PC\psych-platform\server\src\routes\notificationRoutes.js`

## 7) Known Gaps / Next Steps (If You Want)
- Replace placeholder "psychologist offline" detection with a real presence signal (Socket.IO online status per psychologist).
- Move remaining legacy flows that still route to `/chatbot/:sessionId` (if you want everything to use `/session/:sessionId`).
- Decide whether uploads under `server/uploads` should be git-ignored (recommended).
