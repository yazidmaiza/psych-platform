| Use Case | Actor(s) | Description | Preconditions | Main Flow | Alternate Flow |
|----------|----------|-------------|---------------|-----------|----------------|
| Register Account | Patient, Psychologist | User creates an account with email and password | None | 1. User submits registration form<br>2. System validates and creates user<br>3. User receives confirmation | 1a. Email already exists: Show error |
| Login | All | User logs in with credentials | User registered | 1. User submits login form<br>2. System validates credentials<br>3. User receives JWT and is redirected | 2a. Invalid credentials: Show error |
| Access Dashboard | All | User accesses dashboard based on role | User logged in | 1. User accesses dashboard<br>2. System verifies JWT<br>3. Dashboard is shown | 2a. Invalid/expired JWT: Redirect to login |
| Setup Profile | Psychologist | Psychologist completes onboarding | Psychologist logged in | 1. Psychologist accesses setup<br>2. System saves profile data | |
| Admin Panel | Admin | Admin accesses admin dashboard | Admin logged in | 1. Admin accesses panel<br>2. System verifies admin role<br>3. Admin dashboard is shown | 2a. Not admin: Access denied |
