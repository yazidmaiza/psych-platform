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
1. **Repository Setup**: Initializing Next/React for the frontend and Express/Node.js for the backend.
2. **Database Configuration**: Provisioning MongoDB and defining the `User` schema.
3. **Authentication API**: Building `/api/auth/register` and `/api/auth/login` endpoints with Bcrypt password hashing.
4. **Client Auth Flow**: Implementing Context API/Redux for state management, secure token storage, and protected React Router routes.
5. **Basic User Interfaces**: Designing the Login, Register, and onboarding (Setup) pages using Tailwind CSS.

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
*[Placeholder for Overall Use Case Diagram]*

#### 3.4.2.2 Detailed Use Case Specifications
*[Placeholder for Detailed Use Case Specifications]*

#### 3.4.2.3 Class diagram:
*[Placeholder for Class diagram]*

#### 3.4.2.4 Sequence diagrams:
*[Placeholder for Sequence diagrams]*

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
