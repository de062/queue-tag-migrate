import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  queueId: string;
  queueName: string;
  tokenNumber: number;
  status: 'Waiting' | 'Served' | 'Skipped' | 'Completed' | 'No-Show' | string;
  joinedAt: string;
  completedAt?: string;
  waitTimeMin?: number;
  businessId: string;
  date?: string;
}

/**
 * Saves or updates a customer record in the Firestore 'customers' collection
 */
export async function saveCustomerRecord(
  patientName: string,
  queueId: string,
  status: 'Waiting' | 'Served' | 'Skipped' | 'Completed' | 'No-Show' | string,
  extra: { 
    patientId: string; 
    phone: string; 
    businessId: string; 
    queueName: string; 
    tokenNumber: number; 
  }
): Promise<void> {
  try {
    const { getDoc } = await import('firebase/firestore');
    const customerDocRef = doc(db, 'customers', extra.patientId);
    
    const nowStr = new Date().toISOString();
    const todayDate = nowStr.split('T')[0];

    const dataToSave: Record<string, any> = {
      id: extra.patientId,
      name: patientName,
      queueId,
      queueName: extra.queueName,
      status,
      phone: extra.phone,
      businessId: extra.businessId,
      tokenNumber: extra.tokenNumber,
      date: todayDate
    };

    if (status === 'Waiting') {
      dataToSave.joinedAt = nowStr;
    } else {
      dataToSave.completedAt = nowStr;
      // Try to calculate waitTimeMin if doc already exists
      try {
        const existingSnap = await getDoc(customerDocRef);
        if (existingSnap.exists() && existingSnap.data().joinedAt) {
          const joinedTime = new Date(existingSnap.data().joinedAt).getTime();
          const diffMin = Math.round((Date.now() - joinedTime) / 60000);
          dataToSave.waitTimeMin = Math.max(0, diffMin);
        }
      } catch (e) {
        // Ignore check
      }
    }

    await setDoc(customerDocRef, dataToSave, { merge: true });
  } catch (err) {
    console.error('Error saving customer record:', err);
  }
}

/**
 * Subscribes to customer CRM records for a given business in real-time
 */
export function subscribeToCustomers(
  businessId: string,
  callback: (customers: CustomerRecord[]) => void
) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'customers'),
    where('businessId', '==', businessId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const customersList: CustomerRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        customersList.push({
          id: docSnap.id,
          name: data.name || '',
          phone: data.phone || '',
          queueId: data.queueId || '',
          queueName: data.queueName || '',
          tokenNumber: data.tokenNumber || 0,
          status: data.status || 'Waiting',
          joinedAt: data.joinedAt || new Date().toISOString(),
          businessId: data.businessId || ''
        });
      });

      // Sort by join timestamp (newest first)
      customersList.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
      callback(customersList);
    },
    (err) => {
      console.error('Error listening to customers updates:', err);
    }
  );

  return unsubscribe;
}
