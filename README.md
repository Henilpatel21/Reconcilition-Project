# Reconciliation System

A comprehensive web application for automated bank reconciliation, settlement tracking, and transaction audit management.

## Purpose

This system streamlines the reconciliation process between internal transaction records and bank statements, reducing manual effort and minimizing discrepancies. It provides real-time audit trails, settlement tracking, and intuitive data visualization.

## Technology Stack

This is a **MERN Stack** project (MongoDB, Express, React, Node.js)

**Backend**
- Node.js with Express.js
- MongoDB (NoSQL database)
- JWT authentication with bcrypt password hashing
- CORS for cross-origin request handling

**Frontend**
- React 18 with Vite
- React Router for navigation
- Axios for API requests
- Chart.js for data visualization

**Deployment**
- Backend: Render
- Frontend: Vercel

## Quick Start

### Prerequisites
- Node.js 18+ installed
- MongoDB connection string

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

The backend server will start on `http://localhost:5000` by default.

**Environment Variables** (`.env` file):
```
MONGO_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
CLIENT_URL=<frontend-url>
PORT=<port-number>
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173` by default.

**Environment Variables** (`.env.local` file):
```
VITE_API_URL=<backend-api-url>
```

## Key Features

- **Bank Statement Upload & Parsing**: Import bank statements via CSV/Excel
- **Transaction Management**: Track and manage all transactions
- **Automated Reconciliation**: Match transactions with bank statements
- **Settlement Records**: Create and monitor settlement records
- **Audit Logging**: Complete audit trail of all system activities
- **Dashboard Analytics**: Visual insights with charts and metrics


## Project Structure

```
backend/          Node.js Express API
frontend/         React Vite application
```

---


