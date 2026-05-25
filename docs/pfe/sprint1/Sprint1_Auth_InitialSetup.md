# 3 SPRINT 1: Auth & Initial Setup

## Introduction

Authentication and Initial Setup are the critical first steps in establishing the foundations of the Psych Platform. This sprint focuses on configuring the core application architecture, setting up the database, defining the user models, and implementing secure role-based access for different stakeholders (patients, psychologists, and administrators). The goal is to create a robust and scalable environment that subsequent features will build upon.

## 3.1 Sprint 1 Objective

The main objectives for Sprint 1 are:
- Establish the development environment and technology stack for both backend and frontend layers.
- Implement secure User Authentication and Authorization using JSON Web Tokens (JWT).
- Support varying access levels using Role-Based Access Control (RBAC) (Admin, Psychologist, Patient).
- Create essential database schemas using Mongoose.
- Establish foundational UI components (Login, Registration, Dashboard shells).

## 3.2 Sprint Planning 1

During sprint planning, the following core tasks were identified and assigned priority:
1. **Repository Setup**: Initializing the React frontend and Express/Node.js backend with a shared development workflow.
2. **Database Configuration**: Provisioning MongoDB and defining the `User` schema plus supporting auth/token models.
3. **Authentication API**: Building `/api/auth/register`, `/api/auth/login`, `/api/auth/verify-email`, and `/api/auth/profile` with bcrypt password hashing and JWT issuance.
4. **Client Auth Flow**: Implementing localStorage token handling, role-based routing, and protected React Router routes.
5. **Basic User Interfaces**: Designing the Login, Register, email verification, password recovery, and onboarding pages using Tailwind CSS.

## 3.3 Sprint Backlog 1

| ID | Title | Description | Priority | Status |
|---|---|---|---|---|
| #1.1 | Project Initialization | Setup client and server package.json, install base dependencies | High | Done |
| #1.2 | Database Connection | Connect backend to MongoDB instance via Mongoose | High | Done |
| #1.3 | User Model | Define User schema with role (patient/psychologist/admin) and bcrypt hooks | High | Done |
| #1.4 | Auth Endpoints | Create Register, Login, and Me endpoints | High | Done |
| #1.5 | Frontend Auth State | Handle JWT in client context & axios interceptors | High | Done |
| #1.6 | Login/Register UI | Create initial Tailwind-based login and registration forms | Medium | Done |
| #1.7 | Role-based Routing | Protect dashboard routes depending on user role | High | Done |

## 3.4 Sprint Execution

### 3.4.1 Analysis

#### 3.4.1.1 User Story Deconstruction and Requirements Elicitation

- **As a prospective user (patient/psychologist)**, I want to be able to create an account using my email and a secure password so that I can access the platform.
- **As a registered user**, I want to securely log in to the system and be redirected to an interface appropriate for my role, so I can start using the services.
- **As an administrator**, I need to ensure that the platform data is secure and that passwords are encrypted to prevent data breaches.

#### 3.4.1.2 Core Architectural and System Design Analysis

The application adopts a standard **Client-Server Architecture** with a separation of concerns:
- **Presentation Layer (Frontend)**: React application responsible for rendering UI components, handling user input, and maintaining client-side session state.
- **Application Layer (Backend)**: Express Server serving RESTful API routes, handling business logic (token generation, hashing), and request validation.
- **Data Access Layer (Database)**: MongoDB serving as the NoSQL document database, seamlessly communicating with the backend via Mongoose ODMs.

#### 3.4.1.3 Technology Stack Evaluation and Selection

Based on the project's requirement for a scalable, non-blocking, and rapid development framework, the MERN stack alongside tailored libraries was chosen:
- **Backend Environment**: Node.js + Express (`express`, `mongoose`, `cors`, `helmet` for security).
- **Authentication**: `jsonwebtoken` for issuing stateless session tokens, `bcryptjs` for secure asynchronous password hashing.
- **Frontend Environment**: React (`react`, `react-dom`, `react-router-dom`), Bootstrapped via Create React App.
- **UI Styling**: `tailwindcss` chosen for utility-first styling, enabling rapid, responsive component generation without writing custom CSS.

### 3.4.2 Design (UML diagrams)

#### 3.4.2.1 Overall Use Case Diagram for Sprint 1
The use case for Sprint 1 centers on account creation, login, email verification, route protection, and role-based navigation across patient, psychologist, and admin portals.

#### 3.4.2.2 Detailed Use Case Specifications
Key scenarios include account registration, credential verification, login, token persistence, and redirecting users to the appropriate dashboard or setup flow based on role.

#### 3.4.2.3 Class diagram:
The initial class model includes `User`, token-related auth models, and the role-specific profile entities used to separate authentication from domain data.

#### 3.4.2.4 Sequence diagrams:
Typical sequences cover register → verify email → login → route guard evaluation → dashboard navigation.

### 3.4.3 Tests and Deployment

#### 3.4.3.1 Unit Testing Strategy and Scope

- **Backend Models**: Tested schema constraints (unique emails, required roles) and the Bcrypt pre-save hashing middleware.
- **Auth Controller Logic**: Validated password comparisons and JWT generation signatures.

#### 3.4.3.2 Integration Testing Across Components

- Tested the communication between the React Login/Register forms and the Express API.
- Verified that invalid credentials return standard `400 Bad Request` errors and are appropriately handled and displayed by the client UI.

#### 3.4.3.3 Manual End-to-End Scenario Validation

- **Scenario 1**: Register a new patient account -> Login -> Verify token is stored in local storage -> Access patient dashboard.
- **Scenario 2**: Register a new psychologist -> Ensure they cannot access admin panels -> Route to Psychologist Setup flow.
- **Scenario 3**: Attempt to access protected pages without a valid token to verify route guards trigger a redirect to `/login`.

#### 3.4.3.4 Deployment for Continuous Review

The codebase utilized nodemon for hot-reloading in the development environment. Core `.env` secrets alongside structural setup instructions were documented in internal readmes to ensure continuous sync between frontend and backend developers.

## 3.5 Sprint Review and Retrospective

**Review**:
The sprint was highly successful. The MERN foundation was established, and the robust authentication flow securely manages three distinct user types.
**Retrospective**:
- **What went well**: The decision to use `bcryptjs` and `jsonwebtoken` streamlined the authentication flow. Role differentiation at the schema level provides significant flexibility.
- **What could be improved**: Moving forward, adding stricter validation middlewares (e.g., `express-validator`) for email formats and password strength will improve security further.
- **Action Items**: Progress towards the Psychologist profile setups and Dashboard visualizations in the next sprint, building on this Auth bedrock.

## Conclusion

Sprint 1 successfully delivered the backbone of the application. With the authentication infrastructure firmly in place, user identities are securely managed, paving the way for personalized experiences, specialized dashboards, and complex clinical logic in the forthcoming sprints.

## 3.6 Technical Implementation and Architectural Rationale

### 3.6.1 Backend Architecture and Logic
- The authentication subsystem is implemented in Node.js with Express following a modular controller-service-repository pattern. Controllers handle HTTP concerns and validation; services encapsulate business logic (token creation, password hashing, role assignment); repositories isolate Mongoose queries to keep data access testable and replaceable.
- Passwords are hashed using `bcryptjs` with a configurable work factor stored in environment variables. The pre-save Mongoose middleware enforces hashing and the model validates unique email constraints at the database layer to avoid race conditions.
- JWTs are issued using `jsonwebtoken` with separated signing keys for access and refresh tokens. Access tokens are short-lived (minutes to hours) and used for API authorization; refresh tokens are long-lived and stored hashed in the DB to allow revocation. Token rotation is supported to mitigate replay attacks.

### 3.6.2 Frontend Architecture
- The React client follows a composition and context pattern: `AuthContext` centralizes token storage and refresh flows, axios instances include interceptors that transparently attach access tokens and perform automatic token refresh when receiving `401` responses.
- Protected routes are implemented via `ProtectedRoute` components that validate role membership prior to rendering. Role-based UI segments are separated into dedicated components to reduce permission-related logic duplication.

### 3.6.3 API Contract and Interactions
- Key endpoints: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, and `/api/auth/me` follow RESTful semantics. Payloads are typed and validated using a validation layer (e.g., `express-validator` or Joi) to ensure consistent error handling.
- Session-less operations (email verification, password reset) use signed, time-limited tokens embedded in secure email links. All endpoints enforce rate limiting for safety against credential stuffing and brute force.

### 3.6.4 Database Model and Relationships
- The `User` schema contains core identity fields (`email`, `passwordHash`, `roles`, `isActive`, `profileRef`). Roles are represented as an enum and stored as a small array on the user document for efficient RBAC checks.
- Refresh tokens and device metadata are stored in a separate collection to allow per-device revocation and auditing. Audit events for authentication actions (login, logout, token refresh, failed login) are recorded to an `AuthAudit` collection with minimal PII.

### 3.6.5 Security and Privacy Considerations
- Transport-level security requires HTTPS and secure cookie flags when cookies are used for refresh token storage. CORS is restricted to the client origin.
- Secrets (JWT signing keys, SMTP credentials) are injected from a secrets manager or environment variables; no secrets are committed to the repository.
- Data minimization: only fields required for authentication are stored in the `User` collection; sensitive fields are encrypted or hashed and access to them is logged.

### 3.6.6 Scalability and Maintainability
- The stateless nature of JWT-based access combined with a small state store for refresh tokens and audits enables horizontal scaling of API servers behind a load balancer. Sticky sessions are avoided.
- Separation into controller/service/repository layers makes unit testing straightforward and reduces cognitive load for future contributors.

### 3.6.7 Notes on Clinical Safety and Ethics
- Authentication is the gatekeeper for all clinical data. Design decisions emphasize minimal exposure of personal health information (PHI) in logs and enforce strict RBAC checks for endpoints that return clinical artifacts.

## 3.7 Suggested Next Engineering Steps
- Harden input validation with `express-validator` for all public endpoints.
- Add a short security review checklist to the README for deploy-time checks (CSP, secure cookies, correct TLS configuration).
- Implement a monitoring/dashboard for authentication metrics (failed logins, token errors) to detect abuse early.
