export interface Location {
  id: string;
  name: string;
  type: string;
  address: string;
  timezone: string;
  planType?: 'trial' | 'premium';
  subscriptionStatus?: 'active' | 'expired';
  billingCycleEnd?: string;
}

export interface QueueEntry {
  id: string;
  tokenNumber: number;
  customerName: string;
  phoneNumber?: string;
  joinedAt: string; // ISO string timestamp
  status: 'waiting' | 'next' | 'serving' | 'completed' | 'skipped';
  isAppointment?: boolean;
  appointmentId?: string;
}

export interface Queue {
  id: string;
  locationId: string;
  businessId: string;
  name: string;
  specialty: string;
  role?: string;
  status: 'live' | 'paused';
  estimatedResumeTime?: string;
  pauseStartedAt?: string;
  lastAssignedToken?: number;
  lastCalledPatient?: {
    id: string;
    customerName: string;
    tokenNumber: number;
    phoneNumber?: string;
    calledAt: string;
    status: 'served' | 'completed' | 'no-show' | 'skipped';
  };
  workingHours: string;
  averageWaitTimeMin: number;
  totalServedToday: number;
  entries: QueueEntry[];
  isAppointmentEnabled: boolean;
  isHalted: boolean;
  currentToken: number;
  waitingCount: number;
  currentAnnouncement?: string;
}

export interface StaffProfile {
  id: string;
  name: string;
  email: string;
  queueId: string;
}

export interface Announcement {
  id: string;
  message: string;
  createdAt: string;
}
