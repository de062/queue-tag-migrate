import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendCancellationNotice } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized: Missing or invalid CRON_SECRET' }, { status: 401 });
      }
    } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Anti-overlap lock: Read state BEFORE doing any work
    const now = Date.now();
    const { data: cronState } = await supabaseAdmin
      .from('system_health')
      .select('*')
      .eq('key', 'cronState')
      .maybeSingle();

    const lastRunAt = cronState?.last_run_at ? new Date(cronState.last_run_at).getTime() : 0;
    const MIN_RUN_INTERVAL_MS = 55 * 60 * 1000;

    if (lastRunAt && now - lastRunAt < MIN_RUN_INTERVAL_MS) {
      console.log(`Skipping cron run - last run was ${Math.round((now - lastRunAt) / 60000)} minutes ago`);
      return NextResponse.json({ success: true, skipped: true, reason: 'Recent run' });
    }

    // 3. Acquire lock IMMEDIATELY before any processing
    await supabaseAdmin.from('system_health').upsert({
      key: 'cronState',
      last_run_at: new Date(now).toISOString(),
      last_cancelled_count: 0,
      run_started_at: new Date().toISOString(),
    });

    // 4. Sweep Logic — scoped to relevant date range only
    const gracePeriodMs = 15 * 60 * 1000;
    const nowDate = new Date(now);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const yesterday = new Date(nowDate); yesterday.setDate(nowDate.getDate() - 1);
    const tomorrow  = new Date(nowDate); tomorrow.setDate(nowDate.getDate() + 1);

    const yesterdayStr = formatDate(yesterday);
    const tomorrowStr  = formatDate(tomorrow);

    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('status', 'scheduled')
      .gte('date', yesterdayStr)
      .lte('date', tomorrowStr);

    const lateAppts: any[] = [];
    const notificationPromises: Promise<void>[] = [];

    for (const appt of appointments ?? []) {
      if (!appt.date || !appt.start_time) continue;

      const dateParts = appt.date.split('-');
      // start_time from postgres may be "HH:MM:SS" — slice to "HH:MM"
      const timeStr = typeof appt.start_time === 'string' ? appt.start_time.slice(0, 5) : '';
      const timeParts = timeStr.split(':');
      if (dateParts.length !== 3 || timeParts.length < 2) continue;

      const year    = parseInt(dateParts[0], 10);
      const month   = parseInt(dateParts[1], 10) - 1;
      const day     = parseInt(dateParts[2], 10);
      const hours   = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);

      if ([year, month, day, hours, minutes].some(isNaN)) continue;

      const apptDate = new Date(year, month, day, hours, minutes, 0);
      const expiryTimestamp = apptDate.getTime() + gracePeriodMs;

      if (now > expiryTimestamp) {
        lateAppts.push(appt);
        if (appt.customer_phone && !appt.cancellation_sms_sent) {
          const promise: Promise<void> = sendCancellationNotice(
            appt.customer_phone,
            appt.customer_name || 'Customer',
            appt.date,
            timeStr,
            'No-show (auto-cancelled)'
          ).then(() => {}).catch((err) => {
            console.error(`Failed to send auto-cancel SMS for appt ${appt.id}:`, err);
          });
          notificationPromises.push(promise);
        }
      }
    }

    // 5. Commit DB updates
    const autoCancelledCount = lateAppts.length;
    if (autoCancelledCount > 0) {
      await Promise.all(
        lateAppts.map((appt) =>
          supabaseAdmin.from('appointments').update({
            status: 'cancelled',
            cancellation_reason: 'No-show (auto-cancelled)',
            cancellation_sms_sent: true,
          }).eq('id', appt.id)
        )
      );
    }

    // 6. Fire SMS notifications — allSettled so one failure doesn't abort the sweep
    if (notificationPromises.length > 0) {
      const smsResults = await Promise.allSettled(notificationPromises);
      const smsFailed = smsResults.filter((r) => r.status === 'rejected').length;
      if (smsFailed > 0) {
        console.warn(`${smsFailed}/${notificationPromises.length} auto-cancel SMS notifications failed`);
      }
    }

    // 7. Persist final state with outcome metrics
    await supabaseAdmin.from('system_health').upsert({
      key: 'cronState',
      last_run_at: new Date(now).toISOString(),
      last_cancelled_count: autoCancelledCount,
      last_processed_count: (appointments ?? []).length,
      last_completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      processed: (appointments ?? []).length,
      cancelledCount: autoCancelledCount,
      skipped: false,
    });
  } catch (err: any) {
    console.error('Error running auto-cancel cron sweep:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
