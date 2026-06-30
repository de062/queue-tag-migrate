import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { StaffProfile } from '../types';

export interface StaffInvite {
  id: string;
  token: string;
  email: string;
  assignedQueueId: string;
  businessId: string;
  createdAt: string;
}

/**
 * Creates a staff invite in Firestore staffInvites collection
 */
export async function createStaffInvite(email: string, queueId: string, businessId: string): Promise<string> {
  const token = crypto.randomUUID();
  const inviteData = {
    token,
    email: email.trim().toLowerCase(),
    assignedQueueId: queueId,
    businessId,
    createdAt: new Date().toISOString()
  };
  
  const collectionRef = collection(db, 'staffInvites');
  await addDoc(collectionRef, inviteData);
  return token;
}

/**
 * Deletes a staff invite from Firestore staffInvites collection
 */
export async function deleteStaffInvite(inviteId: string): Promise<void> {
  const inviteDocRef = doc(db, 'staffInvites', inviteId);
  await deleteDoc(inviteDocRef);
}

/**
 * Subscribes to pending invites for a specific businessId in real-time
 */
export function subscribeToStaffInvites(businessId: string, callback: (invites: StaffInvite[]) => void) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'staffInvites'), where('businessId', '==', businessId));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const invitesList: StaffInvite[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      invitesList.push({
        id: docSnap.id,
        token: data.token || '',
        email: data.email || '',
        assignedQueueId: data.assignedQueueId || '',
        businessId: data.businessId || '',
        createdAt: data.createdAt || ''
      });
    });
    
    // Sort by newest first
    invitesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(invitesList);
  });

  return unsubscribe;
}

/**
 * Subscribes to registered staff profiles for a specific businessId in real-time
 */
export function subscribeToStaffProfiles(businessId: string, callback: (profiles: StaffProfile[]) => void) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'staff'), where('businessId', '==', businessId));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const profilesList: StaffProfile[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      profilesList.push({
        id: docSnap.id,
        name: data.name || '',
        email: data.email || '',
        queueId: data.assignedQueueId || data.queueId || ''
      });
    });
    callback(profilesList);
  });

  return unsubscribe;
}
