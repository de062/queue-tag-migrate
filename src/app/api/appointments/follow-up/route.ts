import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, customerId, customerName, customerPhone, followUpDate, reason } =
      await request.json();

    if (!workspaceId || !customerName || !followUpDate || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, customerName, followUpDate, or reason' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.from('follow_ups').insert({
      workspace_id: workspaceId,
      customer_id: customerId || null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone || null,
      follow_up_date: followUpDate,
      reason: reason.trim(),
      status: 'pending',
    }).select('id').single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('Error scheduling follow-up:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
