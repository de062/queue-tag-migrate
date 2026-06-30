import { db } from '../lib/firebase';
import { logQueueEvent } from './eventService';
import { saveCustomerRecord } from './customerService';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  increment, 
  setDoc,
  addDoc,
  getDoc
} from 'firebase/firestore';
import { Queue } from '../types';

export function subscribeToQueues(businessId: string, callback: (queues: Queue[]) => void) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'queues'), where('businessId', '==', businessId));
  
  console.log("STEP 2: Firebase Listener Attached");
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    console.log("STEP 3: Raw Data Received:", snapshot.docs.map(doc => doc.data()));
    
    if (snapshot.empty) {
      console.log(`No queues found for ${businessId}.`);
      callback([]);
      return; 
    }

    const queuesList: Queue[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      queuesList.push({
        id: docSnap.id,
        locationId: data.businessId || data.locationId || businessId,
        businessId: data.businessId || data.locationId || businessId,
        name: data.name || '',
        specialty: data.specialty || '',
        role: data.role || '',
        status: data.status || 'live',
        averageWaitTimeMin: data.averageWaitTimeMin || 15,
        totalServedToday: data.totalServedToday || 0,
        isAppointmentEnabled: data.isAppointmentEnabled || false,
        isHalted: data.isHalted || false,
        entries: data.entries || [],
        currentToken: data.currentToken || 0,
        waitingCount: data.waitingCount || 0,
      } as Queue);
    });

    const data = queuesList;
    console.log("Live Firebase Data Received:", data);
    callback(queuesList);
  });

  return unsubscribe;
}

export async function callNextToken(queueId: string) {
  const queueDocRef = doc(db, 'queues', queueId);
  await updateDoc(queueDocRef, {
    currentToken: increment(1),
    waitingCount: increment(-1),
    totalServedToday: increment(1)
  });
}

export async function updateQueueSettings(queueId: string, updates: Partial<Queue>) {
  const queueDocRef = doc(db, 'queues', queueId);
  await updateDoc(queueDocRef, updates);
}

export async function createNewQueue(businessId: string, name: string, role?: string) {
  const queuesCollection = collection(db, 'queues');
  const queueData: Record<string, any> = {
    businessId,
    locationId: businessId,
    name,
    specialty: 'General Physician',
    status: 'live',
    workingHours: '9:00 AM - 6:00 PM',
    averageWaitTimeMin: 15,
    totalServedToday: 0,
    entries: [],
    currentToken: 0,
    waitingCount: 0,
    isHalted: false,
    isAppointmentEnabled: false
  };

  if (role) {
    queueData.role = role;
  }

  await addDoc(queuesCollection, queueData);
}

export async function callNext(queueId: string) {
  const queueDocRef = doc(db, 'queues', queueId);
  const docSnap = await getDoc(queueDocRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const currentEntries = data.entries || [];
    const entries = [...currentEntries];
    
    // 1. Find serving customer and remove them
    const servingIndex = entries.findIndex((e: any) => e.status === 'serving');
    if (servingIndex !== -1) {
      const removedPatient = entries[servingIndex];
      if (removedPatient.appointmentId) {
        try {
          const apptRef = doc(db, 'appointments', removedPatient.appointmentId);
          await updateDoc(apptRef, { status: 'completed' });
        } catch (err) {
          console.error('Failed to auto-complete appointment:', err);
        }
      }
      entries.splice(servingIndex, 1);
    }

    // 2. Find next customer and make them serving
    const nextIndex = entries.findIndex((e: any) => e.status === 'next');
    if (nextIndex !== -1) {
      entries[nextIndex].status = 'serving';
    }

    // 3. Find first waiting customer and make them next
    const firstWaitingIndex = entries.findIndex((e: any) => e.status === 'waiting');
    if (firstWaitingIndex !== -1) {
      entries[firstWaitingIndex].status = 'next';
    }

    const currentWaiting = data.waitingCount || 0;
    const nextWaiting = Math.max(0, currentWaiting - 1);

    await updateDoc(queueDocRef, {
      currentToken: increment(1),
      waitingCount: nextWaiting,
      totalServedToday: increment(1),
      entries: entries
    });
  }
}

export async function callNextPatient(queueId: string) {
  const queueDocRef = doc(db, 'queues', queueId);
  const docSnap = await getDoc(queueDocRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const currentEntries = data.entries || [];
    const entries = [...currentEntries];
    
    // Find patient about to be called
    const nextPatient = entries.find((e: any) => e.status === 'next') || entries.find((e: any) => e.status === 'waiting');
    const calledPatientId = nextPatient ? nextPatient.id : '';

    // 1. Find serving customer and remove them
    const servingIndex = entries.findIndex((e: any) => e.status === 'serving');
    if (servingIndex !== -1) {
      const removedPatient = entries[servingIndex];
      if (removedPatient.appointmentId) {
        try {
          const apptRef = doc(db, 'appointments', removedPatient.appointmentId);
          await updateDoc(apptRef, { status: 'completed' });
        } catch (err) {
          console.error('Failed to auto-complete appointment:', err);
        }
      }
      entries.splice(servingIndex, 1);
    }

    // 2. Find next customer and make them serving
    const nextIndex = entries.findIndex((e: any) => e.status === 'next');
    if (nextIndex !== -1) {
      entries[nextIndex].status = 'serving';
    }

    // 3. Find first waiting customer and make them next
    const firstWaitingIndex = entries.findIndex((e: any) => e.status === 'waiting');
    if (firstWaitingIndex !== -1) {
      entries[firstWaitingIndex].status = 'next';
    }

    const currentWaiting = data.waitingCount || 0;
    const nextWaiting = Math.max(0, currentWaiting - 1);

    await updateDoc(queueDocRef, {
      currentToken: increment(1),
      waitingCount: nextWaiting,
      totalServedToday: increment(1),
      entries: entries
    });

    if (calledPatientId) {
      await logQueueEvent(queueId, 'call', calledPatientId);
      const businessId = data.businessId || data.locationId || '';
      const queueName = data.name || '';
      const calledPatientName = nextPatient ? nextPatient.customerName : '';
      const calledPatientPhone = nextPatient ? nextPatient.phoneNumber || '' : '';
      const calledPatientToken = nextPatient ? nextPatient.tokenNumber || 0 : 0;
      await saveCustomerRecord(calledPatientName, queueId, 'Served', {
        patientId: calledPatientId,
        phone: calledPatientPhone,
        businessId,
        queueName,
        tokenNumber: calledPatientToken
      });
    }
  }
}

export async function skipPatient(queueId: string) {
  const queueDocRef = doc(db, 'queues', queueId);
  const docSnap = await getDoc(queueDocRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const currentEntries = data.entries || [];
    const entries = [...currentEntries];
    
    // The patient being skipped is the one currently marked as 'serving'
    const servingPatient = entries.find((e: any) => e.status === 'serving');
    const skippedPatientId = servingPatient ? servingPatient.id : '';

    // 1. Find serving customer and remove them
    const servingIndex = entries.findIndex((e: any) => e.status === 'serving');
    if (servingIndex !== -1) {
      const removedPatient = entries[servingIndex];
      if (removedPatient.appointmentId) {
        try {
          const apptRef = doc(db, 'appointments', removedPatient.appointmentId);
          await updateDoc(apptRef, { status: 'completed' });
        } catch (err) {
          console.error('Failed to auto-complete appointment:', err);
        }
      }
      entries.splice(servingIndex, 1);
    }

    // 2. Find next customer and make them serving
    const nextIndex = entries.findIndex((e: any) => e.status === 'next');
    if (nextIndex !== -1) {
      entries[nextIndex].status = 'serving';
    }

    // 3. Find first waiting customer and make them next
    const firstWaitingIndex = entries.findIndex((e: any) => e.status === 'waiting');
    if (firstWaitingIndex !== -1) {
      entries[firstWaitingIndex].status = 'next';
    }

    const currentWaiting = data.waitingCount || 0;
    const nextWaiting = Math.max(0, currentWaiting - 1);

    await updateDoc(queueDocRef, {
      currentToken: increment(1),
      waitingCount: nextWaiting,
      entries: entries
    });

    if (skippedPatientId) {
      await logQueueEvent(queueId, 'skip', skippedPatientId);
      const businessId = data.businessId || data.locationId || '';
      const queueName = data.name || '';
      const skippedPatientName = servingPatient ? servingPatient.customerName : '';
      const skippedPatientPhone = servingPatient ? servingPatient.phoneNumber || '' : '';
      const skippedPatientToken = servingPatient ? servingPatient.tokenNumber || 0 : 0;
      await saveCustomerRecord(skippedPatientName, queueId, 'Skipped', {
        patientId: skippedPatientId,
        phone: skippedPatientPhone,
        businessId,
        queueName,
        tokenNumber: skippedPatientToken
      });
    }
  }
}

export async function leaveQueue(queueId: string, entryId: string) {
  const queueDocRef = doc(db, 'queues', queueId);
  const docSnap = await getDoc(queueDocRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const entries = data.entries || [];
    const entryIndex = entries.findIndex((e: any) => e.id === entryId);
    if (entryIndex !== -1) {
      const entry = entries[entryIndex];
      const isWaiting = entry.status === 'waiting' || entry.status === 'next';
      const updatedEntries = entries.filter((e: any) => e.id !== entryId);
      
      const hasServing = updatedEntries.some((e: any) => e.status === 'serving');
      const hasNext = updatedEntries.some((e: any) => e.status === 'next');
      
      let finalEntries = [...updatedEntries];
      if (!hasServing && finalEntries.length > 0) {
        const nextIndex = finalEntries.findIndex((e: any) => e.status === 'next');
        if (nextIndex !== -1) {
          finalEntries[nextIndex].status = 'serving';
        } else {
          const firstWait = finalEntries.findIndex((e: any) => e.status === 'waiting');
          if (firstWait !== -1) finalEntries[firstWait].status = 'serving';
        }
      }
      
      const nextStillExists = finalEntries.some((e: any) => e.status === 'next');
      if (!nextStillExists && finalEntries.length > 0) {
        const firstWait = finalEntries.findIndex((e: any) => e.status === 'waiting');
        if (firstWait !== -1) finalEntries[firstWait].status = 'next';
      }

      await updateDoc(queueDocRef, {
        entries: finalEntries,
        waitingCount: isWaiting ? increment(-1) : increment(0)
      });
    }
  }
}

export async function pauseQueue(queueId: string, estimatedResumeTime: string) {
  const queueDocRef = doc(db, 'queues', queueId);
  await updateDoc(queueDocRef, {
    status: 'paused',
    estimatedResumeTime
  });
}

export async function resumeQueue(queueId: string) {
  const { deleteField } = await import('firebase/firestore');
  const queueDocRef = doc(db, 'queues', queueId);
  await updateDoc(queueDocRef, {
    status: 'live',
    estimatedResumeTime: deleteField()
  });
}

export async function toggleHalt(queueId: string, currentStatus: boolean) {
  const queueDocRef = doc(db, 'queues', queueId);
  await updateDoc(queueDocRef, {
    isHalted: !currentStatus
  });
}

export async function joinQueue(
  queueId: string, 
  name: string = 'Walk-in Customer', 
  phone?: string, 
  isAppointment: boolean = false,
  appointmentId?: string
) {
  const { arrayUnion, getDoc } = await import('firebase/firestore');
  const queueDocRef = doc(db, 'queues', queueId);
  
  // 1. Fetch current document to calculate token number and status
  const docSnap = await getDoc(queueDocRef);
  if (!docSnap.exists()) {
    throw new Error('Queue not found');
  }
  
  const data = docSnap.data();
  const currentEntries = data.entries || [];
  
  // 2. Generate new token number
  const maxToken = currentEntries.reduce((max: number, entry: any) => Math.max(max, entry.tokenNumber || 0), 0);
  const newTokenNumber = maxToken > 0 ? maxToken + 1 : 1;
  const entryId = `entry-${Date.now()}`;
  
  // 3. Determine status
  const hasServing = currentEntries.some((e: any) => e.status === 'serving');
  const hasNext = currentEntries.some((e: any) => e.status === 'next');
  
  let status: 'waiting' | 'next' | 'serving' = 'waiting';
  if (!hasServing) {
    status = 'serving';
  } else if (!hasNext) {
    status = 'next';
  }

  const newEntry = {
    id: entryId,
    tokenNumber: newTokenNumber,
    customerName: name,
    phoneNumber: phone || '',
    joinedAt: new Date().toISOString(),
    status,
    isAppointment,
    appointmentId: appointmentId || ''
  };

  // 4. Update the doc: append newEntry and increment waitingCount
  await updateDoc(queueDocRef, {
    entries: arrayUnion(newEntry),
    waitingCount: increment(1)
  });

  await logQueueEvent(queueId, 'join', entryId);

  const businessId = data.businessId || data.locationId || '';
  const queueName = data.name || '';
  await saveCustomerRecord(name, queueId, 'Waiting', {
    patientId: entryId,
    phone: phone || '',
    businessId,
    queueName,
    tokenNumber: newTokenNumber
  });

  return entryId;
}
