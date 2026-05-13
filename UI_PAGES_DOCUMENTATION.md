# Psych Platform - UI Pages Documentation

This document describes each page in the application to guide UI generation and improvements.

---

## Authentication Pages

### 1. **HomePage** (`HomePage.jsx`)
**Purpose:** Landing page showing available psychologists with filtering, search, and map view

**Key Features:**
- Psychologist list with pagination (9 per page)
- Search functionality (debounced 400ms)
- Distance-based filtering using geolocation
- Map view showing psychologist locations
- Sorting by rating or distance
- Star ratings display for each psychologist
- View mode toggle (list/map)

**UI Components:**
- Search bar with language support (ar, en, fr)
- Filter controls (distance slider, sort dropdown)
- Map with Leaflet.js
- Psychologist cards with:
  - Profile image
  - Name, rating, specialization
  - Distance from user
  - Book button
  - Location via map

**Data Flow:**
- Fetches `/api/psychologists` or `/api/psychologists/nearby` 
- Geolocation tracking via browser API
- Real-time map centering

**UI Patterns:**
- Glass panel design (frosted glass effect)
- Light/Dark theme toggle
- Responsive grid layout

---

### 2. **Login** (`Login.jsx`)
**Purpose:** User authentication page

**Key Features:**
- Email/password login
- Device ID tracking for multi-device sessions
- Role-based post-login navigation
- Admin direct access (bypasses email verification)
- Error messaging
- Link to registration

**Form Fields:**
- Email (with placeholder)
- Password (masked input)

**Validation:**
- Both fields required
- Submit button disabled while loading

**Post-Login Flow:**
- Admin → `/admin` (skips verification)
- Psychologist → `/psychologist/dashboard`
- Patient → `/patient/dashboard` or `/verify-email` if not verified

**UI Styling:**
- AuthShell wrapper component
- Input fields with focus rings
- Error box (rose/red styling)
- Back button to homepage

---

### 3. **Register** (`Register.jsx`)
**Purpose:** New user account creation with role selection

**Key Features:**
- Role selection cards (Patient/Psychologist) at the top
- Sequential form fields: Full Name, Birth Date, Telephone, Email, Password, Re-enter Password
- Password validation (8+ chars, must contain digit)
- Password matching verification
- Email verification required post-registration

**Role Selection:**
- Visual card buttons (Patient/Psychologist)
- Active state highlighted with accent color
- Descriptions for each role

**Form Fields (in order):**
1. Full Name
2. Birth Date
3. Telephone
4. Email
5. Password (8+ chars, must have digit)
6. Re-enter Password

**Validation:**
- All fields required
- Passwords must match
- Password complexity enforced

**Post-Registration:**
- Psychologist → `/setup` (onboarding flow)
- Patient → `/patient/dashboard` or email verification if needed
- Email verification link sent automatically

**UI Styling:**
- Role cards with active state indicator
- Form grouped by sections
- Input focus effects with indigo accent
- Error messages in rose/red

---

### 4. **VerifyEmail** (`VerifyEmail.jsx`)
**Purpose:** Email verification after registration or resending verification link

**Key Features:**
- Automatic verification when landing on page with token
- Shows success/failure message
- Resend verification email option
- Auto-redirect after successful verification

**Workflow:**
- User clicks email link → token in URL
- `GET /api/auth/verify-email?token=...`
- Sets `isVerified=true` in localStorage
- Auto-redirect after 2 seconds to appropriate dashboard

**UI Elements:**
- Status message display
- Resend button (disabled if no email)
- Back to login link
- Loading states

---

## Patient Pages

### 5. **Dashboard** (Patient) - `/patient/dashboard` (`Dashboard.jsx`)
**Purpose:** Main psychologist profile and session management dashboard

**Key Features:**
- Statistics cards (sessions, ratings, etc.)
- Patient list (for psychologists)
- Credential documents upload
- Session history
- Charts/analytics (AreaLineChart, StackedBar)
- Notifications drawer
- Profile management drawer

**Sections:**
- **Patients Section:** List of patient names with booking/consulting status
- **Credentials Section:** Upload CV, diploma, ID, intro video
- **Statistics Section:** Visualized metrics with charts
- **Session History:** Recent sessions with status

**Data Flows:**
- `/api/dashboard/patients` → patient list
- `/api/dashboard/stats` → statistics data
- `/api/credential-documents/my` → credentials list
- `/api/onboarding/me` → onboarding status

**UI Components:**
- StatCard: shows label, value, hint text
- GlassPanel: container component
- DashboardSidebar: navigation
- NotificationsDrawer: slide-in notifications
- PsychologistProfileDrawer: profile editing

---

### 6. **PsychologistList** (`PsychologistList.jsx`)
**Purpose:** Browse available psychologists with advanced filtering

**Key Features:**
- Full psychologist directory
- Multiple view modes (list, grid, map)
- Advanced filters:
  - Search by name/specialty
  - Distance filtering
  - Specialty filtering
  - Availability status
- Real-time open sessions indicator
- Rating and review display
- Location-based sorting

**Filter Panel:**
- Search input (debounced)
- Distance slider
- Specialty multiselect
- Language preference filter
- Geolocation toggle

**Psychologist Card Shows:**
- Avatar/profile image
- Name and specialty
- Star rating and review count
- Distance from user
- Availability status
- Quick book button
- View profile link

**Map Integration:**
- Leaflet.js for map display
- Red markers for each psychologist
- Click to center on location
- Popup with basic info

**Data Flow:**
- `/api/psychologists` → full list
- `/api/psychologists/nearby` → location-based results
- `/api/notifications` → unread count

---

### 7. **PsychologistProfile** (`PsychologistProfile.jsx`)
**Purpose:** Detailed view of a specific psychologist's profile

**Key Features:**
- Full profile information display
- Qualifications and certifications
- Patient reviews and ratings
- Availability calendar
- Session history with this psychologist
- Booking status indicators
- Rating/review submission option

**Profile Sections:**
- Hero section with photo
- Bio and specializations
- Qualifications and languages
- Location on map
- Availability info
- Reviews section with star ratings
- Session history

**Booking States:**
- Has booked → show history, can rate if completed
- Open session → show "Continue" option
- No session → show "Book" button
- Completed session → show "Rate" button
- Already rated → show rating info

**UI Elements:**
- Large profile image
- Bio text area
- Qualifications list
- Star rating display with count
- Reviews list with user comments
- CTA buttons (Book, Continue, Rate)

**Data Flows:**
- `/api/psychologists/:id` → profile data
- `/api/sessions/patient/:userId` → session history
- `/api/ratings/check/:psychologistId` → rating status

---

### 8. **PublicPsychologistProfile** (`PublicPsychologistProfile.jsx`)
**Purpose:** Public-facing profile for non-logged-in users (likely)

**Key Features:** (Similar to PsychologistProfile but read-only)

---

### 9. **CreateSession** (`CreateSession.jsx`)
**Purpose:** Initiate booking with a psychologist

**Features:**
- Booking confirmation page
- Pre-consultation intake explanation
- Continue to payment flow
- Error handling

**UI:**
- Informational text about session types
- CTA button to proceed to payment
- Back button
- Error message display

**Data Flow:**
- `POST /api/sessions` with psychologistId
- Redirects to `/payment/:sessionId`

---

### 10. **SessionPage** (`SessionPage.jsx`)
**Purpose:** Active therapy session with chatbot and psychologist (if available)

**Key Features:**
- Dual-mode messaging:
  - Chatbot (AI) chat
  - Psychologist chat (real-time)
- Tab switching between modes
- Recording capability
- Mute toggle for text-to-speech
- Session status display
- Presence indicator for psychologist
- End session confirmation
- Message persistence

**UI Layout:**
- Top bar with session info and controls
- Tab navigation (Bot/Psychologist)
- Chat box with message history
- Input area with send button
- Recording/mute controls
- End session button

**Features:**
- Automatic message scrolling
- Text-to-speech playback with mute control
- Audio recording capability
- Session end confirmation modal
- Real-time presence indicator

**Data Flows:**
- `/api/sessions/:sessionId` → get session details
- Uses `useChatbotThread` and `usePsychologistThread` hooks
- WebSocket via socket.io for real-time psychologist messages

---

### 11. **MySessionHistory** (`MySessionHistory.jsx`)
**Purpose:** View past and ongoing sessions

**Key Features:**
- Session list with status indicators
- Session summaries (chatbot summaries)
- Filtering and sorting
- Session cancellation
- Rating button for completed sessions
- Expandable session details
- Session notes display

**Session Info Displayed:**
- Psychologist name/avatar
- Session date and type (prep/followup/free)
- Status badge (requested, pending, active, completed, canceled)
- Duration
- Summary preview (expandable)

**Status Styles:**
- Requested: Amber
- Pending/Pending Payment: Yellow
- Active: Indigo
- Completed: Emerald
- Canceled: Rose

**Actions:**
- Cancel session (confirmation dialog)
- View details (expand)
- Rate consultation (if completed)
- Continue session (if active)

**Data Flows:**
- `/api/sessions/patient/:userId` → all sessions
- `/api/ratings/check/:sessionId` → rating status
- `DELETE /api/sessions/:sessionId` → cancel

---

### 12. **RateConsultation** (`RateConsultation.jsx`)
**Purpose:** Rate and review completed sessions

**Features:**
- 10-question rating system
- Star rating (1-5) for each question
- Optional comment field
- Psychologist profile display
- Submission confirmation

**Rating Questions:**
1. Punctuality and professionalism
2. Attentiveness
3. Safety and comfort
4. Clear explanations
5. Empathy and understanding
6. Productivity of session
7. Would recommend
8. Boundary respect
9. Overall satisfaction
10. Would book again

**UI:**
- Question list with star rating controls
- Comment textarea
- Submit button
- Psychologist info header

**Data Flow:**
- `POST /api/ratings` with answers and comment
- Redirects after successful submission

---

### 13. **Conversation** (`Conversation.jsx`)
**Purpose:** Direct messaging with psychologist or another user

**Features:**
- Real-time messaging
- Audio recording
- Text-to-speech playback
- Session linking
- Message persistence
- WebSocket integration

**UI:**
- Message list (auto-scrolling)
- Input field with send button
- Recording/mute controls
- User/psychologist avatar
- Timestamp display

---

### 14. **Calendar** (`Calendar.jsx`)
**Purpose:** View and manage appointment slots

**Key Features:**
- Calendar view using react-big-calendar
- Available, booked, and pending slot display
- Slot booking capability
- Recurring slots option
- Week/day view toggle
- Psychologist slot management

**Slot States:**
- Available (green)
- Booked (blocked)
- Pending (yellow) - awaiting confirmation
- My Pending (special state for patient's own requests)

**Features:**
- Click to book available slots
- Drag to resize/reschedule
- Weekly recurrence option
- Set until date for recurring
- Clear visual distinction between states

**Data Flows:**
- `/api/calendar/slots/:userId` → get slots
- `POST /api/calendar/slots` → create/book slot
- Persistent last-viewed date in localStorage

---

### 15. **Notifications** (`Notifications.jsx`)
**Purpose:** View and manage all notifications

**Key Features:**
- Notification list with timestamps
- Read/unread status
- Mark all as read
- Notification preferences
- Deep linking (click notification navigates to relevant page)
- Real-time updates

**Notification Types:**
- Session updates
- Message alerts
- Booking confirmations
- Rating reminders
- System notifications

**UI:**
- Notification list with icon/avatar
- Title and description
- Timestamp (relative)
- Unread indicator (dot)
- Mark as read button
- Preferences toggle panel

**Data Flows:**
- `/api/notifications` → list
- `PUT /api/notifications/:id/read` → mark as read
- `PUT /api/notifications/read/all` → mark all read
- `/api/notifications/preferences` → user preferences

---

### 16. **EditProfile** (`EditProfile.jsx`)
**Purpose:** Update user profile information

**Key Features:**
- Profile form for psychologists
- Availability settings
- Specializations
- Languages spoken
- Bio/description
- Location
- Document uploads

**Data Flows:**
- `GET /api/profile/me` → load current data
- `PUT /api/profile` → save changes

---

## Psychologist Pages

### 17. **PsychologistSetup** (`PsychologistSetup.jsx`)
**Purpose:** Multi-step onboarding for new psychologists

**Key Features:**
- Multi-step form (wizard pattern)
- Personal information collection
- Specialization selection (multiple choice)
- Language selection (multiple choice)
- Document uploads:
  - CV
  - Diploma
  - ID (front and back)
  - Intro video
- Preview of uploaded documents
- Progress indication

**Steps:**
1. Personal info (first name, last name, bio)
2. Location and availability
3. Specializations and languages
4. Document uploads

**Specializations:**
Anxiety, Depression, Stress, Trauma, PTSD, Relationships, Family, Addiction, Sleep, Self-esteem

**Languages:**
Arabic, French, English, Darija

**Document Upload Features:**
- File input for each document type
- Preview generation for images
- Drag-and-drop capability
- File size validation
- Error messaging

**Data Flow:**
- `POST /api/psychologist/setup` → submit onboarding
- `POST /api/credential-documents` → upload docs

---

## Admin Pages

### 18. **AdminPanel** (`AdminPanel.jsx`)
**Purpose:** Administration dashboard with user management and verification queue

**Key Features:**
- User statistics display
- User management (list, edit, delete, change role)
- Pending verification queue (credential documents review)
- Face verification checks with diagnostics
- Filtering and pagination
- Document preview in modal

**Statistics Displayed:**
- Total users
- Active sessions
- Pending verifications
- Platform metrics

**User Management:**
- User list with roles and status
- Delete user capability
- Change role option
- User search

**Review Queue:**
- Filter by status (Submitted, Approved, Rejected)
- Completeness level
- Date range filtering
- Document preview (images/video)
- Face verification diagnostics
- Action buttons (Approve/Reject/Flag)

**Filters:**
- Status dropdown
- Rejected checkbox
- Completeness selector
- Date range
- Sort options
- Search field

**Data Flows:**
- `/api/admin/stats` → dashboard statistics
- `/api/admin/users` → user list
- `/api/review-queue` (with filters and pagination)
- `/api/verify-document/:id` → face verification check
- Document asset URLs via `/api/assets/:id`

---

### 19. **AuditLog** (`AuditLog.jsx`)
**Purpose:** Monitor system activity and security events

**Key Features:**
- Paginated audit log display
- Advanced filtering
- Search capability
- Event severity levels
- Action tracking
- Target tracking (user, document, etc.)
- Correlation ID for related events

**Filters:**
- Date range (from/to)
- Action type
- Outcome (success/failure)
- Severity (info, warning, error, critical)
- Actor user ID
- Target type
- Target ID
- Correlation ID
- Text search

**Log Entry Shows:**
- Timestamp
- Actor (user who performed action)
- Action type
- Target (what was affected)
- Outcome status
- Severity indicator
- Details/description

**Data Flow:**
- `GET /api/audit-log?[filters]` → filtered log entries
- Pagination with limit/offset
- Results cached in localStorage

---

## Additional Pages

### 20. **PatientDetail** - Likely not fully implemented or similar to ProfilePages
### 21. **PatientHistory** - Session history view for patients
### 22. **PaymentConfirm** - Payment confirmation page
### 23. **Statistics** - Analytics/dashboard view
### 24. **VerifyCode** - Possible 2FA code verification
### 25. **ForgotPassword** / **ResetPassword** - Password recovery flow

---

## Chatbot Page

### 26. **Chatbot** (`Chatbot.jsx`)
**Purpose:** AI-powered therapy intake and assessment chatbot

**Key Features:**
- Multi-stage conversation (5 stages):
  1. Concern - What's bothering the patient
  2. Feelings - Emotional exploration
  3. History - Background context
  4. Impact - How it affects daily life
  5. Closing - Summary and recommendations
- AI-generated responses
- Stage-based progression
- Message history persistence
- Session state tracking
- Crisis safety resources
- Message reset capability

**Safety Features:**
- Crisis alert banner
- Emergency contact info
- Crisis resource links (phone numbers)

**Session Management:**
- Load existing message history
- Initialize chatbot with opening question
- Track completion status
- Prevent messaging when completed

**Data Flows:**
- `/api/chatbot/messages` → load history
- `/api/chat/init` → get stage and completion status
- `POST /api/chat/message` → send message
- AI response generation

**UI Elements:**
- Message bubbles (user/assistant)
- Input textarea with auto-resize
- Stage progress indicator (1-5)
- Safety banner (collapsible)
- Auto-scroll to latest message
- Loading state during response

---

## Common UI Patterns & Components

### Design System
- **Color Scheme:** Dark theme with indigo/fuchsia accents
- **Glass Effect:** Frosted glass panels with backdrop blur
- **Typography:** Large, bold headers with fine print secondary text
- **Spacing:** Consistent gaps using Tailwind scale

### Recurring Components
- **GlassPanel:** Frosted glass container (`rounded-3xl border border-white/10 bg-white/5`)
- **AuthShell:** Auth page wrapper with branding
- **StatCard:** Display metric (label + value + hint)
- **StarRating:** Visual star display (1-5) with count
- **StatusBadge:** Status indicator with color coding
- **DashboardSidebar:** Navigation sidebar
- **NotificationsDrawer:** Slide-in notifications panel

### Color Coding
- **Success/Completed:** Emerald (#10b981)
- **Warning/Pending:** Amber/Yellow (#fbbf24)
- **Info/Active:** Indigo (#6366f1)
- **Error/Canceled:** Rose (#f43f5e)
- **Neutral:** White/Gray scale

### Forms
- Input fields with rounded corners (rounded-2xl)
- Focus ring effects with accent color
- Validation feedback (error boxes in rose)
- Placeholder text in muted color
- Helper text in smaller, muted text

### Responsive Design
- Mobile-first Tailwind approach
- Grid layouts that adapt (sm:grid-cols-2, etc.)
- Touch-friendly button sizes (h-11, p-4+)
- Sidebar collapses on mobile

### Interactions
- Hover effects (brightness increase, border changes)
- Loading states (disabled buttons, spinner)
- Smooth transitions
- Auto-scroll on new messages
- Debounced search (400ms)

---

## Recommended UI Improvements

### For Better UX:
1. **HomePage:** Add skeleton loaders while fetching
2. **AdminPanel:** Implement real-time updates via WebSocket
3. **Calendar:** Add drag-to-book functionality
4. **SessionPage:** Show psychologist video stream when available
5. **Notifications:** Add toast notifications for real-time updates
6. **Dashboard:** Add data refresh button and auto-refresh
7. **Chatbot:** Show typing indicator during AI response
8. **Forms:** Add field validation feedback (real-time)
9. **MySessionHistory:** Add export to PDF capability
10. **PsychologistList:** Add filter preset chips (e.g., "Top Rated", "Nearby")

### For Better Performance:
1. Implement image lazy loading for profiles
2. Memoize psychologist list items
3. Paginate large lists (audit log, user management)
4. Cache API responses with React Query or SWR
5. Optimize map rendering for many markers
6. Debounce more search fields

---

## API Integration Notes

### Authentication
- Tokens stored in localStorage (token, refreshToken)
- Device ID tracking for session management
- Role-based route guards
- Token refresh on 401 errors (implemented in api.js)

### Real-time Features
- Socket.io for live messaging
- WebSocket for presence indicators
- Real-time notification updates

### Data Persistence
- localStorage for:
  - Auth tokens
  - User role and ID
  - Verification status
  - Filter preferences
  - Calendar last date

### Error Handling
- 401 → Auto refresh token, retry, or logout
- 400 → Display user-friendly error message
- 500 → Show generic error with retry option
- Network errors → Connection error message

---

**Document Version:** 1.0  
**Last Updated:** May 13, 2026  
**Platform:** Psych Platform - Mental Health Care Marketplace
