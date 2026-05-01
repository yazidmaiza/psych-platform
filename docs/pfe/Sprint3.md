# Introduction
Sprint 3 addresses **patient engagement** by implementing the core capabilities that allow patients to find psychologists, evaluate options, manage schedules, and complete bookings from request to completion. The sprint focuses on search and discovery (including geospatial search), calendar management, and the full booking lifecycle with clear status tracking.

This document provides Sprint 3 objectives, planning, backlog, execution approach, analysis, UML-oriented design descriptions (textual), testing, deployment, and sprint review/retrospective elements in a format suitable for a PFE/project report.

# Sprint3Objective
The objective of Sprint 3 is to deliver a complete patient engagement workflow that:

- Enables **search & discovery** of psychologists using categories and filters.
- Supports **geospatial search** to rank and display nearby psychologists and optionally render map-based results.
- Provides **calendar management** for psychologist availability and patient scheduling.
- Implements a **full booking lifecycle**: request → confirm → cancel → complete.
- Ensures secure access control, consistent state transitions, and auditable booking events.

Success criteria:
- Patients can search with filters and obtain relevant, paginated results.
- Patients can request bookings based on real availability.
- Psychologists can manage availability and confirm/decline booking requests.
- Bookings progress through well-defined states and reflect cancellations and completion correctly.

# SprintPlanning3
Sprint planning assumptions:
- Sprint duration: 2 weeks (adjustable).
- Dependencies: Sprint 2 delivered onboarding and admin approval; only **Approved/Active** psychologists are discoverable/bookable.
- Roles involved: Product Owner, Frontend Developer(s), Backend Developer(s), QA, and a domain reviewer for scheduling rules.

Planned deliverables:
- Search & discovery UI with filtering and sorting.
- Geospatial search API and optional map visualization.
- Availability management (psychologist calendar rules, time slots, exceptions).
- Booking APIs and UI supporting request, confirmation, cancellation, and completion.
- Notifications and near real-time updates (where applicable) for booking status changes.

# SprintBacklog3
## User Stories (Search & Discovery)
1. **US-3.1: Browse and filter psychologists**
   - As a patient, I want to browse psychologists and filter results by category so that I can find the most suitable professional.
   - Acceptance criteria:
     - Filters include specialization/category, language, price range (if applicable), rating/reviews (if available), and availability window.
     - Results are paginated and sortable (e.g., relevance, distance, rating).
     - Only approved/active psychologists appear in results.

2. **US-3.2: View psychologist profile summary**
   - As a patient, I want to open a psychologist’s profile summary so that I can decide whether to book.
   - Acceptance criteria:
     - Profile shows specialization, bio, languages, experience, and general availability indicators.
     - Personal sensitive data is not exposed unnecessarily.

## User Stories (Geospatial Search)
3. **US-3.3: Location-based search results**
   - As a patient, I want to see psychologists near my location so that I can choose nearby options (for in-person or time-zone alignment).
   - Acceptance criteria:
     - Patient can provide location (GPS-based or manually entered).
     - Results display distance and are ranked by proximity when enabled.
     - System handles missing/denied location permissions gracefully.

4. **US-3.4: Map-based discovery (optional UI)**
   - As a patient, I want to view results on a map so that I can explore nearby psychologists visually.
   - Acceptance criteria:
     - Map pins match list results and update with filter changes.
     - Selecting a pin highlights the corresponding psychologist card.

## User Stories (Calendar Management)
5. **US-3.5: Psychologist manages availability**
   - As a psychologist, I want to define my weekly availability and exceptions so that bookings reflect my real schedule.
   - Acceptance criteria:
     - Psychologist can set recurring availability (e.g., Mon–Fri 09:00–17:00).
     - Psychologist can add exceptions (days off, blocked times).
     - Changes take effect for future booking queries.

6. **US-3.6: Patient views available time slots**
   - As a patient, I want to view available time slots for a chosen psychologist so that I can request a booking.
   - Acceptance criteria:
     - Slots are shown in the patient’s time zone (or clearly labeled).
     - Unavailable/conflicting slots are not selectable.
     - Slot fetching is performant for a configurable date range.

## User Stories (Booking Lifecycle)
7. **US-3.7: Patient requests a booking**
   - As a patient, I want to request a session at a selected time so that I can schedule an appointment.
   - Acceptance criteria:
     - System checks slot availability and prevents double booking.
     - Booking is created with status `REQUESTED` and visible in both dashboards.

8. **US-3.8: Psychologist confirms or declines**
   - As a psychologist, I want to confirm or decline booking requests so that I can control my schedule.
   - Acceptance criteria:
     - Confirm transitions to `CONFIRMED` and locks the slot.
     - Decline transitions to `DECLINED` with an optional reason.

9. **US-3.9: Cancellation by patient or psychologist**
   - As a patient/psychologist, I want to cancel a booking so that the schedule remains accurate.
   - Acceptance criteria:
     - Cancellation transitions to `CANCELLED` with actor identity and timestamp.
     - Cancellation rules enforce policy (e.g., disallow cancel after start time; configurable grace periods).

10. **US-3.10: Mark booking as completed**
   - As the system, I want confirmed sessions to be marked completed so that history and reporting are accurate.
   - Acceptance criteria:
     - Booking transitions to `COMPLETED` after session time ends (manual or automated).
     - Completion is auditable and visible in history.

Engineering tasks:
- Implement search indexing strategy (DB query optimization and/or dedicated search engine).
- Implement geospatial data model and proximity queries.
- Implement scheduling model with availability rules and slot generation.
- Implement booking state machine and conflict prevention.
- Add notifications and real-time updates (if enabled).

# SprintExecution
Execution strategy:
- **Incremental increments:** deliver search filters first, then availability/slots, then booking lifecycle, and finally real-time updates and map UX improvements.
- **State-driven design:** booking and availability are implemented with explicit states, transition guards, and idempotent endpoints.
- **Risk controls:** treat scheduling conflicts, time zones, and concurrency as first-class concerns.

Definition of Done (DoD):
- Meets acceptance criteria for selected stories.
- API endpoints are documented and validated with tests.
- Authorization enforced (patient vs psychologist vs admin).
- Booking transitions are auditable (event logs).
- Deployed to a review environment for functional validation.

# Analysis
Sprint 3 introduces user-facing workflows that depend on consistent data modeling and precise time handling. The analysis decomposes requirements into functional behaviors, constraints, and integration points.

## UserStoryDeconstructionandRequirementsElicitation
### Functional Requirements
**Search & discovery**
- Filter psychologists by specialization/category, languages, price, rating (if available), and availability window.
- Sorting by relevance and distance; consistent pagination.
- Visibility rules: only `Active` psychologists can be searched/booked.

**Geospatial search**
- Store psychologist location (approximate practice location or service region; optional remote-only mode).
- Compute distance between patient location and psychologist location.
- Provide map-ready result payload (coordinates, display fields).

**Calendar management**
- Model availability as recurring weekly rules plus exceptions.
- Generate available time slots for a date range, respecting:
  - time zone conversions,
  - booking duration (e.g., 30/45/60 minutes),
  - blocked periods,
  - existing confirmed bookings.

**Booking lifecycle**
- Booking creation (requested) from a selected slot.
- Psychologist confirmation/decline and cancellation paths.
- Completion logic (manual confirmation or scheduled job post-session).
- Notifications and visibility in dashboards for both actors.

### Non-Functional Requirements
- **Correctness:** no double booking; strict transition guards; reliable time-zone handling.
- **Performance:** search queries optimized; slot generation efficient and cacheable for short ranges.
- **Concurrency safety:** bookings created under race conditions must be prevented using transactions/locks or unique constraints.
- **Security and privacy:** minimal location exposure; RBAC; no unauthorized access to calendars/bookings.
- **Observability:** logs and metrics for search latency, slot generation time, booking conflicts, and notification delivery.

### Key Data Considerations
- Time zone normalization: store timestamps in UTC; store user time zone for display.
- Geospatial precision: use approximate coordinates to reduce privacy risks (configurable).
- Booking conflicts: enforce uniqueness of (psychologistId, startTime, endTime) for confirmed states.

## TechnologyStackandIntegrationHighlights
Key integration highlights:
- **Frontend ↔ Backend APIs**
  - Search endpoints with filters, pagination, and sorting.
  - Availability endpoints that return generated slots for a date range.
  - Booking endpoints for request/confirm/cancel/complete.

- **Database and indexing**
  - Relational schema for bookings and availability.
  - Indexes for search filters (specialization, languages, active status).
  - Geospatial indexing strategy:
    - Option A: PostGIS / spatial types (preferred if available).
    - Option B: store lat/lng and use bounding-box + Haversine distance in queries.

- **Maps integration (if UI includes maps)**
  - Map provider SDK (e.g., Google Maps, Mapbox, OpenStreetMap-based).
  - Backend returns coordinates and display-safe metadata for pins.

- **Real-time updates (optional but beneficial)**
  - WebSocket/SSE for booking status changes and calendar updates.
  - Fallback: polling with ETags or “updatedSince” queries.

- **Background jobs**
  - Mark sessions completed automatically after end time.
  - Send notification reminders (optional).

## AnalysisConclusion
Sprint 3 requires a scheduling-aware design that connects discovery to booking without inconsistencies. The core technical challenges are (1) accurate time handling, (2) concurrency-safe booking, and (3) performant filtering with geospatial ranking. A state machine approach with clear invariants and strong authorization provides a robust foundation for patient engagement features.

# Design (UML diagrams)
This section provides textual UML descriptions suitable for a report when visual diagrams are not embedded.

## OverallUseCaseDiagramforSprint3
Actors:
- **Patient**
- **Psychologist**
- **Maps/Geocoding Service (external)**
- **Notification Service (external/internal)**

Main use cases:
- Patient:
  - Search Psychologists
  - Filter and Sort Results
  - View Profile Details
  - Provide Location / Choose Area
  - View Available Time Slots
  - Request Booking
  - Cancel Booking
  - View Booking History
- Psychologist:
  - Manage Availability (recurrence + exceptions)
  - View Booking Requests
  - Confirm/Decline Booking
  - Cancel Booking
  - View Calendar
- External services:
  - Resolve Location (geocoding)
  - Send Notifications (status change alerts)

Relationships (textual):
- “Search Psychologists” includes “Apply Filters” and may include “Rank by Distance”.
- “Request Booking” includes “Validate Slot Availability”.
- “Confirm Booking” includes “Lock Slot” and triggers “Send Notification”.

## DetailedUseCaseSpecifications
### Use Case: Search & Filter Psychologists
- **Primary actor:** Patient
- **Preconditions:** Patient is authenticated (or guest mode is explicitly allowed)
- **Main flow:**
  1. Patient enters keywords or selects categories.
  2. Patient applies filters (language, specialization, price, rating, availability window).
  3. System returns paginated results with sorting.
  4. Patient opens a profile for more details.
- **Alternate flows:**
  - No results: system proposes relaxing filters and shows closest matches.
  - Unauthenticated: system restricts sensitive details if guest browsing is enabled.
- **Postconditions:** Search activity may be logged (privacy-aware analytics).

### Use Case: Geospatial Search
- **Primary actor:** Patient
- **Preconditions:** Patient provides location (GPS permission or manual address)
- **Main flow:**
  1. Patient shares location or selects an area.
  2. System normalizes location to coordinates (optional geocoding).
  3. System retrieves psychologists and computes distance ranking.
  4. System returns list + optional map pins.
- **Alternate flows:**
  - Permission denied: system falls back to manual location entry or non-distance sorting.
  - Geocoding failure: system uses last known location or displays a retry message.
- **Postconditions:** Distance shown is approximate; privacy controls applied.

### Use Case: Manage Availability
- **Primary actor:** Psychologist
- **Preconditions:** Psychologist is active/approved; authenticated
- **Main flow:**
  1. Psychologist defines weekly recurring availability intervals.
  2. Psychologist adds exceptions (blocked days/times).
  3. System stores rules and regenerates derived slot cache (if implemented).
  4. Patients querying slots see updated availability.
- **Alternate flows:**
  - Conflict with existing confirmed bookings: system prevents blocking already confirmed sessions (or requires cancellation first).
- **Postconditions:** Availability rules persisted; audit log updated.

### Use Case: Request Booking
- **Primary actor:** Patient
- **Preconditions:** Patient authenticated; psychologist active; slot visible and within valid range
- **Main flow:**
  1. Patient selects a time slot and submits a booking request.
  2. System validates slot availability and conflict constraints transactionally.
  3. Booking is created with status `REQUESTED`.
  4. Psychologist is notified; booking appears in dashboards.
- **Alternate flows:**
  - Slot taken concurrently: system returns a conflict response and suggests alternative slots.
- **Postconditions:** Booking exists; audit log records creation.

### Use Case: Confirm/Decline Booking
- **Primary actor:** Psychologist
- **Preconditions:** Booking status is `REQUESTED`
- **Main flow:**
  1. Psychologist reviews request details.
  2. Psychologist confirms or declines.
  3. System updates status to `CONFIRMED` or `DECLINED` and records decision metadata.
  4. Patient is notified and calendar views update.
- **Alternate flows:**
  - Expired request: system blocks confirmation if session time has passed; status becomes `EXPIRED` (optional).
- **Postconditions:** Booking status updated; slot locked when confirmed.

### Use Case: Cancel Booking
- **Primary actor:** Patient or Psychologist
- **Preconditions:** Booking exists and cancellation policy allows action
- **Main flow:**
  1. Actor initiates cancellation.
  2. System validates policy (time window, role permissions).
  3. Status becomes `CANCELLED`; reason may be captured.
  4. Notifications sent; slot is released if appropriate.
- **Postconditions:** Cancellation recorded and auditable.

### Use Case: Complete Booking
- **Primary actor:** System (or Psychologist/Admin depending on policy)
- **Preconditions:** Booking is `CONFIRMED` and end time passed
- **Main flow:**
  1. Scheduled job checks confirmed bookings after end time.
  2. System marks status as `COMPLETED`.
  3. System triggers optional post-session actions (feedback request, summary entry).
- **Postconditions:** Booking history updated; completion auditable.

## ClassDiagram
Classes (textual) and responsibilities:
- **Psychologist**
  - Attributes: id, isActive, profileSummary, location (optional), timeZone
  - Responsibilities: provides availability and receives bookings

- **Patient**
  - Attributes: id, preferences (language, categories), timeZone
  - Responsibilities: searches and requests bookings

- **SpecializationCategory**
  - Attributes: id, name
  - Responsibilities: classifies psychologists for discovery

- **GeoLocation**
  - Attributes: lat, lng, accuracyLevel, updatedAt
  - Responsibilities: stores approximate location for search ranking

- **AvailabilityRule**
  - Attributes: id, psychologistId, dayOfWeek, startTimeLocal, endTimeLocal, timeZone, isActive
  - Responsibilities: recurring weekly availability intervals

- **AvailabilityException**
  - Attributes: id, psychologistId, date, startTimeLocal, endTimeLocal, type (BLOCK/OPEN)
  - Responsibilities: override or refine availability rules for specific dates

- **TimeSlot**
  - Attributes: psychologistId, startAtUtc, endAtUtc, status (FREE/HELD)
  - Responsibilities: derived representation of availability for booking windows (may be computed, cached, or virtual)

- **Booking**
  - Attributes: id, patientId, psychologistId, startAtUtc, endAtUtc, status, createdAt, updatedAt
  - Responsibilities: central lifecycle entity for appointments

- **BookingEvent**
  - Attributes: id, bookingId, actorId, actorRole, eventType, reason, createdAt
  - Responsibilities: auditable history of lifecycle changes

Key associations (textual):
- Psychologist 1..* AvailabilityRule
- Psychologist 0..* AvailabilityException
- Psychologist 0..* Booking
- Patient 0..* Booking
- Booking 1..* BookingEvent
- Category many-to-many with Psychologist (via join entity)

## SequenceDiagrams
### Sequence: Search with Filters and Pagination
Participants: Patient UI → Backend API → Database (and optional Search Index)
1. UI submits search query with filters and pagination parameters.
2. Backend validates filters and builds query (or queries search index).
3. Database returns matching psychologists (restricted to active).
4. Backend returns paginated results and metadata (total, next cursor/page).

### Sequence: Geospatial Search (Distance Ranking)
Participants: Patient UI → Backend API → Geocoding/Maps Service (optional) → Database
1. UI sends location (coordinates or address).
2. Backend resolves address to coordinates if needed.
3. Backend queries database using spatial strategy and computes distances.
4. Backend returns results with approximate distance and optional map pin payload.

### Sequence: Availability Query and Slot Generation
Participants: Patient UI → Backend API → Database → Slot Generator (service)
1. UI requests available slots for psychologist within a date range.
2. Backend loads availability rules, exceptions, and existing confirmed bookings.
3. Slot generator produces available slots in UTC and applies policy constraints.
4. Backend returns slots formatted for patient time zone display.

### Sequence: Booking Request → Confirmation
Participants: Patient UI → Backend API → Database → Notification Service → Psychologist UI
1. Patient requests booking for selected slot.
2. Backend opens a transaction, checks conflicts, creates booking as `REQUESTED`, writes BookingEvent.
3. Backend sends notification to psychologist.
4. Psychologist confirms; backend transitions to `CONFIRMED`, locks slot, writes BookingEvent.
5. Backend notifies patient and pushes real-time update (if enabled).

### Sequence: Cancellation and Slot Release
Participants: Actor UI → Backend API → Database → Notification Service
1. Patient or psychologist sends cancel request.
2. Backend validates cancellation policy and role permission.
3. Backend transitions booking to `CANCELLED`, writes BookingEvent, releases slot if applicable.
4. Backend notifies the other actor and updates dashboards in near real-time.

# TestsandDeployment
Sprint 3 touches search correctness, geospatial ranking, time handling, and booking state safety. Testing must prioritize concurrency, time zone consistency, and lifecycle invariants.

## UnitTestingStrategyandScope
Unit test scope:
- Filter parsing and validation (categories, language, ranges).
- Geospatial calculations (Haversine distance; bounding logic) and privacy constraints (rounding/approximation).
- Slot generation:
  - recurring rules,
  - exceptions,
  - time-zone conversions,
  - exclusion of confirmed bookings.
- Booking state machine transition guards:
  - REQUESTED → CONFIRMED/DECLINED/CANCELLED
  - CONFIRMED → CANCELLED/COMPLETED
  - blocks for invalid transitions.
- Cancellation policy rules and edge cases around time boundaries.

External services are mocked: maps/geocoding, notifications, and optional real-time gateways.

## IntegrationTestingAcrossComponents
Integration test coverage:
- Search endpoint behavior:
  - pagination stability,
  - filter correctness,
  - only active psychologists returned.
- Geospatial search behavior:
  - distance sorting,
  - missing location fallback.
- Availability-to-booking integration:
  - slot listing,
  - booking request consumes slot and prevents duplicates.
- Booking lifecycle endpoints:
  - request, confirm, decline, cancel, complete.
- Real-time updates (if present):
  - status change broadcasts to correct users only.

## ManualEnd-to-EndScenarioValidation
Manual validation scenarios:
1. Patient searches by specialization and language; verifies pagination and sorting.
2. Patient enables location; verifies results are distance-ranked and distances displayed reasonably.
3. Patient opens profile and checks available slots for the next 7–14 days.
4. Patient requests booking; psychologist confirms; both see `CONFIRMED`.
5. Patient cancels within allowed window; both see `CANCELLED` and slot reappears.
6. Psychologist blocks availability; patient can no longer request that time.
7. Concurrency test: two patients attempt the same slot; only one booking succeeds.

## DeploymentforContinuousReview
Deployment approach:
- Deploy search and booking features to a staging/review environment with feature flags:
  - map UI toggle,
  - real-time updates toggle.
- Observability targets:
  - search latency and error rates,
  - slot generation latency,
  - booking conflict rate,
  - notification delivery success.
- Provide test accounts with different time zones to validate scheduling behavior.

# SprintReviewandRetrospective
Sprint review demonstration plan:
- Search with filters and categories; show active-only visibility rule.
- Location-based ranking; demonstrate map/list synchronization if available.
- Availability configuration by psychologist; patient slot view and booking request.
- Booking lifecycle demonstration: request → confirm → cancel → complete (manual/automated).

Retrospective prompts:
- Were time-zone assumptions clearly documented and tested?
- Did the team adequately handle concurrency and conflict prevention?
- Did search filtering meet expected relevance and performance?
- Are real-time updates worth expanding or is polling sufficient?

# Conclusion
Sprint 3 delivers the patient engagement foundation for PsychPlatform by connecting discovery, scheduling, and bookings into a cohesive workflow. The sprint emphasizes correctness in time handling, safety in lifecycle transitions, and performance in search and geospatial ranking, enabling patients to find psychologists and complete bookings reliably and transparently.

