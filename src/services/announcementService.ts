import { supabase } from '../lib/supabase';

/**
 * Publishes a broadcast announcement message on a specific queue.
 */
export async function setAnnouncement(queueId: string, message: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('queues')
      .update({ current_announcement: message })
      .eq('id', queueId);
    if (error) throw error;
  } catch (err) {
    console.error('Error setting queue announcement:', err);
    throw err;
  }
}

/**
 * Clears the broadcast announcement from a specific queue.
 */
export async function clearAnnouncement(queueId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('queues')
      .update({ current_announcement: '' })
      .eq('id', queueId);
    if (error) throw error;
  } catch (err) {
    console.error('Error clearing queue announcement:', err);
    throw err;
  }
}

/**
 * Sets the global business announcement on the businesses row.
 */
export async function setGlobalAnnouncement(businessId: string, message: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ global_announcement: message })
      .eq('id', businessId);
    if (error) throw error;
  } catch (err) {
    console.error('Error setting global announcement:', err);
    throw err;
  }
}

/**
 * Clears the global business announcement.
 */
export async function clearGlobalAnnouncement(businessId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ global_announcement: '' })
      .eq('id', businessId);
    if (error) throw error;
  } catch (err) {
    console.error('Error clearing global announcement:', err);
    throw err;
  }
}
