# Internship-Repository-One
This project is a part of my internship at highnoon.
## System Architecture & Folder Structure

This project implements Clean Architecture principles with a strict, one-directional dependency flow:

`Controller (HTTP)` ➔ `Service (Business Logic)` ➔ `Repository (Data Access)` ➔ `Prisma ORM`

### Project Structure

```text
src/
├── controllers/      # Parses HTTP requests, status codes, and formats responses
│   ├── auth.controller.ts
│   └── student.controller.ts
├── dtos/             # Data Transfer Objects and TypeScript interfaces
│   └── student.dto.ts
├── services/         # Core business and validation logic (zero req/res dependency)
│   ├── auth.service.ts
│   └── student.service.ts
├── repositories/     # Data access layer encapsulating Prisma ORM queries
│   ├── user.repository.ts
│   └── student.repository.ts
└── app-db.ts         # Application entry point and Express route declarations
