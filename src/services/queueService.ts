import { supabase } from '../lib/supabase';
import { logQueueEvent } from './eventService';
import { saveCustomerRecord } from './customerService';
import { Queue, QueueEntry } from '../types';

// ─── Row → Domain model mapper ───────────────────────────────────────────────

function rowToQueueEntry(row: any): QueueEntry {
  return {
    id: row.id,
    tokenNumber: row.token_number ?? 0,
    customerName: row.customer_name ?? '',
    phoneNumber: row.phone_number ?? '',
    joinedAt: row.joined_at ?? new Date().toISOString(),
    status: row.status ?? 'waiting',
    isAppointment: row.is_appointment ?? false,
    appointmentId: row.appointment_id ?? undefined,
  };
}

function rowToQueue(row: any): Queue {
  const entries: QueueEntry[] = (row.queue_entries ?? [])
    .filter((e: any) => ['waiting', 'next', 'serving'].includes(e.status))
    .map(rowToQueueEntry)
    .sort((a: QueueEntry, b: QueueEntry) => a.tokenNumber - b.tokenNumber);

  return {
    id: row.id,
    locationId: row.business_id,
    businessId: row.business_id,
    name: row.name ?? '',
    specialty: row.specialty ?? '',
    role: row.role ?? undefined,
    status: row.status === 'live' ? 'live' : 'paused',
    estimatedResumeTime: row.estimated_resume_time ?? undefined,
    pauseStartedAt: row.pause_started_at ?? undefined,
    lastAssignedToken: row.last_assigned_token ?? 0,
    lastCalledPatient: row.last_called_patient ?? undefined,
    workingHours: row.working_hours ?? '9:00 AM - 6:00 PM',
    averageWaitTimeMin: row.average_wait_time_min ?? 15,
    totalServedToday: row.total_served_today ?? 0,
    isAppointmentEnabled: row.is_appointment_enabled ?? false,
    isHalted: row.is_halted ?? false,
    currentToken: row.current_token ?? 0,
    waitingCount: row.waiting_count ?? 0,
    currentAnnouncement: row.current_announcement ?? undefined,
    entries,
  };
}

// ─── Real-time subscription ───────────────────────────────────────────────────

export function subscribeToQueues(
  businessId: string,
  callback: (queues: Queue[]) => void
) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const fetchQueues = async () => {
    const { data, error } = await supabase
      .from('queues')
      .select('*, queue_entries(*)')
      .eq('business_id', businessId);

    if (error) {
      console.error('Error fetching queues:', error);
      return;
    }

    callback((data ?? []).map(rowToQueue));
  };

  fetchQueues();

  const channel = supabase
    .channel(`queues:${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queues', filter: `business_id=eq.${businessId}` },
      fetchQueues
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queue_entries' },
      fetchQueues
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─── Join queue ───────────────────────────────────────────────────────────────

export async function joinQueue(
  queueId: string,
  name: string = 'Walk-in Customer',
  phone?: string,
  isAppointment: boolean = false,
  appointmentId?: string
): Promise<string> {
  // Atomic, race-free token via PG function
  const { data: tokenNumber, error: tokenErr } = await supabase.rpc('next_token_number', {
    p_queue_id: queueId,
  });
  if (tokenErr) throw tokenErr;

  const entryId = `entry-${Date.now()}`;

  const { error: insertErr } = await supabase.from('queue_entries').insert({
    id: entryId,
    queue_id: queueId,
    customer_name: name,
    phone_number: phone ?? '',
    token_number: tokenNumber as number,
    is_appointment: isAppointment,
    appointment_id: appointmentId ?? null,
    status: 'waiting',
  });
  if (insertErr) throw insertErr;

  // Increment waiting_count and persist last_assigned_token
  await supabase.rpc('increment_queue_waiting', {
    p_queue_id: queueId,
    p_last_token: tokenNumber as number,
  });

  await logQueueEvent(queueId, 'join', entryId);

  // Read businessId + queueName for the CRM record
  const { data: qRow } = await supabase
    .from('queues')
    .select('business_id, name')
    .eq('id', queueId)
    .single();

  await saveCustomerRecord(name, queueId, 'Waiting', {
    patientId: entryId,
    phone: phone ?? '',
    businessId: qRow?.business_id ?? '',
    queueName: qRow?.name ?? '',
    tokenNumber: tokenNumber as number,
  });

  return entryId;
}

// ─── Internal helper — get active entries for a queue ─────────────────────────

async function getQueueEntries(queueId: string) {
  const { data } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('queue_id', queueId)
    .in('status', ['waiting', 'next', 'serving'])
    .order('token_number', { ascending: true });
  return data ?? [];
}

async function getQueueMeta(queueId: string) {
  const { data } = await supabase.from('queues').select('*').eq('id', queueId).single();
  return data;
}

// ─── Internal helper — advance queue state (call/skip share this logic) ───────

async function advanceQueue(
  queueId: string,
  servingAction: 'served' | 'skipped',
  logAction: string
) {
  const entries = await getQueueEntries(queueId);
  const queueMeta = await getQueueMeta(queueId);

  const serving = entries.find((e: any) => e.status === 'serving');
  const nextUp = entries.find((e: any) => e.status === 'next')
    ?? entries.find((e: any) => e.status === 'waiting');

  // 1. Complete the currently serving patient
  if (serving) {
    await supabase.from('queue_entries').update({
      status: 'served',
      served_at: new Date().toISOString(),
    }).eq('id', serving.id);

    if (serving.appointment_id) {
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', serving.appointment_id);
    }
  }

  let newCurrentToken = queueMeta?.current_token ?? 0;
  let lastCalledPatient: any = null;

  // 2. Promote next → serving
  if (nextUp && nextUp.id !== serving?.id) {
    await supabase.from('queue_entries').update({
      status: 'serving',
      called_at: new Date().toISOString(),
    }).eq('id', nextUp.id);

    newCurrentToken = nextUp.token_number;
    lastCalledPatient = {
      id: nextUp.id,
      customerName: nextUp.customer_name,
      tokenNumber: nextUp.token_number,
      phoneNumber: nextUp.phone_number ?? '',
      calledAt: new Date().toISOString(),
      status: 'served',
    };
  }

  // 3. Mark the next waiting customer as 'next'
  const remainingWaiting = entries.filter(
    (e: any) => e.status === 'waiting' && e.id !== nextUp?.id
  );
  if (remainingWaiting[0]) {
    await supabase.from('queue_entries').update({ status: 'next' }).eq('id', remainingWaiting[0].id);
  }

  // 4. Update queue aggregate fields
  const queueUpdate: Record<string, any> = {
    current_token: newCurrentToken,
    waiting_count: Math.max(0, (queueMeta?.waiting_count ?? 1) - 1),
  };
  if (servingAction === 'served') {
    queueUpdate.total_served_today = (queueMeta?.total_served_today ?? 0) + 1;
  }
  if (lastCalledPatient) {
    queueUpdate.last_called_patient = lastCalledPatient;
  }
  await supabase.from('queues').update(queueUpdate).eq('id', queueId);

  // 5. Log event + CRM record for the patient who was serving
  if (serving) {
    await logQueueEvent(queueId, logAction, serving.id);
    const statusLabel = servingAction === 'served' ? 'Served' : 'Skipped';
    await saveCustomerRecord(serving.customer_name, queueId, statusLabel, {
      patientId: serving.id,
      phone: serving.phone_number ?? '',
      businessId: queueMeta?.business_id ?? '',
      queueName: queueMeta?.name ?? '',
      tokenNumber: serving.token_number,
    });
  }
}

// ─── Public queue operations ──────────────────────────────────────────────────

/** Legacy simple increment — used by some dashboard pages */
export async function callNextToken(queueId: string) {
  const meta = await getQueueMeta(queueId);
  await supabase.from('queues').update({
    current_token: (meta?.current_token ?? 0) + 1,
    waiting_count: Math.max(0, (meta?.waiting_count ?? 1) - 1),
    total_served_today: (meta?.total_served_today ?? 0) + 1,
  }).eq('id', queueId);
}

export async function updateQueueSettings(queueId: string, updates: Partial<Queue>) {
  const dbUpdates: Record<string, any> = {};
  if (updates.name !== undefined)               dbUpdates.name = updates.name;
  if (updates.specialty !== undefined)           dbUpdates.specialty = updates.specialty;
  if (updates.averageWaitTimeMin !== undefined)  dbUpdates.average_wait_time_min = updates.averageWaitTimeMin;
  if (updates.isHalted !== undefined)            dbUpdates.is_halted = updates.isHalted;
  if (updates.isAppointmentEnabled !== undefined) dbUpdates.is_appointment_enabled = updates.isAppointmentEnabled;
  if (updates.status !== undefined)              dbUpdates.status = updates.status;
  if (updates.workingHours !== undefined)        dbUpdates.working_hours = updates.workingHours;

  await supabase.from('queues').update(dbUpdates).eq('id', queueId);
}

export async function createNewQueue(businessId: string, name: string, role?: string) {
  const queueData: Record<string, any> = {
    business_id: businessId,
    name,
    specialty: 'General Physician',
    status: 'live',
    working_hours: '9:00 AM - 6:00 PM',
    average_wait_time_min: 15,
    total_served_today: 0,
    current_token: 0,
    last_assigned_token: 0,
    waiting_count: 0,
    is_halted: false,
    is_appointment_enabled: false,
  };
  if (role) queueData.role = role;

  const { error } = await supabase.from('queues').insert(queueData);
  if (error) throw error;
}

/** Full call-next with status cascade, event logging, and CRM update */
export async function callNext(queueId: string) {
  await advanceQueue(queueId, 'served', 'call');
}

export async function callNextPatient(queueId: string) {
  await advanceQueue(queueId, 'served', 'call');
}

export async function skipPatient(queueId: string) {
  await advanceQueue(queueId, 'skipped', 'skip');
}

export async function leaveQueue(queueId: string, entryId: string) {
  const { data: entry } = await supabase
    .from('queue_entries')
    .select('status')
    .eq('id', entryId)
    .maybeSingle();

  const isWaiting = entry?.status === 'waiting' || entry?.status === 'next';

  await supabase.from('queue_entries').update({ status: 'cancelled' }).eq('id', entryId);

  if (isWaiting) {
    const meta = await getQueueMeta(queueId);
    await supabase.from('queues').update({
      waiting_count: Math.max(0, (meta?.waiting_count ?? 1) - 1),
    }).eq('id', queueId);
  }

  // Re-evaluate next/serving pointers after removal
  const remaining = await getQueueEntries(queueId);
  const hasServing = remaining.some((e: any) => e.status === 'serving');
  const hasNext = remaining.some((e: any) => e.status === 'next');

  if (!hasServing && remaining.length > 0) {
    const nextToServe = remaining.find((e: any) => e.status === 'next')
      ?? remaining.find((e: any) => e.status === 'waiting');
    if (nextToServe) {
      await supabase.from('queue_entries').update({ status: 'serving' }).eq('id', nextToServe.id);
    }
  }
  if (!hasNext && remaining.length > 0) {
    const firstWaiting = remaining.find((e: any) => e.status === 'waiting');
    if (firstWaiting) {
      await supabase.from('queue_entries').update({ status: 'next' }).eq('id', firstWaiting.id);
    }
  }
}

export async function pauseQueue(queueId: string, estimatedResumeTime: string) {
  await supabase.from('queues').update({
    status: 'paused',
    estimated_resume_time: estimatedResumeTime,
    pause_started_at: new Date().toISOString(),
  }).eq('id', queueId);
}

export async function resumeQueue(queueId: string) {
  await supabase.from('queues').update({
    status: 'live',
    estimated_resume_time: null,
    pause_started_at: null,
  }).eq('id', queueId);
}

export async function toggleHalt(queueId: string, currentStatus: boolean) {
  await supabase.from('queues').update({ is_halted: !currentStatus }).eq('id', queueId);
}

export async function recallLastPatient(queueId: string) {
  const meta = await getQueueMeta(queueId);
  const target = meta?.last_called_patient;
  if (target) {
    await logQueueEvent(queueId, 'recall', target.id);
  }
}

export async function recallLastCalledPatient(queueId: string) {
  const meta = await getQueueMeta(queueId);
  if (meta?.last_called_patient) {
    const p = meta.last_called_patient;
    const updated = {
      ...p,
      calledAt: new Date().toISOString(),
      recalledCount: (p.recalledCount ?? 0) + 1,
    };
    await supabase.from('queues').update({ last_called_patient: updated }).eq('id', queueId);
    await logQueueEvent(queueId, 'recall', p.id);
  }
}

export async function updateLastPatientStatus(queueId: string, status: 'completed' | 'no-show') {
  const meta = await getQueueMeta(queueId);
  if (meta?.last_called_patient) {
    const updated = { ...meta.last_called_patient, status };
    await supabase.from('queues').update({ last_called_patient: updated }).eq('id', queueId);
    await saveCustomerRecord(updated.customerName, queueId, status === 'completed' ? 'Served' : 'Skipped', {
      patientId: updated.id,
      phone: updated.phoneNumber ?? '',
      businessId: meta.business_id ?? '',
      queueName: meta.name ?? '',
      tokenNumber: updated.tokenNumber,
    });
  }
}

export async function updateLastCalledPatientStatus(queueId: string, status: 'completed' | 'no-show') {
  const meta = await getQueueMeta(queueId);
  if (meta?.last_called_patient) {
    const updated = {
      ...meta.last_called_patient,
      status,
      updatedAt: new Date().toISOString(),
    };
    await supabase.from('queues').update({ last_called_patient: updated }).eq('id', queueId);
  }
}

export async function returnLastPatientToQueue(queueId: string) {
  const meta = await getQueueMeta(queueId);
  if (meta?.last_called_patient) {
    const p = meta.last_called_patient;
    await supabase.from('queue_entries').insert({
      id: p.id,
      queue_id: queueId,
      customer_name: p.customerName,
      phone_number: p.phoneNumber ?? '',
      token_number: p.tokenNumber,
      status: 'waiting',
      is_appointment: false,
      joined_at: new Date().toISOString(),
    });
    await supabase.from('queues').update({
      waiting_count: (meta.waiting_count ?? 0) + 1,
      last_called_patient: null,
    }).eq('id', queueId);
  }
}
