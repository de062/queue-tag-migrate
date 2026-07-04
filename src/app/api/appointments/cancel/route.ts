import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { sendCancellationNotice } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, cancellationReason } = await request.json();
    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
    }

    const apptRef = doc(db, 'appointments', appointmentId);
    const apptSnap = await getDoc(apptRef);
    if (!apptSnap.exists()) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const apptData = apptSnap.data();
    
    // 1. Eliminate IDOR: Enforce that the appointment must have already been marked 'cancelled'
    // in Firestore by an authorized staff member or admin via client SDK (guarded by Firestore Security Rules).
    if (apptData.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Forbidden: Appointment status must be marked cancelled by authorized staff before dispatching notification' },
        { status: 403 }
      );
    }

    // 2. SMS Flood Protection: Check if notice was already sent
    if (apptData.cancellationSmsSent) {
      return NextResponse.json(
        { error: 'Cancellation notice already dispatched for this appointment' },
        { status: 400 }
      );
    }

    // Send cancellation SMS if phone number is present
    if (apptData.customerPhone) {
      try {
        await sendCancellationNotice(
          apptData.customerPhone,
          apptData.customerName || 'Customer',
          apptData.date || '',
          apptData.startTime || '',
          cancellationReason || apptData.cancellationReason || ''
        );
      } catch (err) {
        console.error('Failed to trigger SMS cancellation notice:', err);
      }
    }

    // Lock future SMS dispatches for this appointment
    const updateData: Record<string, any> = { cancellationSmsSent: true };
    if (cancellationReason && !apptData.cancellationReason) {
      updateData.cancellationReason = cancellationReason.trim();
    }
    await updateDoc(apptRef, updateData);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error cancelling appointment:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
