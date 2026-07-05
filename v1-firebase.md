# QueueTag V1 (Firebase Implementation) Documentation

This document serves as the comprehensive spec sheet for the current **QueueTag (Firebase implementation)**. It details the system architecture, database models, security rules, services, API endpoints, and critical logic to ensure a seamless migration to **Supabase (PostgreSQL)**.

---

## 1. System Architecture

The application is structured as a Next.js 16 (App Router) web application. The frontend communicates with Firebase services directly using the client SDK, while serverless API routes handle transactional logic, verification, and automated background jobs.

```mermaid
graph TD
  User(Walk-in / Booking Client) -->|Public Web Router| NextApp[Next.js App Router Pages]
  Staff(Staff Member) -->|Authenticated Workspace| NextApp
  Admin(Admin Console) -->|Branded Dashboard| NextApp

  NextApp -->|Firebase Client SDK / Live Listeners| Firestore[(Firestore DB)]
  NextApp -->|Firebase Client Auth| FirebaseAuth[Firebase Auth]

  NextApp -->|JSON Requests| APIRoutes[Next.js Serverless API Routes]
  APIRoutes -->|Firebase Admin/Server SDK| Firestore
  APIRoutes -->|SMS Client| Twilio[Twilio SMS Integration]

  Cron[Vercel Cron Service] -->|Secured GET request| AutoCancelAPI[/api/cron/auto-cancel]
  AutoCancelAPI -->|Write Batch| Firestore
```

### Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **State Management**: Zustand
- **Database / Real-Time**: Firebase Firestore
- **Authentication**: Firebase Client Auth (Supports Email/Password for businesses/staff and anonymous sessions for walk-in checking)
- **Styling**: Vanilla CSS & Tailwind CSS
- **Notifications**: Simulated Twilio SMS (via helper methods)

---

## 2. Database Schema (Firestore Collections)

Firestore is a document-oriented database. Below is the structure of the Collections, along with document schema formats and type definitions.

### 2.1. `businesses`
*Stores white-label branding, metadata, operating hours, and services configuration for enterprise workspaces.*
- **Document ID**: Equal to the Business Owner's Firebase Auth `uid`.
- **Fields**:
  - `businessName` (string): The enterprise display name.
  - `businessCategory` (string): E.g., `'Retail'`, `'Clinic'`, `'Salon'`.
  - `email` (string): Primary business contact email.
  - `creationDate` (string, ISO Timestamp)
  - `logoUrl` (string, optional): Storefront branding image.
  - `primaryColor` (string, optional): Custom theme color (e.g. Hex code).
  - `address` (string, optional)
  - `publicPhone` (string, optional)
  - `publicEmail` (string, optional)
  - `requirePhoneNumber` (boolean, optional)
  - `enableSmsAlerts` (boolean, optional)
  - `appointmentsEnabled` (boolean, default: `false`)
  - `bookingSlug` (string, optional): Custom unique slug for booking page routing.
  - `operatingHours` (map): Weekly operating times.
    ```json
    {
      "monday": { "isOpen": true, "openTime": "09:00", "closeTime": "17:00", "breaks": [] },
      ...
    }
    ```
  - `services` (array of maps): Services provided by the business.
    ```json
    [
      { "id": "service-uuid", "name": "Consultation", "durationMinutes": 30 }
    ]
    ```
  - `globalAnnouncement` (string, optional): Broadcast notice visible business-wide.

### 2.2. `queues`
*Tracks live active virtual queues, configuration parameters, and wait times.*
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `businessId` / `locationId` (string): Reference to the parent `businesses` ID.
  - `name` (string): Queue name (e.g., `'General Queue'`).
  - `specialty` (string, default: `'General Physician'`)
  - `role` (string, optional): Custom role associated with this queue.
  - `status` (string): Current queue state (`'live'` | `'paused'`).
  - `estimatedResumeTime` (string, optional): ISO timestamp if queue is paused.
  - `pauseStartedAt` (string, optional): ISO timestamp when the pause was initiated.
  - `isHalted` (boolean, default: `false`): Restricts walk-ins from joining.
  - `isAppointmentEnabled` (boolean, default: `false`)
  - `workingHours` (string, e.g., `'9:00 AM - 6:00 PM'`)
  - `averageWaitTimeMin` (number, default: `15`): Base estimated time per patient.
  - `totalServedToday` (number, default: `0`): Aggregated count of served tokens.
  - `currentToken` (number, default: `0`): Current token number being called.
  - `lastAssignedToken` (number, default: `0`): Highest token number issued.
  - `waitingCount` (number, default: `0`): Number of active tickets currently in line.
  - `currentAnnouncement` (string, optional): Broadcast notice specific to this queue.
  - `lastCalledPatient` (map, optional): Data of the ticket currently or last summoned:
    ```json
    {
      "id": "entry-id",
      "customerName": "Customer Name",
      "tokenNumber": 4,
      "phoneNumber": "+1234567890",
      "calledAt": "ISO Timestamp",
      "status": "served" | "skipped" | "completed" | "no-show",
      "recalledCount": 1,
      "updatedAt": "ISO Timestamp"
    }
    ```
  - `entries` (array of maps): The active queue waitlist, sorted sequentially by token number.
    ```json
    [
      {
        "id": "entry-uuid",
        "tokenNumber": 5,
        "customerName": "Jane Doe",
        "phoneNumber": "+1234567890",
        "joinedAt": "ISO Timestamp",
        "status": "waiting" | "next" | "serving",
        "isAppointment": false,
        "appointmentId": "appointment-uuid-if-any"
      }
    ]
    ```

### 2.3. `appointments`
*Stores pre-scheduled customer bookings.*
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `workspaceId` (string): Reference to the `businesses` ID.
  - `customerId` (string, optional)
  - `customerName` (string)
  - `customerPhone` (string)
  - `date` (string, format: `YYYY-MM-DD`)
  - `startTime` (string, format: `HH:MM`)
  - `endTime` (string, format: `HH:MM`)
  - `status` (string): `'scheduled'` | `'arrived'` | `'completed'` | `'cancelled'`.
  - `cancellationReason` (string, optional)
  - `cancellationSmsSent` (boolean, default: `false`)

### 2.4. `followUps`
*Details post-care instructions or scheduling targets requested by staff.*
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `workspaceId` (string): Reference to `businesses` ID.
  - `customerId` (string): Historical customer identifier.
  - `customerName` (string)
  - `customerPhone` (string)
  - `followUpDate` (string, format: `YYYY-MM-DD`)
  - `reason` (string): Context/notes regarding follow-up.
  - `createdAt` (string, ISO Timestamp)
  - `status` (string, default: `'pending'`)

### 2.5. `customers`
*The CRM customer contact ledger.*
- **Document ID**: Historical customer entry-id (or client device ID).
- **Fields**:
  - `id` (string)
  - `name` (string)
  - `phone` (string)
  - `queueId` (string)
  - `queueName` (string)
  - `tokenNumber` (number)
  - `status` (string): `'Waiting'` | `'Served'` | `'Skipped'` | `'Completed'` | `'No-Show'`.
  - `joinedAt` (string, ISO Timestamp)
  - `completedAt` (string, ISO Timestamp, optional)
  - `waitTimeMin` (number, optional)
  - `businessId` (string)
  - `date` (string, format: `YYYY-MM-DD`, optional)

### 2.6. `staff`
*Stores profiles for authorized staff users.*
- **Document ID**: Equal to the Staff Member's Firebase Auth `uid`.
- **Fields**:
  - `name` (string)
  - `email` (string)
  - `businessId` (string): Reference to the `businesses` ID.
  - `assignedQueueId` / `queueId` (string): Reference to the `queues` ID they manage.

### 2.7. `staffInvites`
*Pending invitation records sent to future staff.*
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `token` (string): Cryptographic UUID used for signup validation.
  - `email` (string, lowercased)
  - `assignedQueueId` (string): Target `queues` ID.
  - `businessId` (string): Target `businesses` ID.
  - `createdAt` (string, ISO Timestamp)

### 2.8. `otps`
*Ephemeral storage for SMS verification OTP verification codes.*
- **Document ID**: The recipient's clean phone number (digits only).
- **Fields**:
  - `code` (string): 6-digit verification code.
  - `expiresAt` (number): Unix epoch timestamp (current time + 10 mins).
  - `phone` (string): Original phone string.

### 2.9. `systemHealth`
*Lock status and records to verify cron routines.*
- **Document ID**: `'cronState'`.
- **Fields**:
  - `lastRunAt` (number): Unix timestamp of the last executed cron sweeping job.
  - `lastCancelledCount` (number): How many expired appointments were purged.
  - `lastProcessedCount` (number): Total matching records scanned.
  - `runStartedAt` (string, ISO Timestamp)
  - `lastCompletedAt` (string, ISO Timestamp)

### 2.10. `queueEvents`
*Logs atomic lifecycle events for transactional metrics and history.*
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `queueId` (string)
  - `action` (string): `'join'` | `'call'` | `'skip'` | `'recall'` | `'completed'` | `'no-show'` | `'return'`.
  - `patientId` (string)
  - `timestamp` (string, ISO Timestamp)

---

## 3. Firestore Security Rules (`firestore.rules`)

Firebase relies on client-side writes governed by security rules. These must be translated into Postgres RLS (Row Level Security) and database-level checks.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is signed in
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user is a staff member
    function isStaffMember() {
      return isAuthenticated() && exists(/databases/$(database)/documents/staff/$(request.auth.uid));
    }

    // Businesses
    match /businesses/{businessId} {
      allow read: if true; // Public booking portals and store kiosks need branding/logo
      allow create, update, delete: if isAuthenticated() && request.auth.uid == businessId;
    }

    // Queues
    match /queues/{queueId} {
      allow read: if true; // Customers see live waiting counts/announcements
      allow create, delete: if isAuthenticated() && (
        request.auth.uid == request.resource.data.businessId || 
        request.auth.uid == request.resource.data.locationId ||
        request.auth.uid == resource.data.businessId || 
        request.auth.uid == resource.data.locationId
      );
      // Allow updates by business owner/staff, OR allow guest walk-in customer joining/leaving lines
      allow update: if (isAuthenticated() && (
        request.auth.uid == resource.data.businessId || 
        request.auth.uid == resource.data.locationId ||
        isStaffMember()
      )) || (
        // Unauthenticated customers joining/leaving can only modify entries array and waitingCount
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['entries', 'waitingCount'])
      );
    }

    // Appointments
    match /appointments/{appointmentId} {
      allow read: if true; // For availability checking
      allow create: if true; // Guests booking online
      // Allow updates by staff, OR allow guests checking in at storefront kiosks
      allow update: if isAuthenticated() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'cancellationReason', 'cancellationSmsSent'])
      );
      allow delete: if isAuthenticated();
    }

    // Customers (CRM Logs)
    match /customers/{customerId} {
      allow read: if isAuthenticated();
      allow create, update: if true; // Customers save records when joining or being called
      allow delete: if isAuthenticated();
    }

    // Staff Profiles
    match /staff/{staffId} {
      allow read: if true;
      allow write: if isAuthenticated() && (
        request.auth.uid == staffId || 
        request.auth.uid == request.resource.data.businessId || 
        request.auth.uid == resource.data.businessId
      );
    }

    // Staff Invites
    match /staffInvites/{inviteId} {
      allow read: if true; // Visited during link verification
      allow write: if isAuthenticated();
    }

    // OTP Verification codes
    match /otps/{phone} {
      allow read, write: if true;
    }

    // System Health / Cron Metrics
    match /systemHealth/{docId} {
      allow read: if isAuthenticated(); // Admins check cron health metrics
      allow write: if false; // Server-only (cron/admin SDK writes)
    }
  }
}
```

*Note: The `queueEvents` collection has no security rule matching block, meaning Firestore defaults to denying client writes. However, client-side writes were attempted in code, representing a functional bug or rules omission that should be corrected during Supabase migration.*

---

## 4. Key Logic & Database Mutations (`queueService.ts`)

A critical challenge during migration is changing the Firestore transactional operations (array manipulations on single documents) to relational Postgres SQL statements.

### 4.1. Joining the Queue
**Firestore Logic**:
1. Retrieve queue document.
2. Find max token number in local `entries` array and compare with `lastAssignedToken` to compute sequential `newTokenNumber`.
3. Append `newEntry` object to the `entries` array via `arrayUnion`.
4. Increment `waitingCount` and update `lastAssignedToken`.
5. Trigger events and customer CRM updates.

**Supabase Migration Risk**: Multiple clients reading the document concurrently will compute identical token numbers. PostgreSQL must manage this through atomic triggers/database functions utilizing a sequence table.

### 4.2. Summoning Next Customer (`callNextPatient`)
**Firestore Logic**:
1. Fetch the queue document.
2. Find the index of the patient currently marked as `'serving'`.
3. Auto-complete the patient (update their appointment status to `'completed'` if applicable) and splice them out of the `entries` array.
4. Locate the patient marked `'next'` and upgrade their status to `'serving'`.
5. Mark the next patient in line as `'next'`.
6. Decrement `waitingCount`, increment `totalServedToday`, updates the queue document, and persist `lastCalledPatient` metadata.
7. Logs the `'call'` action to `queueEvents` and registers the customer update in the CRM list.

---

## 5. Serverless API Endpoints

### 5.1. `/api/appointments/availability` (GET)
- **Parameters**: `workspaceId`, `date`, `serviceId`
- **Logic**:
  1. Validates that IDs are bounded and standard alphanumeric strings.
  2. Confirms that `date` is bounded (-30 days to +365 days) and matches `YYYY-MM-DD`.
  3. Fetches the business document to retrieve operating hours and duration of the specified service.
  4. Queries Firestore for all appointments for the workspace on that date that have `status == 'scheduled'`.
  5. Generates blocks of `durationMinutes` between `openTime` and `closeTime`.
  6. Filters out blocks that overlap with any business breaks or existing bookings.
  7. Returns list of available start times (e.g. `["09:00", "09:30", ...]`).

### 5.2. `/api/cron/auto-cancel` (GET)
- **Security**: Validates Bearer authorization header with `CRON_SECRET`.
- **Anti-Overlap Lock**:
  - Reads `systemHealth/cronState`.
  - Skips run if the last execution was within the last 55 minutes.
  - Updates `lastRunAt` immediately to acquire lock.
- **Sweep Action**:
  - Queries scheduled appointments across yesterday, today, and tomorrow.
  - Compares appointment start times to the current timestamp plus a 15-minute grace period.
  - Updates late appointments to `cancelled` with `cancellationReason: 'No-show (auto-cancelled)'` in a Firestore `WriteBatch`.
  - Dispatches Twilio SMS notifications.
  - Updates run statistics (last processed count, completed timestamp).

---

## 6. Migration Blueprint (Mapping to Supabase)

To migrate from Firebase to Supabase, implement the following steps:

1. **Supabase Auth**: Migrate Firebase Auth users. Businesses and staff will map to standard auth accounts, while walk-in customers check in using **Anonymous Sign-ins** or **Phone OTP (via Twilio/Supabase)**.
2. **Relational Database Schema**: Define tables mapping one-to-one with Firestore collections, breaking out sub-arrays (like queue entries and services) into foreign key tables (`queue_entries`, `services`).
3. **Database-Level Sequencers**: Use PostgreSQL functions to safely increment token numbers per queue, eliminating race conditions.
4. **Row-Level Security (RLS)**: Enforce access control directly inside PostgreSQL using standard RLS policies, checking user metadata via `auth.jwt() -> 'app_metadata'`.
5. **WebSockets (Real-time)**: Replace Firestore `onSnapshot` subscriptions with Supabase real-time client channel listeners.

For the production-grade PostgreSQL definition, see `schema.sql` in the main workspace directory.
