import { db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Updates the white-label branding settings for the current business owner's enterprise workspace.
 * Saves to the business document in the 'businesses' collection.
 */
export async function updateEnterpriseSettings(
  businessName: string,
  logoUrl: string,
  primaryColor: string,
  address?: string,
  email?: string,
  businessCategory?: string,
  requirePhoneNumber?: boolean,
  enableSmsAlerts?: boolean,
  publicPhone?: string,
  publicEmail?: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Authentication required: No active user session found to update settings.');
    }

    const businessDocRef = doc(db, 'businesses', user.uid);
    const updateData: Record<string, any> = {
      businessName,
      logoUrl,
      primaryColor,
    };

    if (address !== undefined) {
      updateData.address = address;
    }
    if (email !== undefined) {
      updateData.email = email;
    }
    if (businessCategory !== undefined) {
      updateData.businessCategory = businessCategory;
    }
    if (requirePhoneNumber !== undefined) {
      updateData.requirePhoneNumber = requirePhoneNumber;
    }
    if (enableSmsAlerts !== undefined) {
      updateData.enableSmsAlerts = enableSmsAlerts;
    }
    if (publicPhone !== undefined) {
      updateData.publicPhone = publicPhone;
    }
    if (publicEmail !== undefined) {
      updateData.publicEmail = publicEmail;
    }

    await setDoc(businessDocRef, updateData, { merge: true });
  } catch (err) {
    console.error('Error updating enterprise settings:', err);
    throw err;
  }
}

/**
 * Destructively deletes the current business/enterprise document and all associated sub-collections 
 * (queues, active tokens, staff profiles, staff invites, and customer logs).
 * Afterwards, signs the user out of Firebase Auth.
 */
export async function deleteWorkspace(): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Authentication required: No active user session found to delete workspace.');
    }

    const businessId = user.uid;
    const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
    const { signOut } = await import('firebase/auth');

    // 1. Delete business metadata document
    const businessDocRef = doc(db, 'businesses', businessId);
    await deleteDoc(businessDocRef);

    const deletePromises: Promise<any>[] = [];

    // 2. Wipe all queues (including nested entries)
    const queuesQuery = query(collection(db, 'queues'), where('businessId', '==', businessId));
    const queuesSnapshot = await getDocs(queuesQuery);
    queuesSnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });

    // 3. Wipe all registered staff profiles
    const staffQuery = query(collection(db, 'staff'), where('businessId', '==', businessId));
    const staffSnapshot = await getDocs(staffQuery);
    staffSnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });

    // 4. Wipe all pending staff invites
    const invitesQuery = query(collection(db, 'staffInvites'), where('businessId', '==', businessId));
    const invitesSnapshot = await getDocs(invitesQuery);
    invitesSnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });

    // 5. Wipe all historical customer documents
    const customersQuery = query(collection(db, 'customers'), where('businessId', '==', businessId));
    const customersSnapshot = await getDocs(customersQuery);
    customersSnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });

    // Execute all deletions in parallel
    await Promise.all(deletePromises);

    // 6. Sign out the user
    await signOut(auth);
  } catch (err) {
    console.error('Error in deleteWorkspace settingsService:', err);
    throw err;
  }
}

export async function updateAppointmentSettings(
  appointmentsEnabled: boolean,
  bookingSlug: string,
  operatingHours: any,
  services: any[]
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Authentication required: No active user session found to update settings.');
    }

    const businessDocRef = doc(db, 'businesses', user.uid);
    await setDoc(businessDocRef, {
      appointmentsEnabled,
      bookingSlug,
      operatingHours,
      services
    }, { merge: true });
  } catch (err) {
    console.error('Error updating appointment settings:', err);
    throw err;
  }
}
