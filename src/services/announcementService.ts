import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Publishes a broadcast announcement message directly on a specific queue's document
 */
export async function setAnnouncement(queueId: string, message: string): Promise<void> {
  try {
    const queueDocRef = doc(db, 'queues', queueId);
    await updateDoc(queueDocRef, {
      currentAnnouncement: message
    });
  } catch (err) {
    console.error('Error setting queue announcement:', err);
    throw err;
  }
}

/**
 * Clears/removes the broadcast announcement from a specific queue's document
 */
export async function clearAnnouncement(queueId: string): Promise<void> {
  try {
    const queueDocRef = doc(db, 'queues', queueId);
    await updateDoc(queueDocRef, {
      currentAnnouncement: ''
    });
  } catch (err) {
    console.error('Error clearing queue announcement:', err);
    throw err;
  }
}

/**
 * Sets the global business announcement on the businesses document
 */
export async function setGlobalAnnouncement(businessId: string, message: string): Promise<void> {
  try {
    const bizDocRef = doc(db, 'businesses', businessId);
    await updateDoc(bizDocRef, {
      globalAnnouncement: message
    });
  } catch (err) {
    console.error('Error setting global announcement:', err);
    throw err;
  }
}

/**
 * Clears/removes the global business announcement
 */
export async function clearGlobalAnnouncement(businessId: string): Promise<void> {
  try {
    const bizDocRef = doc(db, 'businesses', businessId);
    await updateDoc(bizDocRef, {
      globalAnnouncement: ''
    });
  } catch (err) {
    console.error('Error clearing global announcement:', err);
    throw err;
  }
}
