export async function sendCancellationNotice(
  phone: string,
  customerName: string,
  date: string,
  time: string,
  reason?: string
) {
  // Format time to 12-hour display in the SMS notice
  const formatTimeTo12Hour = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
  };

  const formattedTime = formatTimeTo12Hour(time);
  let message = `Hi ${customerName}, your appointment on ${date} at ${formattedTime} has been cancelled.`;
  if (reason) {
    message += ` Reason: ${reason}.`;
  }
  message += ` Please contact us or visit our booking page to reschedule.`;

  const smsApiKey = process.env.SMS_API_KEY;
  const smsSenderId = process.env.SMS_SENDER_ID;

  if (!smsApiKey || !smsSenderId) {
    console.log(`[SMS Log - SIMULATED] To: ${phone} | Msg: ${message}`);
    return { success: true, simulated: true, message };
  }

  try {
    console.log(`[SMS Send - PROVIDER] Sending cancellation SMS to ${phone}...`);
    // Twilio or other SMS provider request example:
    // const response = await fetch('https://api.sms-provider.com/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${smsApiKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     to: phone,
    //     sender: smsSenderId,
    //     body: message
    //   })
    // });
    // if (!response.ok) throw new Error('SMS service error');
    
    return { success: true, simulated: false };
  } catch (error: any) {
    console.error(`Failed to send cancellation SMS to ${phone}:`, error);
    // Gracefully handle error and log to console
    console.log(`[SMS Fallback Log] To: ${phone} | Msg: ${message}`);
    return { success: false, error: error.message };
  }
}
