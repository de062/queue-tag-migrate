import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, customerId, customerName, customerPhone, followUpDate, reason } = await request.json();

    // Validations
    if (!workspaceId || !customerName || !followUpDate || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, customerName, followUpDate, or reason' },
        { status: 400 }
      );
      return;
    }

    const followUpsRef = collection(db, 'followUps');
    const docRef = await addDoc(followUpsRef, {
      workspaceId,
      customerId: customerId || '',
      customerName: customerName.trim(),
      customerPhone: customerPhone || '',
      followUpDate,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err: any) {
    console.error('Error scheduling follow-up:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
