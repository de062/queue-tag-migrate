import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

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
    const eventRef = collection(db, 'queueEvents');
    await addDoc(eventRef, {
      queueId,
      action,
      patientId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error logging queue event in logQueueEvent:', err);
  }
}
