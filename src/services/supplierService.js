import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { isWithinInterval } from 'date-fns';

export const supplierService = {
  async getAll(filters = {}) {
    try {
      if (isSupabase()) {
        let query = supabase.from('suppliers').select('*');
        if (filters.activeOnly !== false) query = query.eq('is_active', true);
        if (filters.search) {
          query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,tax_number.ilike.%${filters.search}%`);
        }
        const { data, error } = await query.order('name');
        if (error) throw error;
        let suppliers = data;
        if (filters.balanceStatus) {
          if (filters.balanceStatus === 'debt') suppliers = suppliers.filter(s => Number(s.balance) > 0);
          else if (filters.balanceStatus === 'credit') suppliers = suppliers.filter(s => Number(s.balance) < 0);
          else if (filters.balanceStatus === 'zero') suppliers = suppliers.filter(s => !s.balance || Number(s.balance) === 0);
        }
        return suppliers;
      }

      let suppliers = await db.suppliers.toArray();
      if (filters.activeOnly !== false) suppliers = suppliers.filter(s => s.is_active !== false);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        suppliers = suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)) || (s.tax_number && s.tax_number.includes(q)));
      }
      if (filters.balanceStatus) {
        let customFilter = () => true;
        if (filters.balanceStatus === 'debt') customFilter = s => s.balance > 0;
        else if (filters.balanceStatus === 'credit') customFilter = s => s.balance < 0;
        else if (filters.balanceStatus === 'zero') customFilter = s => s.balance === 0 || !s.balance;
        suppliers = suppliers.filter(customFilter);
      }
      return suppliers;
    } catch (error) {
      throw new Error('Tedarikçiler getirilirken bir hata oluştu.');
    }
  },

  async getById(id) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) throw new Error('Tedarikçi bulunamadı.');
        return data;
      }
      const supplier = await db.suppliers.get(Number(id));
      if (!supplier) throw new Error('Tedarikçi bulunamadı.');
      return supplier;
    } catch (error) {
      throw error;
    }
  },

  async create(data) {
    try {
      const openingBalance = parseFloat(data.opening_balance) || 0;
      // Sadece veritabanında olan kolonları alıyoruz
      const { city, district, address, opening_balance, ...validData } = data;
      const dataToSave = { ...validData, balance: openingBalance, is_active: true };

      if (isSupabase()) {
        const { data: created, error } = await supabase.from('suppliers').insert([dataToSave]).select().single();
        if (error) throw error;
        if (openingBalance !== 0) {
          await supabase.from('supplier_transactions').insert([{
            supplier_id: created.id, transaction_type: 'adjustment',
            amount: Math.abs(openingBalance), balance_after: openingBalance,
            notes: 'Açılış Bakiyesi', created_at: Date.now()
          }]);
        }
        return created;
      }

      return await db.transaction('rw', db.suppliers, db.supplier_transactions, async () => {
        const id = await db.suppliers.add(dataToSave);
        if (openingBalance !== 0) {
          await db.supplier_transactions.add({
            supplier_id: id, transaction_type: 'adjustment',
            amount: Math.abs(openingBalance), balance_after: openingBalance,
            notes: 'Açılış Bakiyesi', created_at: Date.now()
          });
        }
        return { id, ...dataToSave };
      });
    } catch (error) {
      throw new Error('Tedarikçi eklenirken hata oluştu.');
    }
  },

  async update(id, data) {
    try {
      const { city, district, address, opening_balance, ...validData } = data;
      const dataToSave = { ...validData };
      if (isSupabase()) {
        const { data: updated, error } = await supabase.from('suppliers').update(dataToSave).eq('id', id).select().single();
        if (error) throw error;
        return updated;
      }
      await db.suppliers.update(Number(id), dataToSave);
      return await this.getById(id);
    } catch (error) {
      throw new Error('Tedarikçi güncellenirken hata oluştu.');
    }
  },

  async delete(id) {
    try {
      const s = await this.getById(id);
      if (s.balance !== 0 && s.balance !== undefined) {
        throw new Error('Bakiyesi olan bir tedarikçi silinemez. Önce hesabı sıfırlamalısınız.');
      }
      if (isSupabase()) {
        const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
        if (error) throw error;
        return true;
      }
      await db.suppliers.update(Number(id), { is_active: false });
      return true;
    } catch (error) {
      throw error;
    }
  },

  async addTransaction(supplierId, type, amount, notes = '', referenceId = null) {
    try {
      if (isSupabase()) {
        const supplier = await this.getById(supplierId);
        let newBalance = Number(supplier.balance) || 0;
        if (type === 'purchase') newBalance += amount;
        else if (type === 'payment') newBalance -= amount;
        newBalance = Math.round(newBalance * 100) / 100;
        await supabase.from('suppliers').update({ balance: newBalance }).eq('id', supplierId);
        await supabase.from('supplier_transactions').insert([{
          supplier_id: supplierId, transaction_type: type,
          amount, balance_after: newBalance, notes,
          reference_id: referenceId, created_at: Date.now()
        }]);
        return newBalance;
      }

      return await db.transaction('rw', db.suppliers, db.supplier_transactions, async () => {
        const supplier = await db.suppliers.get(Number(supplierId));
        if (!supplier) throw new Error('Tedarikçi bulunamadı.');
        let newBalance = supplier.balance || 0;
        if (type === 'purchase') newBalance += amount;
        else if (type === 'payment') newBalance -= amount;
        newBalance = Math.round(newBalance * 100) / 100;
        await db.suppliers.update(Number(supplierId), { balance: newBalance });
        await db.supplier_transactions.add({ supplier_id: Number(supplierId), transaction_type: type, amount, balance_after: newBalance, notes, reference_id: referenceId, created_at: Date.now() });
        return newBalance;
      });
    } catch (error) {
      throw new Error('Tedarikçi işlemi kaydedilirken hata: ' + error.message);
    }
  },

  /**
   * FIFO Ödeme Dağıtım Motoru
   * Tedarikçiye yapılan toplu ödemeyi, en eski açık faturadan itibaren
   * sırayla uygular. Fazla ödeme cari avans olarak kaydedilir.
   */
  async makePayment(supplierId, totalAmount, method, registerId, description, passthroughIncome = false) {
    if (isSupabase()) {
      const supplier = await this.getById(supplierId);
      if (!supplier) throw new Error('Tedarikçi bulunamadı.');
      const amt = Number(Number(totalAmount).toFixed(2));
      if (amt <= 0) throw new Error('Geçersiz ödeme tutarı.');
      const now = Date.now();

      // 1. Açık faturaları çek
      const { data: allPurchases, error: pErr } = await supabase
        .from('purchases').select('*').eq('supplier_id', supplierId).neq('status', 'cancelled').order('created_at', { ascending: true });
      if (pErr) throw pErr;
      const openPurchases = (allPurchases || []).filter(p => Number(((p.total_amount || 0) - (p.paid_amount || 0)).toFixed(2)) > 0.001);

      // 2. FIFO dağıtım
      let remaining = amt;
      const allocations = [];
      for (const purchase of openPurchases) {
        if (remaining <= 0) break;
        const purchaseDebt = Number(((Number(purchase.total_amount) || 0) - (Number(purchase.paid_amount) || 0)).toFixed(2));
        const applied = Number(Math.min(remaining, purchaseDebt).toFixed(2));
        const newPaid = Number(((Number(purchase.paid_amount) || 0) + applied).toFixed(2));
        await supabase.from('purchases').update({ paid_amount: newPaid }).eq('id', purchase.id);
        allocations.push({ purchase_id: purchase.id, applied, invoice_number: purchase.invoice_number || null, invoice_title: purchase.invoice_title || null });
        remaining = Number((remaining - applied).toFixed(2));
      }

      // 3. Tedarikçi bakiyesi
      const newSupplierBalance = Number(((Number(supplier.balance) || 0) - amt).toFixed(2));
      await supabase.from('suppliers').update({ balance: newSupplierBalance }).eq('id', supplierId);

      // 4. Supplier transactions
      let runningBal = Number(supplier.balance) || 0;
      const baseNotes = (description || '').trim();
      for (let i = 0; i < allocations.length; i++) {
        const alloc = allocations[i];
        runningBal = Number((runningBal - alloc.applied).toFixed(2));
        const invoiceRef = alloc.invoice_number ? `${alloc.invoice_number}` : `Fatura #${alloc.purchase_id}`;
        const invoiceTitle = alloc.invoice_title || 'Alış Faturası';
        await supabase.from('supplier_transactions').insert([{
          supplier_id: supplierId, transaction_type: 'payment', amount: alloc.applied,
          balance_after: runningBal, reference_id: alloc.purchase_id, payment_method: method,
          notes: baseNotes ? `${baseNotes} ← ${invoiceRef} (${invoiceTitle})` : `${invoiceRef} — ${invoiceTitle}`,
          created_at: now + i * 10
        }]);
      }
      if (remaining > 0.001) {
        runningBal = Number((runningBal - remaining).toFixed(2));
        await supabase.from('supplier_transactions').insert([{
          supplier_id: supplierId, transaction_type: 'payment', amount: remaining,
          balance_after: runningBal, payment_method: method,
          notes: baseNotes ? `${baseNotes} (Cari Avans)` : 'Cari Avans — Fazla Ödeme',
          created_at: now + allocations.length * 10
        }]);
      }

      // 5. Kasa hareketi
      const methodToDefaultFor = { 'Nakit': 'cash', 'Kredi Kartı': 'card', 'Banka Havalesi / EFT': 'transfer', 'Çek': null };
      const defaultFor = methodToDefaultFor[method] ?? 'cash';
      let reg = null;
      if (registerId) {
        const { data: r } = await supabase.from('cash_registers').select('*').eq('id', registerId).single();
        reg = r;
      }
      if (!reg && defaultFor) {
        const { data: r } = await supabase.from('cash_registers').select('*').eq('is_default_for', defaultFor).eq('is_active', true).limit(1).single();
        reg = r;
      }
      if (reg) {
        const methodLabel = method === 'Nakit' ? 'Nakit Kasa' : method === 'Kredi Kartı' ? 'Kredi Kartı' : method === 'Banka Havalesi / EFT' ? 'Havale/EFT' : method;
        if (passthroughIncome) {
          await supabase.from('cash_transactions').insert([{ register_id: reg.id, transaction_type: 'pos_card_in', amount: amt, notes: `Müşteri Kredi Kartı Tahsilatı → ${supplier.name} ödemesine yönlendirme`, created_at: now - 1 }]);
          await supabase.from('cash_registers').update({ current_balance: Number(((Number(reg.current_balance) || 0) + amt).toFixed(2)) }).eq('id', reg.id);
          const { data: freshReg } = await supabase.from('cash_registers').select('current_balance').eq('id', reg.id).single();
          reg = { ...reg, current_balance: freshReg?.current_balance };
        }
        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i];
          const invoiceRef = alloc.invoice_number || `Fatura #${alloc.purchase_id}`;
          await supabase.from('cash_transactions').insert([{
            purchase_id: Number(alloc.purchase_id), register_id: reg.id,
            transaction_type: 'supplier_payment_out', amount: alloc.applied,
            reference: alloc.invoice_number || `ALI-${alloc.purchase_id}`,
            notes: baseNotes ? `${methodLabel}: ${baseNotes} (${invoiceRef})` : `${methodLabel} Ödemesi (${invoiceRef})`,
            created_at: now + i * 5
          }]);
        }
        await supabase.from('cash_registers').update({ current_balance: Number(((Number(reg.current_balance) || 0) - amt).toFixed(2)) }).eq('id', reg.id);
      }

      return { totalPaid: amt, allocations, overpayment: remaining > 0.001 ? remaining : 0, newBalance: newSupplierBalance };
    }

    // ── Dexie fallback ──────────────────────────────────────────────────────
    const tables = [db.suppliers, db.supplier_transactions, db.purchases, db.cash_transactions, db.cash_registers];
    return await db.transaction('rw', tables, async () => {
      const supplier = await db.suppliers.get(Number(supplierId));
      if (!supplier) throw new Error('Tedarikçi bulunamadı.');
      const amt = Number(Number(totalAmount).toFixed(2));
      if (amt <= 0) throw new Error('Geçersiz ödeme tutarı.');
      const now = Date.now();
      const allPurchases = await db.purchases.where('supplier_id').equals(Number(supplierId)).filter(p => p.status !== 'cancelled' && Number(((p.total_amount || 0) - (p.paid_amount || 0)).toFixed(2)) > 0.001).toArray();
      allPurchases.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      let remaining = amt;
      const allocations = [];
      for (const purchase of allPurchases) {
        if (remaining <= 0) break;
        const purchaseDebt = Number(((purchase.total_amount || 0) - (purchase.paid_amount || 0)).toFixed(2));
        const applied = Number(Math.min(remaining, purchaseDebt).toFixed(2));
        const newPaid = Number(((purchase.paid_amount || 0) + applied).toFixed(2));
        await db.purchases.update(purchase.id, { paid_amount: newPaid });
        allocations.push({ purchase_id: purchase.id, applied, invoice_number: purchase.invoice_number || null, invoice_title: purchase.invoice_title || null });
        remaining = Number((remaining - applied).toFixed(2));
      }
      const newSupplierBalance = Number(((supplier.balance || 0) - amt).toFixed(2));
      await db.suppliers.update(Number(supplierId), { balance: newSupplierBalance });
      let runningBal = parseFloat(supplier.balance) || 0;
      const baseNotes = (description || '').trim();
      for (let i = 0; i < allocations.length; i++) {
        const alloc = allocations[i];
        runningBal = Number((runningBal - alloc.applied).toFixed(2));
        const invoiceRef = alloc.invoice_number ? `${alloc.invoice_number}` : `Fatura #${alloc.purchase_id}`;
        const invoiceTitle = alloc.invoice_title || 'Alış Faturası';
        await db.supplier_transactions.add({ supplier_id: Number(supplierId), transaction_type: 'payment', amount: alloc.applied, balance_after: runningBal, reference_id: alloc.purchase_id, payment_method: method, notes: baseNotes ? `${baseNotes} ← ${invoiceRef} (${invoiceTitle})` : `${invoiceRef} — ${invoiceTitle}`, created_at: now + i * 10 });
      }
      if (remaining > 0.001) {
        runningBal = Number((runningBal - remaining).toFixed(2));
        await db.supplier_transactions.add({ supplier_id: Number(supplierId), transaction_type: 'payment', amount: remaining, balance_after: runningBal, payment_method: method, notes: baseNotes ? `${baseNotes} (Cari Avans)` : 'Cari Avans — Fazla Ödeme', created_at: now + allocations.length * 10 });
      }
      const methodToDefaultFor = { 'Nakit': 'cash', 'Kredi Kartı': 'card', 'Banka Havalesi / EFT': 'transfer', 'Çek': null };
      const defaultFor = methodToDefaultFor[method] ?? 'cash';
      let reg = null;
      if (registerId) reg = await db.cash_registers.get(Number(registerId));
      if (!reg && defaultFor) reg = await db.cash_registers.filter(r => r.is_default_for === defaultFor && r.is_active !== false).first();
      if (reg) {
        const methodLabel = method === 'Nakit' ? 'Nakit Kasa' : method === 'Kredi Kartı' ? 'Kredi Kartı' : method === 'Banka Havalesi / EFT' ? 'Havale/EFT' : method;
        if (passthroughIncome) {
          await db.cash_transactions.add({ register_id: reg.id, transaction_type: 'pos_card_in', amount: amt, notes: `Müşteri Kredi Kartı Tahsilatı → ${supplier.name} ödemesine yönlendirme`, created_at: now - 1 });
          const tmpBalance = Number(((reg.current_balance || 0) + amt).toFixed(2));
          await db.cash_registers.update(reg.id, { current_balance: tmpBalance });
          reg = { ...reg, current_balance: tmpBalance };
        }
        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i];
          const invoiceRef = alloc.invoice_number || `Fatura #${alloc.purchase_id}`;
          await db.cash_transactions.add({ purchase_id: Number(alloc.purchase_id), register_id: reg.id, transaction_type: 'supplier_payment_out', amount: alloc.applied, reference: alloc.invoice_number || `ALI-${alloc.purchase_id}`, notes: baseNotes ? `${methodLabel}: ${baseNotes} (${invoiceRef})` : `${methodLabel} Ödemesi (${invoiceRef})`, created_at: now + i * 5 });
        }
        await db.cash_registers.update(reg.id, { current_balance: Number((reg.current_balance - amt).toFixed(2)) });
      }
      return { totalPaid: amt, allocations, overpayment: remaining > 0.001 ? remaining : 0, newBalance: newSupplierBalance };
    });
  },

  async getTransactions(supplierId, filters = {}) {
    try {
      if (isSupabase()) {
        let query = supabase.from('supplier_transactions').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        let txs = data;
        if (filters.startDate && filters.endDate) txs = txs.filter(t => isWithinInterval(Number(t.created_at), { start: filters.startDate, end: filters.endDate }));
        if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.transaction_type === filters.type);
        // Enrich with invoice info from purchases
        const purchaseIds = [...new Set(txs.filter(t => t.transaction_type === 'purchase' && t.reference_id).map(t => Number(t.reference_id)))];
        let invoiceMap = {};
        if (purchaseIds.length > 0) {
          const { data: purchases } = await supabase.from('purchases').select('id,invoice_number,invoice_title').in('id', purchaseIds);
          (purchases || []).forEach(p => { invoiceMap[p.id] = { invoice_number: p.invoice_number || null, invoice_title: p.invoice_title || null }; });
        }
        return txs.map(t => {
          const info = (t.transaction_type === 'purchase' && t.reference_id) ? (invoiceMap[Number(t.reference_id)] || {}) : {};
          return { ...t, invoice_number: t.invoice_number || info.invoice_number || null, invoice_title: t.invoice_title || info.invoice_title || null };
        });
      }

      let txs = await db.supplier_transactions.where('supplier_id').equals(Number(supplierId)).toArray();
      txs.sort((a, b) => b.created_at - a.created_at);
      if (filters.startDate && filters.endDate) txs = txs.filter(t => isWithinInterval(t.created_at, { start: filters.startDate, end: filters.endDate }));
      if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.transaction_type === filters.type);
      const purchaseIds = [...new Set(txs.filter(t => t.transaction_type === 'purchase' && t.reference_id).map(t => Number(t.reference_id)))];
      let invoiceMap = {};
      if (purchaseIds.length > 0) {
        const purchases = await Promise.all(purchaseIds.map(pid => db.purchases.get(pid).catch(() => null)));
        purchases.forEach(p => { if (p) invoiceMap[p.id] = { invoice_number: p.invoice_number || null, invoice_title: p.invoice_title || null }; });
      }
      return txs.map(t => {
        const info = (t.transaction_type === 'purchase' && t.reference_id) ? (invoiceMap[Number(t.reference_id)] || {}) : {};
        return { ...t, invoice_number: info.invoice_number || null, invoice_title: info.invoice_title || null };
      });
    } catch (error) {
      throw new Error('İşlem geçmişi getirilirken hata oluştu.');
    }
  },

  async collectFromSupplier(supplierId, amount, type, method, registerId, date, description) {
    try {
      const supplier = await this.getById(supplierId);
      const currentBalance = parseFloat(supplier.balance) || 0;
      if (currentBalance >= 0) throw new Error('Tedarikçide tahsil edilecek alacak bulunmuyor.');
      const maxCollectable = Math.abs(currentBalance);
      if (amount > maxCollectable + 0.001) throw new Error(`Tahsilat tutarı alacak tutarını (${maxCollectable.toFixed(2)}₺) aşamaz.`);
      const newBalance = Math.round((currentBalance + amount) * 100) / 100;

      if (isSupabase()) {
        await supabase.from('suppliers').update({ balance: newBalance }).eq('id', supplierId);
        await supabase.from('supplier_transactions').insert([{
          supplier_id: supplierId, transaction_type: type === 'offset' ? 'offset' : 'collection',
          amount, balance_after: newBalance, payment_method: type === 'cash_collection' ? method : 'offset',
          transaction_date: date || new Date().toISOString().split('T')[0],
          notes: description || (type === 'offset' ? 'Mahsuplaşma' : `Tahsilat (${method})`),
          created_at: Date.now()
        }]);
        if (type === 'cash_collection' && registerId) {
          const regId = parseInt(registerId);
          await supabase.from('cash_transactions').insert([{ register_id: regId, transaction_type: 'deposit_in', amount, notes: `Tedarikçi Tahsilatı: ${supplier.name}`, created_at: Date.now() }]);
          const { data: reg } = await supabase.from('cash_registers').select('current_balance').eq('id', regId).single();
          if (reg) await supabase.from('cash_registers').update({ current_balance: Math.round((Number(reg.current_balance) + amount) * 100) / 100 }).eq('id', regId);
        }
        return newBalance;
      }

      const tables = [db.suppliers, db.supplier_transactions];
      if (type === 'cash_collection') tables.push(db.cash_transactions, db.cash_registers);
      return await db.transaction('rw', tables, async () => {
        await db.suppliers.update(Number(supplierId), { balance: newBalance });
        await db.supplier_transactions.add({ supplier_id: Number(supplierId), transaction_type: type === 'offset' ? 'offset' : 'collection', amount, balance_after: newBalance, payment_method: type === 'cash_collection' ? method : 'offset', transaction_date: date || new Date().toISOString().split('T')[0], notes: description || (type === 'offset' ? 'Mahsuplaşma' : `Tahsilat (${method})`), created_at: Date.now() });
        if (type === 'cash_collection' && registerId) {
          const regId = parseInt(registerId);
          await db.cash_transactions.add({ register_id: regId, transaction_type: 'deposit_in', amount, notes: `Tedarikçi Tahsilatı: ${supplier.name}`, created_at: Date.now() });
          const reg = await db.cash_registers.get(regId);
          if (reg) await db.cash_registers.update(regId, { current_balance: Math.round((reg.current_balance + amount) * 100) / 100 });
        }
        return newBalance;
      });
    } catch (error) {
      throw new Error('Tahsilat kaydedilirken hata oluştu: ' + error.message);
    }
  },

  async getSummary() {
    try {
      const suppliers = await this.getAll();
      let totalDebt = 0;
      let totalReceivable = 0;
      suppliers.forEach(s => {
        const bal = parseFloat(s.balance) || 0;
        if (bal > 0) totalDebt += bal;
        else if (bal < 0) totalReceivable += Math.abs(bal);
      });
      return { totalCount: suppliers.length, totalDebt, totalReceivable, netBalance: totalDebt - totalReceivable };
    } catch (error) {
      return { totalCount: 0, totalDebt: 0, totalReceivable: 0, netBalance: 0 };
    }
  }
};
