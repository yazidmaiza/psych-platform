# UC-11 / UC-12 — Audit Logging & Audit Log Query

## What is audited

The platform records security-sensitive and state-transition events such as:
- credential document upload/replacement and access/download attempts
- onboarding submit/resubmit
- admin approve/reject decisions
- review queue browsing and application view
- authentication and authorization failures

## Centralized audit service

All audit writes flow through `server/src/services/auditService.js`:
- best-effort, non-blocking: audit write failures never break the request
- standardized fields: actor, action, outcome, target references, request metadata
- sanitizes action/message to reduce log injection risk and unbounded growth

## Storage (append-only strategy)

Audit events are stored in MongoDB via `AuditEvent` (`server/src/models/AuditEvent.js`).

App-level immutability:
- Mongoose update/delete methods are blocked for `AuditEvent` (append-only).
- There are no API endpoints to modify/delete audit events.

Note: DB admins can still modify data directly. If you require stronger guarantees, enforce at the database/policy layer (RBAC, backups/WORM storage).

## Correlation IDs

`server/src/middleware/correlationMiddleware.js`:
- assigns `req.correlationId`
- returns it as `x-correlation-id`
- stored on each audit event for traceability

## Authorization auditing

Denied authentication/authorization attempts are recorded:
- `AUTH_MISSING_TOKEN`, `AUTH_INVALID_TOKEN`
- `AUTHZ_DENIED`

## Audit log query (admin-only)

Endpoints:
- `GET /api/audit-events` (paginated + filters)
- `GET /api/audit-events/:id` (full event payload)

Access control:
- `protect` + `restrictTo('admin')`
- optional admin privilege `AUDIT_VIEW` via `requireAdminPermission('AUDIT_VIEW')`
  - backward compatible: if an admin has an empty `adminPermissions[]`, access is allowed

The audit log endpoints also audit access:
- `AUDIT_LOG_LIST`
- `AUDIT_LOG_VIEW`

## Indexing

Indexes exist on `AuditEvent` to support large datasets:
- `createdAt`, `action+createdAt`, `actorUserId+createdAt`, `targetType+targetId+createdAt`, `severity+createdAt`, `outcome+createdAt`

## Admin UI

The audit log viewer is available at:
- `/admin/audit`

It supports:
- pagination
- date range filtering
- action/outcome/severity filtering
- actor/target/correlation filtering
- free text search

