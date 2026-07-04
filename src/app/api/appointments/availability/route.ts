import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const defaultOperatingHours = {
  monday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  friday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  saturday: { isOpen: false, openTime: '09:00', closeTime: '17:00', breaks: [] },
  sunday: { isOpen: false, openTime: '09:00', closeTime: '17:00', breaks: [] }
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

    // Input Validation & DoS Protection: Ensure IDs are well-formed and bounded
    if (workspaceId.length > 100 || serviceId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(serviceId)) {
      return NextResponse.json({ error: 'Invalid workspaceId or serviceId parameter format' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    // 1. Fetch the workspace document from Firestore
    const bizDocRef = doc(db, 'businesses', workspaceId);
    const bizDocSnap = await getDoc(bizDocRef);
    if (!bizDocSnap.exists()) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const bizData = bizDocSnap.data();

    // If appointments are disabled, return an empty slots array
    if (!bizData.appointmentsEnabled) {
      return NextResponse.json({ slots: [] });
    }

    // Find the matching service to get its durationMinutes
    const services = bizData.services || [];
    const service = services.find((s: any) => s.id === serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found in the services menu' }, { status: 404 });
    }

    const durationMinutes = Number(service.durationMinutes) || 30;

    // Parse date safely to find the weekday (avoiding timezone shifting)
    const dateParts = date.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const parsedDate = new Date(year, month, day);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    // Ensure date is within -30 days to +365 days to prevent DoS via extreme date loops
    const now = new Date();
    const diffDays = (parsedDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
    if (diffDays < -30 || diffDays > 365) {
      return NextResponse.json({ error: 'Date out of acceptable range (-30 to +365 days)' }, { status: 400 });
    }

    const dayOfWeek = parsedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Find the operatingHours for the specific day of the week requested
    const operatingHours = bizData.operatingHours || defaultOperatingHours;
    const dayConfig = operatingHours[dayOfWeek];

    if (!dayConfig || !dayConfig.isOpen) {
      return NextResponse.json({ slots: [] });
    }

    const openTime = dayConfig.openTime || '09:00';
    const closeTime = dayConfig.closeTime || '17:00';
    const breaks = dayConfig.breaks || [];

    // 2. Fetch conflicting scheduled appointments from the database
    const apptsQuery = query(
      collection(db, 'appointments'),
      where('workspaceId', '==', workspaceId),
      where('date', '==', date),
      where('status', '==', 'scheduled')
    );
    const apptsSnap = await getDocs(apptsQuery);
    const existingAppts: any[] = [];
    apptsSnap.forEach((docSnap) => {
      existingAppts.push(docSnap.data());
    });

    // 3. Generate all slots of length durationMinutes between openTime and closeTime
    const openMin = timeToMinutes(openTime);
    const closeMin = timeToMinutes(closeTime);

    const allSlots: any[] = [];
    for (let current = openMin; current + durationMinutes <= closeMin; current += durationMinutes) {
      allSlots.push({
        start: current,
        end: current + durationMinutes,
        startTimeString: minutesToTime(current),
        endTimeString: minutesToTime(current + durationMinutes)
      });
    }

    // 4. Filter out slots that overlap with breaks or existing appointments
    const availableSlots = allSlots.filter((slot) => {
      // Check break overlaps
      const hasBreakOverlap = breaks.some((b: any) => {
        if (!b.start || !b.end) return false;
        const breakStart = timeToMinutes(b.start);
        const breakEnd = timeToMinutes(b.end);
        return slot.start < breakEnd && slot.end > breakStart;
      });
      if (hasBreakOverlap) return false;

      // Check scheduled appointment overlaps
      const hasAppointmentOverlap = existingAppts.some((appt: any) => {
        if (!appt.startTime || !appt.endTime) return false;
        const apptStart = timeToMinutes(appt.startTime);
        const apptEnd = timeToMinutes(appt.endTime);
        return slot.start < apptEnd && slot.end > apptStart;
      });
      if (hasAppointmentOverlap) return false;

      return true;
    });

    // Return the final array of clean, starting times with caching headers
    const result = availableSlots.map((s) => s.startTimeString);
    return NextResponse.json(
      { slots: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30'
        }
      }
    );
  } catch (err: any) {
    console.error('Error calculating availability:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
