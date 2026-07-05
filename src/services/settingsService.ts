import { supabase } from '../lib/supabase';

/**
 * Updates the white-label branding settings for the current business owner's workspace.
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required: No active user session found.');

    const updateData: Record<string, any> = {
      name: businessName,
      logo_url: logoUrl,
      primary_color: primaryColor,
    };

    if (address !== undefined)           updateData.address = address;
    if (email !== undefined)             updateData.email = email;
    if (businessCategory !== undefined)  updateData.business_category = businessCategory;
    if (requirePhoneNumber !== undefined) updateData.require_phone_number = requirePhoneNumber;
    if (enableSmsAlerts !== undefined)   updateData.enable_sms_alerts = enableSmsAlerts;
    if (publicPhone !== undefined)       updateData.public_phone = publicPhone;
    if (publicEmail !== undefined)       updateData.public_email = publicEmail;

    const { error } = await supabase.from('businesses').update(updateData).eq('id', user.id);
    if (error) throw error;
  } catch (err) {
    console.error('Error updating enterprise settings:', err);
    throw err;
  }
}

/**
 * Deletes the current business/workspace.
 * FK cascades handle deletion of queues, staff, invites, customers, appointments, follow-ups.
 * Signs the user out afterwards.
 */
export async function deleteWorkspace(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required: No active user session found.');

    // Single delete — FK on delete cascade cleans up all child rows
    const { error } = await supabase.from('businesses').delete().eq('id', user.id);
    if (error) throw error;

    await supabase.auth.signOut();
  } catch (err) {
    console.error('Error in deleteWorkspace settingsService:', err);
    throw err;
  }
}

/**
 * Updates appointments module settings on the businesses row.
 */
export async function updateAppointmentSettings(
  appointmentsEnabled: boolean,
  bookingSlug: string,
  operatingHours: any,
  services: any[]
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required: No active user session found.');

    const { error } = await supabase.from('businesses').update({
      appointments_enabled: appointmentsEnabled,
      booking_slug: bookingSlug,
      operating_hours: operatingHours,
      services,
    }).eq('id', user.id);

    if (error) throw error;
  } catch (err) {
    console.error('Error updating appointment settings:', err);
    throw err;
  }
}
