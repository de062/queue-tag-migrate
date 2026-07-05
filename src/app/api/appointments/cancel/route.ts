import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendCancellationNotice } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, cancellationReason } = await request.json();
    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
    }

    const { data: apptData, error: fetchErr } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchErr || !apptData) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // 1. Eliminate IDOR: must already be marked 'cancelled' by authorized staff via client
    if (apptData.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Forbidden: Appointment status must be marked cancelled by authorized staff before dispatching notification' },
        { status: 403 }
      );
    }

    // 2. SMS Flood Protection
    if (apptData.cancellation_sms_sent) {
      return NextResponse.json(
        { error: 'Cancellation notice already dispatched for this appointment' },
        { status: 400 }
      );
    }

    // Send cancellation SMS if phone number is present
    if (apptData.customer_phone) {
      try {
        await sendCancellationNotice(
          apptData.customer_phone,
          apptData.customer_name || 'Customer',
          apptData.date || '',
          apptData.start_time || '',
          cancellationReason || apptData.cancellation_reason || ''
        );
      } catch (err) {
        console.error('Failed to trigger SMS cancellation notice:', err);
      }
    }

    // Lock future SMS dispatches for this appointment
    const updateData: Record<string, any> = { cancellation_sms_sent: true };
    if (cancellationReason && !apptData.cancellation_reason) {
      updateData.cancellation_reason = cancellationReason.trim();
    }

    await supabaseAdmin.from('appointments').update(updateData).eq('id', appointmentId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error cancelling appointment:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
