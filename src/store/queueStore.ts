import { create } from 'zustand';
import { Location, Queue, QueueEntry, StaffProfile, Announcement } from '../types';
import { subscribeToQueues } from '../services/queueService';

interface QueueState {
  locations: Record<string, Location>;
  queues: Record<string, Queue>;
  staff: Record<string, StaffProfile>;
  currentCustomerId: string | null;
  currentCustomerQueueId: string | null;
  currentStaffProfile: StaffProfile | null;
  currentBusiness: Location | null;
  announcements: Announcement[];
  unsubscribeLiveSync: (() => void) | null;
  
  joinQueue: (queueId: string, name: string, phone?: string, isAppointment?: boolean, appointmentId?: string) => Promise<string>;
  leaveQueue: (queueId: string, entryId: string) => Promise<void>;
  pauseQueue: (queueId: string, estimatedResumeTime: string) => Promise<void>;
  resumeQueue: (queueId: string) => Promise<void>;
  nextCustomer: (queueId: string) => Promise<void>;
  skipCustomer: (queueId: string) => Promise<void>;
  recallCustomer: (queueId: string) => void;
  provisionStaff: (name: string, email: string, queueId: string) => void;
  resetCustomerState: () => void;
  loginStaff: (email: string) => StaffProfile | null;
  logoutStaff: () => void;
  createBusinessWorkspace: (name: string, type: string, timezone: string, queues: Array<{ name: string; specialty: string; averageWaitTimeMin: number }>) => string;
  createQueue: (locationId: string, name: string, specialty: string, averageWaitTimeMin: number, isAppointmentEnabled?: boolean, isHalted?: boolean) => void;
  updateQueue: (queueId: string, name: string, specialty: string, averageWaitTimeMin: number, isAppointmentEnabled?: boolean, isHalted?: boolean) => void;
  deleteQueue: (queueId: string) => void;
  toggleHaltQueue: (queueId: string) => void;
  addAnnouncement: (message: string) => void;
  deleteAnnouncement: (id: string) => void;
  updateBusinessProfile: (name: string, address: string) => void;
  upgradeBusinessToPremium: () => void;
  simulateSubscriptionExpired: () => void;
  simulateSubscriptionActive: () => void;
  initLiveSync: (businessId: string) => () => void;
  loadPersistedBusiness: () => void;
}

const INITIAL_LOCATIONS: Record<string, Location> = {};

const INITIAL_QUEUES: Record<string, Queue> = {};

const INITIAL_STAFF: Record<string, StaffProfile> = {
  'staff-1': {
    id: 'staff-1',
    name: 'Dr. John Staff',
    email: 'john@queuetag.com',
    queueId: 'dr-john',
  },
  'staff-2': {
    id: 'staff-2',
    name: 'Dr. Sarah Staff',
    email: 'sarah@queuetag.com',
    queueId: 'dr-sarah',
  },
};

// Client-side helper to read localStorage
const getLocalStorageValue = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

export const useQueueStore = create<QueueState>((set, get) => ({
  locations: INITIAL_LOCATIONS,
  queues: INITIAL_QUEUES,
  staff: INITIAL_STAFF,
  currentCustomerId: getLocalStorageValue('qt_customer_id'),
  currentCustomerQueueId: getLocalStorageValue('qt_queue_id'),
  currentStaffProfile: (() => {
    const val = getLocalStorageValue('qt_staff_profile');
    if (val) {
      try {
        return JSON.parse(val);
      } catch (e) {
        return null;
      }
    }
    return null;
  })(),
  currentBusiness: null,
  announcements: (() => {
    const val = getLocalStorageValue('qt_announcements');
    if (val) {
      try {
        return JSON.parse(val);
      } catch (e) {
        // Fallback to default
      }
    }
    return [
      {
        id: 'ann-default',
        message: 'Welcome to ABC Clinic! Please remain near the clinic. We will notify you when your turn is close.',
        createdAt: new Date().toISOString()
      }
    ];
  })(),
  unsubscribeLiveSync: null,

  joinQueue: async (queueId, name, phone, isAppointment, appointmentId) => {
    const { joinQueue: dbJoinQueue } = await import('../services/queueService');
    const entryId = await dbJoinQueue(queueId, name, phone, isAppointment, appointmentId);
    
    set({
      currentCustomerId: entryId,
      currentCustomerQueueId: queueId,
    });
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('qt_customer_id', entryId);
      localStorage.setItem('qt_queue_id', queueId);
    }
    
    return entryId;
  },

  leaveQueue: async (queueId, entryId) => {
    const { leaveQueue: dbLeaveQueue } = await import('../services/queueService');
    await dbLeaveQueue(queueId, entryId);

    const isCurrentCustomer = get().currentCustomerId === entryId;
    if (isCurrentCustomer) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('qt_customer_id');
        localStorage.removeItem('qt_queue_id');
      }
      set({
        currentCustomerId: null,
        currentCustomerQueueId: null,
      });
    }
  },

  pauseQueue: async (queueId, estimatedResumeTime) => {
    const { pauseQueue: dbPauseQueue } = await import('../services/queueService');
    await dbPauseQueue(queueId, estimatedResumeTime);
  },

  resumeQueue: async (queueId) => {
    const { resumeQueue: dbResumeQueue } = await import('../services/queueService');
    await dbResumeQueue(queueId);
  },

  nextCustomer: async (queueId) => {
    const { callNext: dbCallNext } = await import('../services/queueService');
    await dbCallNext(queueId);
  },

  skipCustomer: async (queueId) => {
    const { callNext: dbCallNext } = await import('../services/queueService');
    await dbCallNext(queueId);
  },

  recallCustomer: (queueId) => {
    // In a real app this would trigger an audio call or push notification.
    // For our mock, we can trigger a visual alert.
    console.log(`Recalling customer for queue: ${queueId}`);
  },

  provisionStaff: (name, email, queueId) => {
    const id = `staff-${Date.now()}`;
    const newStaff: StaffProfile = { id, name, email, queueId };
    
    set((state) => ({
      staff: {
        ...state.staff,
        [id]: newStaff,
      },
    }));
  },

  resetCustomerState: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qt_customer_id');
      localStorage.removeItem('qt_queue_id');
    }
    set({
      currentCustomerId: null,
      currentCustomerQueueId: null,
    });
  },

  loginStaff: (email) => {
    const staffMember = Object.values(get().staff).find(
      (s) => s.email.toLowerCase() === email.toLowerCase()
    );
    if (staffMember) {
      set({ currentStaffProfile: staffMember });
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_staff_profile', JSON.stringify(staffMember));
      }
      return staffMember;
    }
    return null;
  },

  logoutStaff: () => {
    set({ currentStaffProfile: null });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qt_staff_profile');
    }
  },

  createBusinessWorkspace: (name, type, timezone, initialQueues) => {
    const businessId = `biz-${Date.now()}`;
    const newLocation: Location = {
      id: businessId,
      name,
      type,
      address: 'Onboarded Online Workspace',
      timezone,
    };

    const newQueues: Record<string, Queue> = {};
    initialQueues.forEach((q, idx) => {
      const qId = `q-${businessId}-${idx}`;
      newQueues[qId] = {
        id: qId,
        locationId: businessId,
        businessId: businessId,
        name: q.name,
        specialty: q.specialty,
        status: 'live',
        workingHours: '9:00 AM - 6:00 PM',
        averageWaitTimeMin: q.averageWaitTimeMin,
        totalServedToday: 0,
        entries: [],
        isAppointmentEnabled: false,
        isHalted: false,
        currentToken: 0,
        waitingCount: 0,
      };
    });

    set((state) => {
      const updatedLocations = {
        ...state.locations,
        [businessId]: newLocation,
      };
      
      const updatedQueues = {
        ...state.queues,
        ...newQueues,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_current_business', JSON.stringify(newLocation));
      }

      return {
        locations: updatedLocations,
        queues: updatedQueues,
        currentBusiness: newLocation,
      };
    });

    return businessId;
  },

  createQueue: (locationId, name, specialty, averageWaitTimeMin, isAppointmentEnabled = false, isHalted = false) => {
    const queueId = `q-${locationId}-${Date.now()}`;
    const newQueue: Queue = {
      id: queueId,
      locationId,
      businessId: locationId,
      name,
      specialty,
      status: 'live',
      workingHours: '9:00 AM - 6:00 PM',
      averageWaitTimeMin,
      totalServedToday: 0,
      entries: [],
      isAppointmentEnabled,
      isHalted,
      currentToken: 0,
      waitingCount: 0,
    };
    
    set((state) => ({
      queues: {
        ...state.queues,
        [queueId]: newQueue,
      },
    }));
  },

  updateQueue: (queueId, name, specialty, averageWaitTimeMin, isAppointmentEnabled = false, isHalted = false) => {
    set((state) => {
      const queue = state.queues[queueId];
      if (!queue) return {};
      
      return {
        queues: {
          ...state.queues,
          [queueId]: {
            ...queue,
            name,
            specialty,
            averageWaitTimeMin,
            isAppointmentEnabled,
            isHalted,
          },
        },
      };
    });
  },

  deleteQueue: (queueId) => {
    set((state) => {
      const updatedQueues = { ...state.queues };
      delete updatedQueues[queueId];
      
      return {
        queues: updatedQueues,
      };
    });
  },

  toggleHaltQueue: (queueId) => {
    set((state) => {
      const queue = state.queues[queueId];
      if (!queue) return {};
      
      return {
        queues: {
          ...state.queues,
          [queueId]: {
            ...queue,
            isHalted: !queue.isHalted,
          },
        },
      };
    });
  },

  addAnnouncement: (message) => {
    const id = `ann-${Date.now()}`;
    const newAnnouncement: Announcement = {
      id,
      message,
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const updatedAnnouncements = [...state.announcements, newAnnouncement];
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_announcements', JSON.stringify(updatedAnnouncements));
      }
      return { announcements: updatedAnnouncements };
    });
  },

  deleteAnnouncement: (id) => {
    set((state) => {
      const updatedAnnouncements = state.announcements.filter((ann) => ann.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_announcements', JSON.stringify(updatedAnnouncements));
      }
      return { announcements: updatedAnnouncements };
    });
  },

  updateBusinessProfile: (name, address) => {
    set((state) => {
      const current = state.currentBusiness || state.locations['abc-clinic'];
      const updatedBusiness = {
        ...current,
        name,
        address,
      };
      
      const updatedLocations = {
        ...state.locations,
        [current.id]: updatedBusiness,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_current_business', JSON.stringify(updatedBusiness));
      }

      return {
        currentBusiness: updatedBusiness,
        locations: updatedLocations,
      };
    });
  },

  upgradeBusinessToPremium: () => {
    set((state) => {
      const current = state.currentBusiness || state.locations['abc-clinic'];
      const nextCycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const updatedBusiness: Location = {
        ...current,
        planType: 'premium',
        subscriptionStatus: 'active',
        billingCycleEnd: nextCycleEnd,
      };
      const updatedLocations = {
        ...state.locations,
        [current.id]: updatedBusiness,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_current_business', JSON.stringify(updatedBusiness));
      }
      return {
        currentBusiness: updatedBusiness,
        locations: updatedLocations,
      };
    });
  },

  simulateSubscriptionExpired: () => {
    set((state) => {
      const current = state.currentBusiness || state.locations['abc-clinic'];
      const updatedBusiness: Location = {
        ...current,
        subscriptionStatus: 'expired',
      };
      const updatedLocations = {
        ...state.locations,
        [current.id]: updatedBusiness,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_current_business', JSON.stringify(updatedBusiness));
      }
      return {
        currentBusiness: updatedBusiness,
        locations: updatedLocations,
      };
    });
  },

  simulateSubscriptionActive: () => {
    set((state) => {
      const current = state.currentBusiness || state.locations['abc-clinic'];
      const updatedBusiness: Location = {
        ...current,
        subscriptionStatus: 'active',
      };
      const updatedLocations = {
        ...state.locations,
        [current.id]: updatedBusiness,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_current_business', JSON.stringify(updatedBusiness));
      }
      return {
        currentBusiness: updatedBusiness,
        locations: updatedLocations,
      };
    });
  },

  initLiveSync: (businessId) => {
    const currentUnsubscribe = get().unsubscribeLiveSync;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }

    // Asynchronously fetch business profile details from Firestore
    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const docRef = doc(db, 'businesses', businessId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.businessName) {
            set((state) => {
              const current = state.locations[businessId] || state.currentBusiness || {
                id: businessId,
                name: 'ABC Clinic',
                type: 'Clinic',
                address: '123, MG Road, Bangalore, Karnataka 560001',
                timezone: '(GMT+05:30) Asia/Kolkata',
                planType: 'premium',
                subscriptionStatus: 'active',
                billingCycleEnd: 'Jul 24, 2026',
              };
              const updated = {
                ...current,
                name: data.businessName,
              };
              return {
                currentBusiness: state.currentBusiness?.id === businessId ? updated : state.currentBusiness,
                locations: {
                  ...state.locations,
                  [businessId]: updated,
                },
              };
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch business profile in sync:', err);
      }
    })();

    const unsubscribe = subscribeToQueues(businessId, (queuesList) => {
      const queuesRecord: Record<string, Queue> = {};
      queuesList.forEach((q) => {
        queuesRecord[q.id] = q;
      });

      set((state) => {
        const current = state.locations[businessId] || state.currentBusiness || {
          id: businessId,
          name: 'ABC Clinic',
          type: 'Clinic',
          address: '123, MG Road, Bangalore, Karnataka 560001',
          timezone: '(GMT+05:30) Asia/Kolkata',
          planType: 'premium',
          subscriptionStatus: 'active',
          billingCycleEnd: 'Jul 24, 2026',
        };
        const updatedBusiness = {
          ...current,
          id: businessId,
          planType: current.planType || 'premium',
          subscriptionStatus: current.subscriptionStatus || 'active',
          billingCycleEnd: current.billingCycleEnd || 'Jul 24, 2026',
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem('qt_current_business', JSON.stringify(updatedBusiness));
        }

        return {
          queues: queuesRecord,
          currentBusiness: state.currentBusiness?.id === businessId ? updatedBusiness : state.currentBusiness,
          locations: {
            ...state.locations,
            [businessId]: updatedBusiness,
          },
        };
      });
      console.log("STEP 4: Zustand State Updated");
    });

    set({ unsubscribeLiveSync: unsubscribe });
    return unsubscribe;
  },

  loadPersistedBusiness: () => {
    const val = getLocalStorageValue('qt_current_business');
    if (val) {
      try {
        const parsed = JSON.parse(val);
        if (parsed && parsed.id) {
          set((state) => {
            const updated = {
              name: 'ABC Clinic',
              type: 'Clinic',
              address: '123, MG Road, Bangalore, Karnataka 560001',
              timezone: '(GMT+05:30) Asia/Kolkata',
              planType: 'trial',
              subscriptionStatus: 'active',
              billingCycleEnd: 'Jun 29, 2026',
              ...parsed,
            };
            return {
              currentBusiness: updated,
              locations: {
                ...state.locations,
                [updated.id]: updated,
              },
            };
          });
        }
      } catch (e) {
        // Ignore
      }
    }
  },
}));
