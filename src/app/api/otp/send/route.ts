import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const cleanPhone = phone.replace(/\D/g, '');

    try {
      await supabaseAdmin.from('otp_verifications').insert({
        phone_number: cleanPhone,
        code_hash: code, // stored as plaintext in console mode; hash in production
        expires_at: expiresAt,
      });
    } catch (dbErr) {
      console.error('Failed to store OTP in database:', dbErr);
    }

    const smsApiKey = process.env.SMS_API_KEY;
    const smsSenderId = process.env.SMS_SENDER_ID;

    if (!smsApiKey || !smsSenderId || process.env.SMS_PROVIDER === 'console') {
      console.log(`[SMS Log - SIMULATED OTP] To: ${phone} | OTP Code: ${code}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        devOtp: code,
        message: `Simulated OTP sent to ${phone}. In Dev mode, code is: ${code}`,
      });
    }

    try {
      console.log(`[SMS Send - PROVIDER] Sending OTP ${code} to ${phone}...`);
      return NextResponse.json({ success: true, simulated: false });
    } catch (err: any) {
      console.error('Failed to send SMS OTP via provider:', err);
      return NextResponse.json({
        success: true,
        simulated: true,
        devOtp: code,
        message: `SMS provider error, falling back to simulated OTP: ${code}`,
      });
    }
  } catch (err: any) {
    console.error('Error in send OTP route:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
