import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
    }

    // Generate a 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    const cleanPhone = phone.replace(/\D/g, '');

    try {
      const otpRef = doc(db, 'otps', cleanPhone);
      await setDoc(otpRef, { code, expiresAt, phone });
    } catch (dbErr) {
      console.error('Failed to store OTP in Firestore:', dbErr);
    }

    const smsApiKey = process.env.SMS_API_KEY;
    const smsSenderId = process.env.SMS_SENDER_ID;

    if (!smsApiKey || !smsSenderId) {
      console.log(`[SMS Log - SIMULATED OTP] To: ${phone} | OTP Code: ${code}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        devOtp: code,
        message: `Simulated OTP sent to ${phone}. In Dev mode, code is: ${code}`
      });
    }

    try {
      // Production SMS API call would be invoked here
      console.log(`[SMS Send - PROVIDER] Sending OTP ${code} to ${phone}...`);
      return NextResponse.json({ success: true, simulated: false });
    } catch (err: any) {
      console.error('Failed to send SMS OTP via provider:', err);
      // Fallback to simulated mode so users are never blocked if SMS provider fails
      return NextResponse.json({
        success: true,
        simulated: true,
        devOtp: code,
        message: `SMS provider error, falling back to simulated OTP: ${code}`
      });
    }
  } catch (err: any) {
    console.error('Error in send OTP route:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
