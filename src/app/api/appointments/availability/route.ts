import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const defaultOperatingHours = {
  monday:    { isOpen: true,  openTime: '09:00', closeTime: '17:00', breaks: [] },
  tuesday:   { isOpen: true,  openTime: '09:00', closeTime: '17:00', breaks: [] },
  wednesday: { isOpen: true,  openTime: '09:00', closeTime: '17:00', breaks: [] },
  thursday:  { isOpen: true,  openTime: '09:00', closeTime: '17:00', breaks: [] },
  friday:    { isOpen: true,  openTime: '09:00', closeTime: '17:00', breaks: [] },
  saturday:  { isOpen: false, openTime: '09:00', closeTime: '17:00', breaks: [] },
  sunday:    { isOpen: false, openTime: '09:00', closeTime: '17:00', breaks: [] },
};

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (m: number) => {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mins = (m % 60).toString().padStart(2, '0');
  return `${h}:${mins}`;
};

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const date = searchParams.get('date');
    const serviceId = searchParams.get('serviceId');

    if (!workspaceId || !date || !serviceId) {
      return NextResponse.json(
        { error: 'Missing required query parameters: workspaceId, date, serviceId' },
        { status: 400 }
      );
    }

    // Input Validation & DoS Protection
    if (
      workspaceId.length > 100 || serviceId.length > 100 ||
      !/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(serviceId)
    ) {
      return NextResponse.json({ error: 'Invalid workspaceId or serviceId parameter format' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    // 1. Fetch the workspace document
    const { data: bizData, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (bizErr || !bizData) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (!bizData.appointments_enabled) {
      return NextResponse.json({ slots: [] });
    }

    const services = bizData.services ?? [];
    const service = services.find((s: any) => s.id === serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found in the services menu' }, { status: 404 });
    }

    const durationMinutes = Number(service.durationMinutes) || 30;

    // Parse date safely
    const dateParts = date.split('-');
    const year  = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day   = parseInt(dateParts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const parsedDate = new Date(year, month, day);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    // Ensure date is within -30 to +365 days
    const now = new Date();
    const diffDays = (parsedDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
    if (diffDays < -30 || diffDays > 365) {
      return NextResponse.json({ error: 'Date out of acceptable range (-30 to +365 days)' }, { status: 400 });
    }

    const dayOfWeek = parsedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const operatingHours = bizData.operating_hours ?? defaultOperatingHours;
    const dayConfig = operatingHours[dayOfWeek];

    if (!dayConfig || !dayConfig.isOpen) {
      return NextResponse.json({ slots: [] });
    }

    const openTime  = dayConfig.openTime  || '09:00';
    const closeTime = dayConfig.closeTime || '17:00';
    const breaks    = dayConfig.breaks    || [];

    // 2. Fetch conflicting scheduled appointments
    const { data: existingAppts } = await supabaseAdmin
      .from('appointments')
      .select('start_time, end_time')
      .eq('workspace_id', workspaceId)
      .eq('date', date)
      .eq('status', 'scheduled');

    // 3. Generate all slots
    const openMin  = timeToMinutes(openTime);
    const closeMin = timeToMinutes(closeTime);
    const allSlots: any[] = [];
    for (let current = openMin; current + durationMinutes <= closeMin; current += durationMinutes) {
      allSlots.push({
        start: current,
        end: current + durationMinutes,
        startTimeString: minutesToTime(current),
        endTimeString: minutesToTime(current + durationMinutes),
      });
    }

    // 4. Filter out overlapping slots
    const availableSlots = allSlots.filter((slot) => {
      const hasBreakOverlap = breaks.some((b: any) => {
        if (!b.start || !b.end) return false;
        const bStart = timeToMinutes(b.start);
        const bEnd   = timeToMinutes(b.end);
        return slot.start < bEnd && slot.end > bStart;
      });
      if (hasBreakOverlap) return false;

      const hasApptOverlap = (existingAppts ?? []).some((appt: any) => {
        if (!appt.start_time || !appt.end_time) return false;
        const aStart = timeToMinutes(
          typeof appt.start_time === 'string' ? appt.start_time.slice(0, 5) : appt.start_time
        );
        const aEnd = timeToMinutes(
          typeof appt.end_time === 'string' ? appt.end_time.slice(0, 5) : appt.end_time
        );
        return slot.start < aEnd && slot.end > aStart;
      });
      return !hasApptOverlap;
    });

    const result = availableSlots.map((s) => s.startTimeString);
    return NextResponse.json(
      { slots: result },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } }
    );
  } catch (err: any) {
    console.error('Error calculating availability:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
