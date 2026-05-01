import { db } from '../db';

/**
 * Generates a unique sale number in the format S + 8 alphanumeric chars.
 * Characters: A-Z (minus O, I) + 2-9 (minus 0, 1) to avoid visual confusion.
 * Maximum 10 attempts, falls back to timestamp-based number on collision.
 *
 * @returns {Promise<string>} e.g. "SA3F9K2M"
 */
export async function generateSaleNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let attempt = 0; attempt < 10; attempt++) {
    const body = Array.from({ length: 8 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    const candidate = 'S' + body;

    const exists = await db.sales
      .where('sale_number')
      .equals(candidate)
      .count();

    if (exists === 0) {
      return candidate;
    }
  }

  // Fallback: timestamp-based (practically impossible to reach)
  return 'S' + Date.now().toString(36).toUpperCase().slice(-8).padStart(8, '0');
}
