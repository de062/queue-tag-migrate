import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { sendCancellationNotice } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // In production, strictly enforce Bearer authorization and ensure CRON_SECRET is configured
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized: Missing or invalid CRON_SECRET' }, { status: 401 });
      }
    } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Anti-overlap lock: Read state BEFORE doing any work
    const now = Date.now();
    const cronStateRef = doc(db, 'systemHealth', 'cronState');
    const cronStateSnap = await getDoc(cronStateRef);
    const lastRunAt = cronStateSnap.exists() ? (cronStateSnap.data().lastRunAt ?? 0) : 0;
    
    // Skip if last run was within last 55 minutes (buffer below 60 to handle Vercel scheduling jitter)
    const MIN_RUN_INTERVAL_MS = 55 * 60 * 1000;
    if (lastRunAt && now - lastRunAt < MIN_RUN_INTERVAL_MS) {
      console.log(`Skipping cron run - last run was ${Math.round((now - lastRunAt) / 60000)} minutes ago`);
      return NextResponse.json({ success: true, skipped: true, reason: 'Recent run' });
    }

    // 3. Acquire lock IMMEDIATELY before any processing (prevents race conditions between
    //    simultaneous Vercel invocations both passing the anti-overlap check)
    await setDoc(cronStateRef, {
      lastRunAt: now,
      lastCancelledCount: 0,
      runStartedAt: new Date().toISOString()
    }, { merge: true });

    // 4. Sweep Logic - scoped to relevant date range only
    const currentTimestamp = now;
    const gracePeriodMs = 15 * 60 * 1000; // 15 minutes grace period

    const apptsRef = collection(db, 'appointments');
    
    // Build date range: yesterday, today, and tomorrow (covers all timezone offsets globally)
    // Use simple date arithmetic rather than toISOString() to avoid UTC-shift issues
    const nowDate = new Date(now);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    const yesterday = new Date(nowDate);
    yesterday.setDate(nowDate.getDate() - 1);
    const tomorrow = new Date(nowDate);
    tomorrow.setDate(nowDate.getDate() + 1);

    const yesterdayStr = formatDate(yesterday);
    const tomorrowStr = formatDate(tomorrow);
    
    // Query with both lower AND upper bounds to prevent unbounded scans on large datasets
    const q = query(
      apptsRef, 
      where('status', '==', 'scheduled'),
      where('date', '>=', yesterdayStr),
      where('date', '<=', tomorrowStr)
    );
    const snap = await getDocs(q);

    const batch = writeBatch(db);
    let autoCancelledCount = 0;
    const notificationPromises: Promise<void>[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.date || !data.startTime) return;

      // Safe date & time parsing
      const dateParts = data.date.split('-');
      const timeParts = data.startTime.split(':');
      if (dateParts.length !== 3 || timeParts.length < 2) return;

      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);

      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
        return;
      }

      const apptDate = new Date(year, month, day, hours, minutes, 0);
      const expiryTimestamp = apptDate.getTime() + gracePeriodMs;

      if (currentTimestamp > expiryTimestamp) {
        // Exceeded grace period: Cancel as no-show and lock SMS dispatches atomically
        batch.update(docSnap.ref, { 
          status: 'cancelled',
          cancellationReason: 'No-show (auto-cancelled)',
          cancellationSmsSent: true
        });
        autoCancelledCount++;

        // Queue SMS only if not already sent for this appointment
        if (data.customerPhone && !data.cancellationSmsSent) {
          const promise: Promise<void> = sendCancellationNotice(
            data.customerPhone,
            data.customerName || 'Customer',
            data.date,
            data.startTime,
            'No-show (auto-cancelled)'
          ).then(() => { /* void */ }).catch((err) => {
            // Intentionally swallow and log - a failed SMS should not abort the sweep
            console.error(`Failed to send auto-cancel SMS for appt ${docSnap.id}:`, err);
          });
          notificationPromises.push(promise);
        }
      }
    });

    // 5. Commit database updates first, then fire SMS notifications
    if (autoCancelledCount > 0) {
      await batch.commit();
    }

    // 6. Use Promise.allSettled so a single SMS failure doesn't surface as a 500
    if (notificationPromises.length > 0) {
      const smsResults = await Promise.allSettled(notificationPromises);
      const smsFailed = smsResults.filter(r => r.status === 'rejected').length;
      if (smsFailed > 0) {
        console.warn(`${smsFailed}/${notificationPromises.length} auto-cancel SMS notifications failed`);
      }
    }

    // 7. Persist final state with outcome metrics
    await setDoc(cronStateRef, {
      lastRunAt: now,
      lastCancelledCount: autoCancelledCount,
      lastProcessedCount: snap.size,
      lastCompletedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({
      success: true,
      processed: snap.size,
      cancelledCount: autoCancelledCount,
      skipped: false
    });

  } catch (err: any) {
    console.error('Error running auto-cancel cron sweep:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

