import { supabase } from '../lib/supabase';
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
 * Creates a staff invite in the staff_invites table.
 */
export async function createStaffInvite(
  email: string,
  queueId: string,
  businessId: string
): Promise<string> {
  const token = crypto.randomUUID();
  const { error } = await supabase.from('staff_invites').insert({
    token,
    email: email.trim().toLowerCase(),
    assigned_queue_id: queueId,
    business_id: businessId,
  });
  if (error) throw error;
  return token;
}

/**
 * Deletes a staff invite from the staff_invites table.
 */
export async function deleteStaffInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('staff_invites').delete().eq('id', inviteId);
  if (error) throw error;
}

/**
 * Subscribes to pending invites for a specific businessId in real-time.
 */
export function subscribeToStaffInvites(
  businessId: string,
  callback: (invites: StaffInvite[]) => void
) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from('staff_invites')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) { console.error('Error fetching staff invites:', error); return; }

    const invitesList: StaffInvite[] = (data ?? []).map((row) => ({
      id: row.id,
      token: row.token,
      email: row.email,
      assignedQueueId: row.assigned_queue_id ?? '',
      businessId: row.business_id,
      createdAt: row.created_at,
    }));

    callback(invitesList);
  };

  fetchInvites();

  const channel = supabase
    .channel(`staff_invites:${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'staff_invites', filter: `business_id=eq.${businessId}` },
      fetchInvites
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/**
 * Subscribes to registered staff profiles for a specific businessId in real-time.
 */
export function subscribeToStaffProfiles(
  businessId: string,
  callback: (profiles: StaffProfile[]) => void
) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*, staff_queue_assignments(queue_id)')
      .eq('business_id', businessId);

    if (error) { console.error('Error fetching staff profiles:', error); return; }

    const profilesList: StaffProfile[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      email: row.email ?? '',
      queueId: row.staff_queue_assignments?.[0]?.queue_id ?? '',
    }));

    callback(profilesList);
  };

  fetchProfiles();

  const channel = supabase
    .channel(`staff:${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'staff', filter: `business_id=eq.${businessId}` },
      fetchProfiles
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
