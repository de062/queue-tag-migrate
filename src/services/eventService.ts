import { supabase } from '../lib/supabase';

export interface QueueEvent {
  id?: string;
  queueId: string;
  action: 'join' | 'call' | 'skip' | 'recall' | 'completed' | 'no-show' | 'return' | string;
  patientId: string;
  timestamp: string; // ISO string
}

export async function logQueueEvent(
  queueId: string,
  action: 'join' | 'call' | 'skip' | 'recall' | 'completed' | 'no-show' | 'return' | string,
  patientId: string
): Promise<void> {
  try {
    await supabase.from('queue_events').insert({
      queue_id: queueId,
      action,
      patient_id: patientId,
    });
  } catch (err) {
    console.error('Error logging queue event in logQueueEvent:', err);
  }
}
