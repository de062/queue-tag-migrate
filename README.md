# QueueTag

**QueueTag** is a white-label virtual queue management and advanced appointment scheduling platform. Built on Next.js 16 (App Router) and Firebase/Firestore, it enables retail spaces, clinics, salons, and customer-facing businesses to skip physical waiting rooms, track live walk-in lists in real time, and schedule patient appointments with seamless check-in integrations.

---

## Key Features

### 📅 Advanced Booking & Appointments
- **Self-Service Customer Booking**: Customers can schedule appointments online, select target queues, and receive formatted verification screens.
- **Smart Time-Slot Availability API**: Dynamic endpoint calculates free intervals by cross-referencing staff shifts, existing bookings, and active breaks.
- **VIP Check-In Bridge**: Customers check in at the storefront by entering their phone number. The system automatically fetches their appointment and injects them directly into the correct live queue.
- **Auto-Completion**: Appointments are automatically marked as `completed` the moment the staff member processes the client out of the active live queue.

### 👥 Staff Console & Queue Rooms
- **Real-Time Dashboards**: Real-time listeners display current waitlists, estimated wait times, and active callers.
- **Dual-Mode System**: Easily toggle between **Live Walk-ins** and **Appointments** sub-consoles.
- **Generalized Follow-Up Scheduling**: Staff can tag any active or historical client for a future follow-up date with detailed context notes. Saves records instantly to the `followUps` collection.
- **Cancellation Reason Gate**: Requires staff to input a cancellation reason (minimum 3 characters) before cancelling appointments.

### 📊 Admin Dashboard
- **Queue Configurations**: Create, edit, halt, or delete queues with average wait calculation settings.
- **Master Appointments Ledger**: Displays all historical bookings with date pickers, status filters, and cancellation reasons.
- **Feature Feature Toggles**: Turn on/off the entire appointments module. Features a clean empty state screen when disabled.

### 🖼️ Branded QR Code Check-In Poster
- **Real-Time White-Label Sync**: Modal automatically pulls custom storefront logo URLs and business names from Firestore.
- **High-Resolution Prints**: Utilizes `html-to-image` at `pixelRatio: 2` (retina resolution) to generate sharp, branded check-in poster graphics for physical storefront display.

### 🤖 Automation & Notifications
- **No-Show Auto-Cancel Cron**: Periodic cron job sweeps late appointments (15-minute grace period) and automatically flags them as `No-show (auto-cancelled)`.
- **SMS Notifications**: Dispatches automated text reminders and cancellation alerts (with reasons) using simulated Twilio integrations.

---

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack, static page optimization)
- **Database / Auth**: Firebase Firestore & Firebase Auth
- **Styling**: Tailwind CSS & Vanilla CSS
- **State Management**: Zustand
- **Libraries**: Lucide React, html-to-image, qrcode.react

---

## Database Schemas

### `appointments`
- `workspaceId` (string)
- `customerId` (string)
- `customerName` (string)
- `customerPhone` (string)
- `date` (YYYY-MM-DD)
- `startTime` (HH:MM)
- `endTime` (HH:MM)
- `status` (`'scheduled'` | `'arrived'` | `'completed'` | `'cancelled'`)
- `cancellationReason` (string, optional)

### `followUps`
- `workspaceId` (string)
- `customerId` (string)
- `customerName` (string)
- `customerPhone` (string)
- `followUpDate` (YYYY-MM-DD)
- `reason` (string)
- `createdAt` (ISO Timestamp)
- `status` (default: `'pending'`)

---

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env.local` file in the root folder with your Firebase configurations:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   
   # Notifications & Cron
   CRON_SECRET=your-vercel-cron-secret
   SMS_API_KEY=your-sms-api-key
   SMS_SENDER_ID=your-sms-sender-id
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Verify / Build**:
   ```bash
   npm run build
   ```
