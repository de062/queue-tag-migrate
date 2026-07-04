import { schedule } from '@netlify/functions';

/**
 * Netlify Scheduled Function - Auto Cancel Cron
 *
 * Runs every hour (matching the Vercel cron schedule "0 * * * *").
 * Calls the Next.js /api/cron/auto-cancel route with a Bearer token
 * for authentication so the handler can validate the CRON_SECRET.
 *
 * Required Netlify environment variables:
 *   - CRON_SECRET  : Shared secret matching the one in your Next.js route
 *   - URL          : Automatically set by Netlify to your site's primary URL
 */
const handler = async () => {
  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl) {
    console.error('[auto-cancel-cron] Missing URL environment variable');
    return { statusCode: 500 };
  }

  if (!cronSecret) {
    console.error('[auto-cancel-cron] Missing CRON_SECRET environment variable');
    return { statusCode: 500 };
  }

  const endpoint = `${siteUrl}/api/cron/auto-cancel`;
  console.log(`[auto-cancel-cron] Triggering ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const body = await response.json();
    console.log(`[auto-cancel-cron] Response ${response.status}:`, body);

    return { statusCode: response.status };
  } catch (err) {
    console.error('[auto-cancel-cron] Failed to call auto-cancel endpoint:', err);
    return { statusCode: 500 };
  }
};

// Run every hour — mirrors the Vercel "0 * * * *" schedule
export default schedule('0 * * * *', handler);
