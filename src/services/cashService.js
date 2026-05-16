import { db } from '../db';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';

// ── Yardımcı: Supabase kasa kaydını getir ──────────────────────────────────
const _sbReg = async (id) => {
  const { data, error } = await supabase.from('cash_registers').select('*').eq('id', id).single();
  if (error) throw new Error('Kasa bulunamadı: ' + error.message);
  return data;
};

export const cashService = {
  async getRegisters() {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.from('cash_registers').select('*').eq('is_active', true);
        if (error) throw error;
        return data;
      }
      return await db.cash_registers.filter(r => r.is_active !== false).toArray();
    } catch (e) { throw new Error('Kasalar getirilirken hata oluştu.'); }
  },

  async getRegisterById(id) {
    try {
      if (isSupabase()) return await _sbReg(id);
      const reg = await db.cash_registers.get(Number(id));
      if (!reg || reg.is_active === false) throw new Error('Kasa bulunamadı.');
      return reg;
    } catch (e) { throw e; }
  },

  async createRegister(data) {
    try {
      const openingBalance = parseFloat(data.opening_balance) || 0;
      const isCreditCard = data.type === 'credit_card';
      const today = new Date().toISOString().split('T')[0];
      const initialBalance = isCreditCard ? -Math.abs(openingBalance) : openingBalance;
      const regData = {
        name: data.name, type: data.type || 'cash',
        current_balance: initialBalance, general_balance: initialBalance,
        last_day_close_date: today, is_active: true,
        ...(isCreditCard && { credit_limit: data.credit_limit || 0, billing_day: data.billing_day || null, due_day: data.due_day || null })
      };

      if (isSupabase()) {
        const { data: created, error } = await supabase.from('cash_registers').insert([regData]).select().single();
        if (error) throw error;
        if (!isCreditCard && openingBalance > 0) {
          await supabase.from('cash_transactions').insert([{ register_id: created.id, transaction_type: 'deposit_in', amount: openingBalance, balance_after: openingBalance, notes: 'İlk Kasa Kurulumu', created_at: Date.now() }]);
        }
        return created;
      }

      const id = await db.cash_registers.add(regData);
      if (!isCreditCard && openingBalance > 0) {
        await db.cash_transactions.add({ register_id: id, transaction_type: 'deposit_in', amount: openingBalance, balance_after: openingBalance, notes: 'İlk Kasa Kurulumu', created_at: Date.now() });
      }
      return { id, ...regData };
    } catch (e) { throw new Error('Kasa oluşturulurken hata oluştu: ' + e.message); }
  },

  async updateRegister(id, data) {
    try {
      if (isSupabase()) {
        const { error } = await supabase.from('cash_registers').update(data).eq('id', id);
        if (error) throw error;
        return true;
      }
      await db.cash_registers.update(Number(id), data);
      return true;
    } catch (e) { throw new Error('Kasa güncellenirken hata oluştu.'); }
  },

  async adjustBalance(registerId, newBalance, reason, resetGeneral = false) {
    try {
      if (isSupabase()) {
        const reg = await _sbReg(registerId);
        const diff = newBalance - (Number(reg.current_balance) || 0);
        if (diff === 0 && !resetGeneral) return true;
        const updateData = { current_balance: newBalance };
        if (resetGeneral) updateData.general_balance = newBalance;
        await supabase.from('cash_registers').update(updateData).eq('id', registerId);
        await supabase.from('cash_transactions').insert([{ register_id: registerId, transaction_type: 'balance_adjustment', amount: diff, balance_after: newBalance, notes: `Bakiye Düzeltme: ${reason || ''} (Eski Bakiye: ${reg.current_balance || 0}, Fark: ${diff})`, created_at: Date.now() }]);
        return true;
      }
      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        const reg = await db.cash_registers.get(Number(registerId));
        if (!reg) throw new Error('Kasa bulunamadı.');
        const diff = newBalance - (reg.current_balance || 0);
        if (diff === 0 && !resetGeneral) return true;
        const updateData = { current_balance: newBalance };
        if (resetGeneral) updateData.general_balance = newBalance;
        await db.cash_registers.update(Number(registerId), updateData);
        await db.cash_transactions.add({ register_id: Number(registerId), transaction_type: 'balance_adjustment', amount: diff, balance_after: newBalance, notes: `Bakiye Düzeltme: ${reason || ''} (Eski Bakiye: ${reg.current_balance || 0}, Fark: ${diff})`, created_at: Date.now() });
        return true;
      });
    } catch (e) { throw new Error('Bakiye düzeltme başarısız: ' + e.message); }
  },

  async resetRegister(registerId) {
    return this.adjustBalance(registerId, 0, 'Kasa Sıfırlama', true);
  },

  async deleteRegister(registerId) {
    try {
      if (isSupabase()) {
        const { count, error: cErr } = await supabase.from('cash_transactions').select('*', { count: 'exact', head: true }).eq('register_id', registerId);
        if (cErr) throw cErr;
        if (count > 0) throw new Error(`Bu kasada ${count} hareket bulunuyor. Silmek için önce hareketleri kaldırın ya da kasayı arşivleyin.`);
        const { error } = await supabase.from('cash_registers').delete().eq('id', registerId);
        if (error) throw error;
        return true;
      }
      const txCount = await db.cash_transactions.where('register_id').equals(Number(registerId)).count();
      if (txCount > 0) throw new Error(`Bu kasada ${txCount} hareket bulunuyor. Silmek için önce hareketleri kaldırın ya da kasayı arşivleyin.`);
      await db.cash_registers.delete(Number(registerId));
      return true;
    } catch (e) { throw e; }
  },

  async archiveRegister(registerId) {
    try {
      if (isSupabase()) {
        const { error } = await supabase.from('cash_registers').update({ is_active: false }).eq('id', registerId);
        if (error) throw error;
        return true;
      }
      await db.cash_registers.update(Number(registerId), { is_active: false });
      return true;
    } catch (e) { throw new Error('Kasa arşivlenirken hata oluştu.'); }
  },

  async setDefaultRegister(registerId) {
    try {
      const reg = await this.getRegisterById(registerId);
      let targetDefaultFor = null;
      if (reg.type === 'cash' || reg.type === 'general') targetDefaultFor = 'cash';
      else if (reg.type === 'pos' || reg.type === 'credit_card') targetDefaultFor = 'card';
      else if (reg.type === 'bank') targetDefaultFor = 'transfer';
      else throw new Error('Bu kasa tipi varsayılan ataması için uygun değil.');

      if (isSupabase()) {
        await supabase.from('cash_registers').update({ is_default_for: null }).eq('is_default_for', targetDefaultFor);
        await supabase.from('cash_registers').update({ is_default_for: targetDefaultFor }).eq('id', registerId);
        return true;
      }
      return await db.transaction('rw', db.cash_registers, async () => {
        const oldDefaults = await db.cash_registers.filter(r => r.is_default_for === targetDefaultFor).toArray();
        for (const r of oldDefaults) { if (r.id !== Number(registerId)) await db.cash_registers.update(r.id, { is_default_for: null }); }
        await db.cash_registers.update(Number(registerId), { is_default_for: targetDefaultFor });
        return true;
      });
    } catch (e) { throw new Error('Varsayılan kasa ayarlanamadı: ' + e.message); }
  },

  async transfer(sourceId, targetId, amount, description) {
    try {
      if (sourceId === targetId) throw new Error('Kaynak ve hedef kasa aynı olamaz.');
      if (amount <= 0) throw new Error('Transfer tutarı sıfırdan büyük olmalıdır.');

      if (isSupabase()) {
        const [sourceReg, targetReg] = await Promise.all([_sbReg(sourceId), _sbReg(targetId)]);
        const sourceGenBal = Number(sourceReg.general_balance ?? sourceReg.current_balance ?? 0);
        const sourceDailyNet = Number(sourceReg.current_balance ?? 0) - sourceGenBal;
        const genBalImpactOut = sourceDailyNet > 0 ? Math.max(0, amount - sourceDailyNet) : amount;
        const sourceNewBalance = Number(sourceReg.current_balance || 0) - amount;
        const targetNewBalance = Number(targetReg.current_balance || 0) + amount;
        const now = Date.now();

        await supabase.from('cash_registers').update({ current_balance: sourceNewBalance, general_balance: sourceGenBal - genBalImpactOut }).eq('id', sourceId);
        await supabase.from('cash_registers').update({ current_balance: targetNewBalance, general_balance: Number(targetReg.general_balance ?? targetReg.current_balance ?? 0) + amount }).eq('id', targetId);
        await supabase.from('cash_transactions').insert([
          { register_id: sourceId, transaction_type: 'transfer_out', amount, balance_after: sourceNewBalance, gen_bal_impact: -genBalImpactOut, notes: `Transfer: ${sourceReg.name} → ${targetReg.name}${description ? ' | ' + description : ''}`, created_at: now },
          { register_id: targetId, transaction_type: 'transfer_in', amount, balance_after: targetNewBalance, gen_bal_impact: amount, notes: `Transfer: ${targetReg.name} ← ${sourceReg.name}${description ? ' | ' + description : ''}`, created_at: now + 1 }
        ]);
        return true;
      }

      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        const sourceReg = await db.cash_registers.get(Number(sourceId));
        const targetReg = await db.cash_registers.get(Number(targetId));
        if (!sourceReg) throw new Error('Kaynak kasa bulunamadı.');
        if (!targetReg) throw new Error('Hedef kasa bulunamadı.');
        const sourceGenBal = sourceReg.general_balance ?? sourceReg.current_balance ?? 0;
        const sourceDailyNet = (sourceReg.current_balance ?? 0) - sourceGenBal;
        const genBalImpactOut = sourceDailyNet > 0 ? Math.max(0, amount - sourceDailyNet) : amount;
        const sourceNewBalance = (sourceReg.current_balance || 0) - amount;
        const targetNewBalance = (targetReg.current_balance || 0) + amount;
        const now = Date.now();
        await db.cash_registers.update(Number(sourceId), { current_balance: sourceNewBalance, general_balance: sourceGenBal - genBalImpactOut });
        await db.cash_registers.update(Number(targetId), { current_balance: targetNewBalance, general_balance: (targetReg.general_balance ?? targetReg.current_balance ?? 0) + amount });
        await db.cash_transactions.add({ register_id: Number(sourceId), transaction_type: 'transfer_out', amount, balance_after: sourceNewBalance, gen_bal_impact: -genBalImpactOut, notes: `Transfer: ${sourceReg.name} → ${targetReg.name}${description ? ' | ' + description : ''}`, created_at: now });
        await db.cash_transactions.add({ register_id: Number(targetId), transaction_type: 'transfer_in', amount, balance_after: targetNewBalance, gen_bal_impact: amount, notes: `Transfer: ${targetReg.name} ← ${sourceReg.name}${description ? ' | ' + description : ''}`, created_at: now + 1 });
        return true;
      });
    } catch (e) { throw new Error('Transfer işlemi başarısız: ' + e.message); }
  },

  async isRegisterOpen(registerId) { return true; },

  async creditCardPayment(creditRegId, sourceRegId, amount, notes, transactionDate) {
    try {
      if (amount <= 0) throw new Error('Ödeme tutarı sıfırdan büyük olmalıdır.');
      const dateVal = transactionDate ? new Date(transactionDate).getTime() : Date.now();
      
      if (isSupabase()) {
        const sourceReg = await _sbReg(sourceRegId);
        const creditReg = await _sbReg(creditRegId);
        
        let sourceNewBal = Number(sourceReg.current_balance || 0) - amount;
        await supabase.from('cash_registers').update({ current_balance: sourceNewBal }).eq('id', sourceRegId);
        await supabase.from('cash_transactions').insert([{ register_id: sourceRegId, transaction_type: 'expense_out', amount, balance_after: sourceNewBal, notes: `Kredi Kartı Ödemesi: ${creditReg.name}${notes ? ' - ' + notes : ''}`, created_at: dateVal }]);

        let creditNewBal = Number(creditReg.current_balance || 0) + amount;
        await supabase.from('cash_registers').update({ current_balance: creditNewBal }).eq('id', creditRegId);
        await supabase.from('cash_transactions').insert([{ register_id: creditRegId, transaction_type: 'deposit_in', amount, balance_after: creditNewBal, notes: `Ödeme Alındı: ${sourceReg.name}${notes ? ' - ' + notes : ''}`, created_at: dateVal + 1 }]);
        return true;
      }

      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        const sourceReg = await db.cash_registers.get(Number(sourceRegId));
        const creditReg = await db.cash_registers.get(Number(creditRegId));
        if (!sourceReg || !creditReg) throw new Error('Kasa bulunamadı.');

        let sourceNewBal = (sourceReg.current_balance || 0) - amount;
        await db.cash_registers.update(Number(sourceRegId), { current_balance: sourceNewBal });
        await db.cash_transactions.add({ register_id: Number(sourceRegId), transaction_type: 'expense_out', amount, balance_after: sourceNewBal, notes: `Kredi Kartı Ödemesi: ${creditReg.name}${notes ? ' - ' + notes : ''}`, created_at: dateVal });

        let creditNewBal = (creditReg.current_balance || 0) + amount;
        await db.cash_registers.update(Number(creditRegId), { current_balance: creditNewBal });
        await db.cash_transactions.add({ register_id: Number(creditRegId), transaction_type: 'deposit_in', amount, balance_after: creditNewBal, notes: `Ödeme Alındı: ${sourceReg.name}${notes ? ' - ' + notes : ''}`, created_at: dateVal + 1 });
        return true;
      });
    } catch (e) { throw new Error('Kredi kartı ödemesi kaydedilemedi: ' + e.message); }
  },

  async addTransaction(registerId, type, amount, description, transactionDate = null) {
    try {
      const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in'];
      const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out'];

      if (isSupabase()) {
        const reg = await _sbReg(registerId);
        let newBalance = Number(reg.current_balance) || 0;
        if (ins.includes(type) || type === 'in') newBalance += amount;
        else if (outs.includes(type) || type === 'out') newBalance -= amount;
        newBalance = Math.round(newBalance * 100) / 100;
        await supabase.from('cash_registers').update({ current_balance: newBalance }).eq('id', registerId);
        await supabase.from('cash_transactions').insert([{ register_id: registerId, transaction_type: type, amount, balance_after: newBalance, notes: description, created_at: transactionDate ? new Date(transactionDate).getTime() : Date.now() }]);
        return newBalance;
      }

      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        const reg = await db.cash_registers.get(Number(registerId));
        if (!reg) throw new Error('Kasa bulunamadı.');
        let newBalance = reg.current_balance || 0;
        if (ins.includes(type) || type === 'in') newBalance += amount;
        else if (outs.includes(type) || type === 'out') newBalance -= amount;
        newBalance = Math.round(newBalance * 100) / 100;
        await db.cash_registers.update(Number(registerId), { current_balance: newBalance });
        await db.cash_transactions.add({ register_id: Number(registerId), transaction_type: type, amount, balance_after: newBalance, notes: description, created_at: transactionDate ? new Date(transactionDate).getTime() : Date.now() });
        return newBalance;
      });
    } catch (e) { throw new Error('İşlem kaydedilemedi: ' + e.message); }
  },

  async getTransactions(registerId, filters = {}) {
    try {
      if (isSupabase()) {
        let query = supabase.from('cash_transactions').select('*').eq('register_id', registerId).order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        let txs = data;
        if (filters.startDate && filters.endDate) txs = txs.filter(t => isWithinInterval(Number(t.created_at), { start: filters.startDate, end: filters.endDate }));
        if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.transaction_type === filters.type);
        return txs;
      }
      let txs = await db.cash_transactions.where('register_id').equals(Number(registerId)).reverse().sortBy('created_at');
      if (filters.startDate && filters.endDate) txs = txs.filter(t => isWithinInterval(t.created_at, { start: filters.startDate, end: filters.endDate }));
      if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.transaction_type === filters.type);
      return txs;
    } catch (e) { throw new Error('İşlem geçmişi alınamadı.'); }
  },

  async getDailySummary(registerId, targetDate = new Date()) {
    try {
      const reg = await this.getRegisterById(registerId);
      const fromMs = reg.last_day_close_at
        ? (typeof reg.last_day_close_at === 'number' ? reg.last_day_close_at : new Date(reg.last_day_close_at).getTime())
        : 0;

      let effectiveTxs = [];
      if (isSupabase()) {
        const { data, error } = await supabase
          .from('cash_transactions')
          .select('*')
          .eq('register_id', registerId)
          .gt('created_at', fromMs)
          .neq('is_day_close', true);
        if (error) throw error;
        effectiveTxs = data || [];
      } else {
        const all = await db.cash_transactions.where('register_id').equals(Number(registerId)).toArray();
        effectiveTxs = all.filter(t => Number(t.created_at) > fromMs && !t.is_day_close);
      }

      const summary = {
        openingAmount: 0,
        totals: { sale_in: 0, customer_payment_in: 0, deposit_in: 0, return_in: 0, expense_out: 0, supplier_payment_out: 0, withdrawal_out: 0, purchase_out: 0, return_out: 0 },
        calculatedClosing: Number(reg?.current_balance) || 0,
      };
      const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in'];
      const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out'];
      effectiveTxs.forEach(t => {
        if (t.transaction_type !== 'opening' && t.transaction_type !== 'closing') {
          if (summary.totals[t.transaction_type] !== undefined) summary.totals[t.transaction_type] += Number(t.amount) || 0;
        }
      });
      return summary;
    } catch (e) { throw e; }
  },


  // deleteTransaction ve updateTransaction
  async deleteTransaction(id) {
    return await db.transaction('rw', [db.cash_transactions, db.cash_registers, db.suppliers, db.supplier_transactions, db.customers, db.customer_transactions, db.purchases, db.sales], async () => {
      const tx = await db.cash_transactions.get(id);
      if (!tx) throw new Error('Hareket bulunamadı.');
      const reg = await db.cash_registers.get(tx.register_id);
      if (!reg) throw new Error('İlgili kasa bulunamadı.');
      const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in', 'transfer_in'];
      const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'transfer_out'];
      let newRegBalance = reg.current_balance;
      let newGenBalance = reg.general_balance ?? reg.current_balance ?? 0;
      if (ins.includes(tx.transaction_type)) { newRegBalance -= tx.amount; if (tx.transaction_type === 'transfer_in') newGenBalance -= (tx.gen_bal_impact ?? tx.amount); }
      else if (outs.includes(tx.transaction_type)) { newRegBalance += tx.amount; if (tx.transaction_type === 'transfer_out') newGenBalance -= (tx.gen_bal_impact ?? 0); }
      await db.cash_registers.update(reg.id, { current_balance: Math.round(newRegBalance * 100) / 100, general_balance: Math.round(newGenBalance * 100) / 100 });
      if (tx.transaction_type === 'transfer_out' || tx.transaction_type === 'transfer_in') {
        const paired = await db.cash_transactions.where('amount').equals(tx.amount).filter(t => t.id !== id && Math.abs(t.created_at - tx.created_at) <= 2 && ((tx.transaction_type === 'transfer_out' && t.transaction_type === 'transfer_in') || (tx.transaction_type === 'transfer_in' && t.transaction_type === 'transfer_out'))).first();
        if (paired) {
          const pairedReg = await db.cash_registers.get(paired.register_id);
          if (pairedReg) {
            let pBal = pairedReg.current_balance; let pGen = pairedReg.general_balance ?? pairedReg.current_balance ?? 0;
            if (paired.transaction_type === 'transfer_in') { pBal -= paired.amount; pGen -= (paired.gen_bal_impact ?? paired.amount); }
            else { pBal += paired.amount; pGen -= (paired.gen_bal_impact ?? 0); }
            await db.cash_registers.update(pairedReg.id, { current_balance: Math.round(pBal * 100) / 100, general_balance: Math.round(pGen * 100) / 100 });
          }
          await db.cash_transactions.delete(paired.id);
        }
        await db.cash_transactions.delete(id); return true;
      }
      const now = Date.now();
      if (tx.transaction_type === 'supplier_payment_out' && tx.purchase_id) {
        const purchase = await db.purchases.get(tx.purchase_id);
        if (purchase) { const supplier = await db.suppliers.get(purchase.supplier_id); if (supplier) { const nb = (supplier.balance || 0) + tx.amount; await db.suppliers.update(supplier.id, { balance: Math.round(nb * 100) / 100 }); await db.supplier_transactions.add({ supplier_id: supplier.id, transaction_type: 'adjustment', amount: tx.amount, balance_after: Math.round(nb * 100) / 100, notes: `Kasa Üzerinden Ödeme İptali (İşlem: ${tx.id})`, created_at: now }); } }
      } else if (tx.transaction_type === 'customer_payment_in' && tx.reference_id) {
        const sale = await db.sales.get(tx.reference_id);
        if (sale) { const customer = await db.customers.get(sale.customer_id); if (customer) { const nb = (customer.balance || 0) + tx.amount; await db.customers.update(customer.id, { balance: Math.round(nb * 100) / 100 }); await db.customer_transactions.add({ customer_id: customer.id, transaction_type: 'adjustment', amount: tx.amount, balance_after: Math.round(nb * 100) / 100, notes: `Kasa Üzerinden Tahsilat İptali (İşlem: ${tx.id})`, created_at: now }); } }
      }
      await db.cash_transactions.delete(id); return true;
    });
  },

  async updateTransaction(id, data) {
    return await db.transaction('rw', [db.cash_transactions, db.cash_registers, db.suppliers, db.supplier_transactions, db.customers, db.customer_transactions, db.purchases, db.sales], async () => {
      const tx = await db.cash_transactions.get(id);
      if (!tx) throw new Error('Hareket bulunamadı.');
      const oldReg = await db.cash_registers.get(tx.register_id);
      if (!oldReg) throw new Error('İlgili kasa bulunamadı.');
      const newAmount = parseFloat(data.amount);
      const newRegisterId = data.register_id ? Number(data.register_id) : tx.register_id;
      const registerChanged = newRegisterId !== tx.register_id;
      const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in'];
      const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'transfer_out'];
      if (registerChanged) {
        let oldBal = oldReg.current_balance;
        if (ins.includes(tx.transaction_type)) oldBal -= tx.amount; else if (outs.includes(tx.transaction_type)) oldBal += tx.amount;
        await db.cash_registers.update(oldReg.id, { current_balance: Math.round(oldBal * 100) / 100 });
        const newReg = await db.cash_registers.get(newRegisterId);
        if (!newReg) throw new Error('Seçilen kasa bulunamadı.');
        let newBal = newReg.current_balance;
        if (ins.includes(tx.transaction_type)) newBal += newAmount; else if (outs.includes(tx.transaction_type)) newBal -= newAmount;
        await db.cash_registers.update(newReg.id, { current_balance: Math.round(newBal * 100) / 100 });
      } else {
        const diff = newAmount - tx.amount;
        if (diff !== 0) {
          let newBal = oldReg.current_balance;
          if (ins.includes(tx.transaction_type)) newBal += diff; else if (outs.includes(tx.transaction_type)) newBal -= diff;
          await db.cash_registers.update(oldReg.id, { current_balance: Math.round(newBal * 100) / 100 });
        }
      }
      const now = Date.now(); const diff = newAmount - tx.amount;
      if (diff !== 0) {
        if (tx.transaction_type === 'supplier_payment_out') {
          const purchase = tx.purchase_id ? await db.purchases.get(tx.purchase_id) : null;
          if (purchase) { const supplier = await db.suppliers.get(purchase.supplier_id); if (supplier) { const nb = (supplier.balance || 0) - diff; await db.suppliers.update(supplier.id, { balance: Math.round(nb * 100) / 100 }); await db.supplier_transactions.add({ supplier_id: supplier.id, transaction_type: 'adjustment', amount: Math.abs(diff), balance_after: Math.round(nb * 100) / 100, notes: 'Kasa Üzerinden Ödeme Tutarı Düzeltmesi', created_at: now }); } }
        } else if (tx.transaction_type === 'customer_payment_in') {
          const sale = tx.reference_id ? await db.sales.get(tx.reference_id) : null;
          if (sale) { const customer = await db.customers.get(sale.customer_id); if (customer) { const nb = (customer.balance || 0) - diff; await db.customers.update(customer.id, { balance: Math.round(nb * 100) / 100 }); await db.customer_transactions.add({ customer_id: customer.id, transaction_type: 'adjustment', amount: Math.abs(diff), balance_after: Math.round(nb * 100) / 100, notes: 'Kasa Üzerinden Tahsilat Tutarı Düzeltmesi', created_at: now }); } }
        }
      }
      const updatePayload = { amount: newAmount, notes: data.notes };
      if (registerChanged) updatePayload.register_id = newRegisterId;
      if (data.created_at) updatePayload.created_at = data.created_at;
      await db.cash_transactions.update(id, updatePayload); return true;
    });
  }
};
