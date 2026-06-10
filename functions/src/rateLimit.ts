import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const DAILY_LIMIT = 50;

/**
 * Per-UID daily message counter stored at usage/{uid} as {day: 'YYYY-MM-DD' (UTC), count}.
 * Throws resource-exhausted once the user hits DAILY_LIMIT messages in a UTC day.
 */
export async function checkRateLimit(uid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('usage').doc(uid);
  const today = new Date().toISOString().slice(0, 10);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();

    if (!snap.exists || data?.day !== today) {
      tx.set(ref, { day: today, count: 1, updatedAt: FieldValue.serverTimestamp() });
      return;
    }

    const count = typeof data.count === 'number' ? data.count : 0;
    if (count >= DAILY_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        "You've reached today's chat limit. Come back tomorrow!"
      );
    }
    tx.update(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}
