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
    
    const updateData: Record<string, any> = { status: 'cancelled' };
    if (cancellationReason) {
      updateData.cancellationReason = cancellationReason.trim();
    }
    await updateDoc(apptRef, updateData);

    // Send cancellation SMS if phone number is present
    if (apptData.customerPhone) {
      try {
        await sendCancellationNotice(
          apptData.customerPhone,
          apptData.customerName || 'Customer',
          apptData.date || '',
          apptData.startTime || '',
          cancellationReason || ''
        );
      } catch (err) {
        console.error('Failed to trigger SMS cancellation notice:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error cancelling appointment:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
