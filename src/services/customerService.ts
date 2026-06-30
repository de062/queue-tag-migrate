import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  queueId: string;
  queueName: string;
  tokenNumber: number;
  status: 'Waiting' | 'Served' | 'Skipped';
  joinedAt: string;
  businessId: string;
}

/**
 * Saves or updates a customer record in the Firestore 'customers' collection
 */
export async function saveCustomerRecord(
  patientName: string,
  queueId: string,
  status: 'Waiting' | 'Served' | 'Skipped',
  extra: { 
    patientId: string; 
    phone: string; 
    businessId: string; 
    queueName: string; 
    tokenNumber: number; 
  }
): Promise<void> {
  try {
    const customerDocRef = doc(db, 'customers', extra.patientId);
    
    const dataToSave: Partial<CustomerRecord> = {
      id: extra.patientId,
      name: patientName,
      queueId,
      queueName: extra.queueName,
      status,
      phone: extra.phone,
      businessId: extra.businessId,
      tokenNumber: extra.tokenNumber
    };

    // Only set joinedAt if it's the initial check-in (Waiting status)
    if (status === 'Waiting') {
      dataToSave.joinedAt = new Date().toISOString();
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
