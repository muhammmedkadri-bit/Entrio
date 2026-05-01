import { db } from '../db';

export const paymentRegisterService = {
  /**
   * Retrieves the current mapping based on DB state.
   * @returns {Promise<{cash: number, card: number, transfer: number}>}
   */
  async getMapping() {
    try {
      // Use filter instead of where('is_active').equals(true) due to potential indexing issues
      const registers = await db.cash_registers.filter(r => r.is_active !== false).toArray();
      const mapping = {
        cash: null,
        card: null,
        transfer: null
      };

      registers.forEach(reg => {
        if (reg.is_default_for === 'cash' && !mapping.cash) mapping.cash = reg.id;
        if (reg.is_default_for === 'card' && !mapping.card) mapping.card = reg.id;
        if (reg.is_default_for === 'transfer' && !mapping.transfer) mapping.transfer = reg.id;
      });

      // Fallbacks if defaults aren't found
      const fallbackId = registers.length > 0 ? registers[0].id : 1;
      if (!mapping.cash) mapping.cash = fallbackId;
      if (!mapping.card) mapping.card = fallbackId;
      if (!mapping.transfer) mapping.transfer = fallbackId;

      return mapping;
    } catch (error) {
      console.warn('Could not retrieve payment register mapping, using default ID 1', error);
      return { cash: 1, card: 1, transfer: 1 };
    }
  },

  /**
   * Saves the provided mapping to DB (deprecated/no-op, kept for backwards compatibility)
   */
  saveMapping() {
    // No-op. We now strictly use db.cash_registers.is_default_for
  },

  /**
   * Helper function to get the specific register ID for a payment type.
   * @param {'cash' | 'card' | 'transfer'} paymentType 
   * @returns {Promise<number>} Register ID
   */
  async getRegisterForPayment(paymentType) {
    const mapping = await this.getMapping();
    return mapping[paymentType] || 1; // Fallback to 1
  }
};
