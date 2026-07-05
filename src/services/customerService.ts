import { supabase } from '../lib/supabase';

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
 * Saves or updates a customer record in the 'customers' table.
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
    const nowStr = new Date().toISOString();
    const todayDate = nowStr.split('T')[0];

    const dataToSave: Record<string, any> = {
      id: extra.patientId,
      name: patientName,
      queue_id: queueId,
      queue_name: extra.queueName,
      status,
      phone: extra.phone,
      business_id: extra.businessId,
      token_number: extra.tokenNumber,
      visit_date: todayDate,
    };

    if (status === 'Waiting') {
      dataToSave.joined_at = nowStr;
    } else {
      dataToSave.completed_at = nowStr;
      // Try to calculate wait time from existing joined_at
      const { data: existing } = await supabase
        .from('customers')
        .select('joined_at')
        .eq('id', extra.patientId)
        .maybeSingle();
      if (existing?.joined_at) {
        const diffMin = Math.round((Date.now() - new Date(existing.joined_at).getTime()) / 60000);
        dataToSave.wait_time_min = Math.max(0, diffMin);
      }
    }

    await supabase.from('customers').upsert(dataToSave, { onConflict: 'id' });
  } catch (err) {
    console.error('Error saving customer record:', err);
  }
}

/**
 * Subscribes to customer CRM records for a given business in real-time.
 */
export function subscribeToCustomers(
  businessId: string,
  callback: (customers: CustomerRecord[]) => void
) {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      return;
    }

    const customersList: CustomerRecord[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      phone: row.phone ?? '',
      queueId: row.queue_id ?? '',
      queueName: row.queue_name ?? '',
      tokenNumber: row.token_number ?? 0,
      status: row.status ?? 'Waiting',
      joinedAt: row.joined_at ?? new Date().toISOString(),
      completedAt: row.completed_at ?? undefined,
      waitTimeMin: row.wait_time_min ?? undefined,
      businessId: row.business_id,
      date: row.visit_date ?? undefined,
    }));

    callback(customersList);
  };

  fetchCustomers();

  const channel = supabase
    .channel(`customers:${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers', filter: `business_id=eq.${businessId}` },
      fetchCustomers
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
