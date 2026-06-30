import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { sendCancellationNotice } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // In production, if CRON_SECRET is defined, enforce Bearer authorization
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Sweep Logic
    const today = new Date();
    const currentTimestamp = today.getTime();
    const gracePeriodMs = 15 * 60 * 1000; // 15 minutes grace period

    const apptsRef = collection(db, 'appointments');
    const q = query(apptsRef, where('status', '==', 'scheduled'));
    const snap = await getDocs(q);

    const batch = writeBatch(db);
    let autoCancelledCount = 0;
    const notificationPromises: Promise<any>[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.date || !data.startTime) return;

      // Safe date & time parsing
      const dateParts = data.date.split('-');
      const timeParts = data.startTime.split(':');
      if (dateParts.length !== 3 || timeParts.length !== 2) return;

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
        // Exceeded grace period: Cancel as no-show
        batch.update(docSnap.ref, { 
          status: 'cancelled',
          cancellationReason: 'No-show (auto-cancelled)'
        });
        autoCancelledCount++;

        // Send cancellation notice SMS
        if (data.customerPhone) {
          const promise = sendCancellationNotice(
            data.customerPhone,
            data.customerName || 'Customer',
            data.date,
            data.startTime,
            'No-show (auto-cancelled)'
          ).catch((err) => {
            console.error('Failed to trigger auto-cancel SMS notice:', err);
          });
          notificationPromises.push(promise);
        }
      }
    });

    if (autoCancelledCount > 0) {
      await batch.commit();
      await Promise.all(notificationPromises);
    }

    return NextResponse.json({
      success: true,
      processed: snap.size,
      cancelledCount: autoCancelledCount
    });

  } catch (err: any) {
    console.error('Error running auto-cancel cron sweep:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
