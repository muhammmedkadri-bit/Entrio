import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';

// Kalemleri zenginleştiren yardımcı (hem Dexie hem Supabase kullanır)
function enrichItems(items) {
  let subtotal = 0, discountTotal = 0, kdvTotal = 0, otvTotal = 0;
  const enriched = items.map(item => {
    const base     = Math.round(item.unit_price * item.quantity * 100) / 100;
    const discAmt  = item.discount_type === 'amount'
      ? Math.round(Math.min(item.discount_value || 0, base) * 100) / 100
      : Math.round(base * ((item.discount_value || 0) / 100) * 100) / 100;
    const discPct  = base > 0 ? Math.round((discAmt / base) * 10000) / 100 : 0;
    const afterDisc = Math.round((base - discAmt) * 100) / 100;
    const kdvAmt   = Math.round(afterDisc * ((item.kdv_rate || 0) / 100) * 100) / 100;
    const otvAmt   = Math.round(afterDisc * ((item.otv_rate || 0) / 100) * 100) / 100;
    const lineTotal = Math.round((afterDisc + kdvAmt + otvAmt) * 100) / 100;
    subtotal      += afterDisc;
    discountTotal += discAmt;
    kdvTotal      += kdvAmt;
    otvTotal      += otvAmt;
    return { product_id: item.product_id, name: item.name, quantity: item.quantity, unit: item.unit || 'adet', unit_price: item.unit_price, discount_percent: discPct, discount_amount: discAmt, kdv_rate: item.kdv_rate || 0, otv_rate: item.otv_rate || 0, kdv_amount: kdvAmt, otv_amount: otvAmt, line_total: lineTotal };
  });
  return {
    enrichedItems: enriched,
    subtotal:      Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    kdvTotal:      Math.round(kdvTotal * 100) / 100,
    otvTotal:      Math.round(otvTotal * 100) / 100,
    grandTotal:    Math.round((subtotal + kdvTotal + otvTotal) * 100) / 100
  };
}

export const purchaseService = {
  async create(purchaseData, items, paymentData) {
    try {
      const { enrichedItems, subtotal, discountTotal, kdvTotal, otvTotal, grandTotal } = enrichItems(items);
      const paidNow = Math.min(paymentData.paidNow || 0, grandTotal);

      if (isSupabase()) {
        const today = new Date().toISOString().split('T')[0];
        const pData = {
          ...purchaseData,
          subtotal, discount_amount: discountTotal, kdv_amount: kdvTotal, otv_amount: otvTotal,
          total_amount: grandTotal, paid_amount: paidNow,
          payment_method: paymentData.method || 'cash',
          invoice_date: purchaseData.invoice_date || today,
          due_date: purchaseData.due_date || today,
        };
        const { data, error } = await supabase.rpc('create_purchase', {
          p_purchase_data: pData,
          p_items:         enrichedItems,
          p_payment_data:  { ...paymentData, paidNow }
        });
        if (error) throw error;
        return { purchaseId: data.purchaseId, invoice_number: data.invoiceNumber, item_count: enrichedItems.length, status: 'success' };
      }

      // ── Dexie fallback ──
      return await db.transaction('rw',
        db.purchases, db.purchase_items, db.products, db.stock_movements,
        db.cash_transactions, db.cash_registers, db.supplier_transactions, db.suppliers,
        async () => {
          const now = Date.now();
          const today = new Date().toISOString().split('T')[0];
          const pData = {
            purchase_number: purchaseData.invoice_number || null, invoice_number: purchaseData.invoice_number || null,
            invoice_date: purchaseData.invoice_date || today, due_date: purchaseData.due_date || today,
            supplier_id: purchaseData.supplier_id || null, supplier_name: purchaseData.supplier_name || null,
            subtotal, discount_amount: discountTotal, kdv_amount: kdvTotal, otv_amount: otvTotal,
            total_amount: grandTotal, paid_amount: paidNow, payment_method: paymentData.method || 'cash',
            waybill_number: purchaseData.waybill_number || null, waybill_date: purchaseData.waybill_date || null,
            notes: purchaseData.notes || null, invoice_title: purchaseData.invoice_title || null,
            siparis_no: purchaseData.siparis_no || null, siparis_date: purchaseData.siparis_date || null,
            status: 'received', created_at: now,
          };
          const purchaseId = await db.purchases.add(pData);

          for (const item of enrichedItems) {
            await db.purchase_items.add({ purchase_id: purchaseId, ...item });
            const product = await db.products.get(item.product_id);
            if (product && product.track_stock !== false) {
              await db.products.update(item.product_id, { stock_quantity: Math.round((product.stock_quantity + item.quantity) * 1000) / 1000, purchase_price: item.unit_price });
              await db.stock_movements.add({ product_id: item.product_id, movement_type: 'purchase', quantity: item.quantity, unit_price: item.unit_price, reference_id: purchaseId, reference: pData.invoice_number || null, created_at: now });
            } else if (product) {
              await db.products.update(item.product_id, { purchase_price: item.unit_price });
            }
          }

          const findReg = async (defaultFor) => db.cash_registers.filter(r => r.is_default_for === defaultFor && r.is_active !== false).first();
          const saveCashTx = async (regId, amt, notes) => {
            await db.cash_transactions.add({ purchase_id: Number(purchaseId), register_id: regId, transaction_type: 'purchase_out', amount: amt, reference: pData.invoice_number || `ALI-${purchaseId}`, notes, created_at: now });
            const reg = await db.cash_registers.get(regId);
            if (reg) await db.cash_registers.update(regId, { current_balance: Math.round((reg.current_balance - amt) * 100) / 100 });
          };

          if (paymentData.method === 'split' && paymentData.splits && paidNow > 0) {
            for (const [key, def] of [['cash','cash'],['bank_transfer','transfer'],['credit_card','card']]) {
              const info = paymentData.splits[key]; const amt = parseFloat(info?.amount) || 0;
              if (amt > 0) { const reg = await findReg(def); if (reg) await saveCashTx(info.account_id || reg.id, amt, `${key} (Parçalı)`); }
            }
          } else if (paidNow > 0) {
            const def = paymentData.method === 'bank_transfer' ? 'transfer' : paymentData.method === 'credit_card' ? 'card' : 'cash';
            const reg = await findReg(def);
            if (reg) await saveCashTx(reg.id, paidNow, paymentData.method);
          }

          if (pData.supplier_id) {
            const supplier = await db.suppliers.get(pData.supplier_id);
            if (supplier) {
              let newBalance = Math.round((supplier.balance + grandTotal) * 100) / 100;
              await db.supplier_transactions.add({ supplier_id: pData.supplier_id, transaction_type: 'purchase', amount: grandTotal, balance_after: newBalance, reference_id: purchaseId, created_at: now });
              if (paidNow > 0 && paymentData.method === 'split' && paymentData.splits) {
                let offset = 100;
                for (const [key, label] of [['cash','Nakit'],['bank_transfer','Havale'],['credit_card','KK']]) {
                  const amt = parseFloat(paymentData.splits[key]?.amount) || 0;
                  if (amt > 0) { newBalance = Math.round((newBalance - amt) * 100) / 100; await db.supplier_transactions.add({ supplier_id: pData.supplier_id, transaction_type: 'payment', amount: amt, balance_after: newBalance, reference_id: purchaseId, notes: `${label} (Parçalı)`, created_at: now + offset }); offset += 100; }
                }
              } else if (paidNow > 0) {
                newBalance = Math.round((newBalance - paidNow) * 100) / 100;
                await db.supplier_transactions.add({ supplier_id: pData.supplier_id, transaction_type: 'payment', amount: paidNow, balance_after: newBalance, reference_id: purchaseId, notes: `Peşinat (${paymentData.method})`, created_at: now + 100 });
              }
              await db.suppliers.update(pData.supplier_id, { balance: newBalance });
            }
          }
          return { purchaseId, invoice_number: pData.invoice_number, item_count: enrichedItems.length, status: 'success' };
        }
      );
    } catch (error) {
      throw new Error('Alış kaydedilirken hata: ' + error.message);
    }
  },

  async getAll(filters = {}) {
    try {
      let purchases, suppliers;
      if (isSupabase()) {
        let q = supabase.from('purchases').select('*').order('created_at', { ascending: false });
        if (filters.supplier_id) q = q.eq('supplier_id', filters.supplier_id);
        const [{ data: p, error: pErr }, { data: s, error: sErr }] = await Promise.all([q, supabase.from('suppliers').select('id,name,phone,balance')]);
        if (pErr) throw pErr; if (sErr) throw sErr;
        purchases = p; suppliers = s;
      } else {
        purchases = (await db.purchases.toArray()).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        suppliers = await db.suppliers.toArray();
        if (filters.supplier_id) purchases = purchases.filter(p => p.supplier_id === filters.supplier_id);
      }

      const supMap = Object.fromEntries((suppliers || []).map(s => [s.id, s]));
      purchases = purchases.map(p => {
        const sup = supMap[p.supplier_id];
        const remaining = Math.round(((p.total_amount || 0) - (p.paid_amount || 0)) * 100) / 100;
        const payment_status = remaining <= 0 ? 'paid' : (p.paid_amount || 0) > 0 ? 'partial' : 'unpaid';
        return { ...p, supplier_name: sup?.name || p.supplier_name || null, supplier_phone: sup?.phone || null, supplier_balance: sup?.balance || 0, item_count: p.item_count || 0, remaining, payment_status, subtotal: p.subtotal || p.total_amount || 0 };
      });

      if (filters.payment_status && filters.payment_status !== 'all') purchases = purchases.filter(p => p.payment_status === filters.payment_status);
      if (filters.startDate && filters.endDate) {
        purchases = purchases.filter(p => {
          try { return isWithinInterval(p.invoice_date ? parseISO(p.invoice_date) : new Date(Number(p.created_at)), { start: filters.startDate, end: filters.endDate }); } catch { return true; }
        });
      }
      return purchases;
    } catch (e) { throw new Error('Alış faturaları getirilirken hata: ' + e.message); }
  },

  async getById(id) {
    try {
      let p, items, supplier;
      if (isSupabase()) {
        const [{ data: pur, error: pErr }, { data: itms, error: iErr }] = await Promise.all([
          supabase.from('purchases').select('*').eq('id', id).single(),
          supabase.from('purchase_items').select('*').eq('purchase_id', id)
        ]);
        if (pErr) throw pErr; if (iErr) throw iErr;
        p = pur; items = itms || [];
        if (p.supplier_id) { const { data: s } = await supabase.from('suppliers').select('*').eq('id', p.supplier_id).single(); supplier = s; }
      } else {
        p = await db.purchases.get(Number(id));
        if (!p) throw new Error('Fatura bulunamadı.');
        items = await db.purchase_items.where('purchase_id').equals(Number(id)).toArray();
        if (p.supplier_id) supplier = await db.suppliers.get(p.supplier_id);
      }
      const remaining = Math.round(((p.total_amount || 0) - (p.paid_amount || 0)) * 100) / 100;
      const payment_status = remaining <= 0 ? 'paid' : (p.paid_amount || 0) > 0 ? 'partial' : 'unpaid';
      return { ...p, supplier, supplier_name: supplier?.name || p.supplier_name || null, items, remaining, payment_status, subtotal: p.subtotal || p.total_amount || 0 };
    } catch (e) { throw e; }
  },

  async getMonthSummary() {
    try {
      const start = startOfMonth(new Date()); const end = endOfMonth(new Date());
      const all = isSupabase()
        ? (await supabase.from('purchases').select('total_amount,paid_amount,invoice_date,created_at')).data || []
        : await db.purchases.toArray();
      const thisMonth = all.filter(p => { try { return isWithinInterval(p.invoice_date ? parseISO(p.invoice_date) : new Date(Number(p.created_at)), { start, end }); } catch { return false; } });
      const totalAmount = thisMonth.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
      const paidAmount  = thisMonth.reduce((s, p) => s + (Number(p.paid_amount)  || 0), 0);
      return { count: thisMonth.length, totalAmount: Math.round(totalAmount * 100) / 100, paidAmount: Math.round(paidAmount * 100) / 100, pendingDebt: Math.round(Math.max(0, totalAmount - paidAmount) * 100) / 100 };
    } catch { return { count: 0, totalAmount: 0, paidAmount: 0, pendingDebt: 0 }; }
  },

  async cancel(id) {
    try {
      if (isSupabase()) {
        const { data: p } = await supabase.from('purchases').select('*').eq('id', id).single();
        if (!p || p.status === 'cancelled') throw new Error('İptal edilecek uygun fatura bulunamadı.');
        if (p.status === 'received') {
          const { data: items } = await supabase.from('purchase_items').select('*').eq('purchase_id', id);
          for (const item of (items || [])) {
            const { data: product } = await supabase.from('products').select('stock_quantity,track_stock').eq('id', item.product_id).single();
            if (product && product.track_stock !== false) {
              const newQty = Math.round((Number(product.stock_quantity) - item.quantity) * 1000) / 1000;
              await supabase.from('products').update({ stock_quantity: newQty }).eq('id', item.product_id);
              await supabase.from('stock_movements').insert([{ product_id: item.product_id, movement_type: 'adjustment_out', quantity: item.quantity, notes: `Fatura iptali (#${id})`, reference: p.invoice_number || `#${id}`, created_at: Date.now() }]);
            }
          }
        }
        const { error } = await supabase.from('purchases').update({ status: 'cancelled' }).eq('id', id);
        if (error) throw error; return true;
      }
      return await db.transaction('rw', db.purchases, db.purchase_items, db.products, db.stock_movements, async () => {
        const p = await db.purchases.get(Number(id));
        if (!p || p.status === 'cancelled') throw new Error('İptal edilecek uygun fatura bulunamadı.');
        if (p.status === 'received') {
          const items = await db.purchase_items.where('purchase_id').equals(Number(id)).toArray();
          for (const item of items) {
            const product = await db.products.get(item.product_id);
            if (product) { await db.products.update(item.product_id, { stock_quantity: Math.round((product.stock_quantity - item.quantity) * 1000) / 1000 }); await db.stock_movements.add({ product_id: item.product_id, movement_type: 'adjustment_out', quantity: item.quantity, notes: `Fatura iptali (#${id})`, reference: p.invoice_number || `#${id}`, created_at: Date.now() }); }
          }
        }
        await db.purchases.update(Number(id), { status: 'cancelled' }); return true;
      });
    } catch (e) { throw new Error('İptal işlemi başarısız: ' + e.message); }
  },

  async addPayment(purchaseId, amount, method, notes, accountId = null, date = null) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.rpc('add_purchase_payment', { p_purchase_id: purchaseId, p_amount: amount, p_method: method, p_notes: notes, p_account_id: accountId, p_date: date ? new Date(date).getTime() : null });
        if (error) throw error;
        return data.newPaid;
      }
      return await db.transaction('rw', db.purchases, db.suppliers, db.supplier_transactions, db.cash_transactions, db.cash_registers, async () => {
        const p = await db.purchases.get(Number(purchaseId));
        const txDate = date ? new Date(date).getTime() : Date.now();
        if (!p) throw new Error('Fatura bulunamadı.');
        const debt = Math.max(0, (p.total_amount || 0) - (p.paid_amount || 0));
        if (amount > debt + 0.001) throw new Error('Ödenen miktar toplamı aşamaz.');
        const newPaid = Math.round(((p.paid_amount || 0) + amount) * 100) / 100;
        await db.purchases.update(Number(purchaseId), { paid_amount: newPaid });
        if (p.supplier_id) {
          const supplier = await db.suppliers.get(p.supplier_id);
          if (supplier) { const newBalance = Math.round((supplier.balance - amount) * 100) / 100; await db.suppliers.update(p.supplier_id, { balance: newBalance }); await db.supplier_transactions.add({ supplier_id: p.supplier_id, transaction_type: 'payment', amount, balance_after: newBalance, reference_id: Number(purchaseId), notes: notes || method, created_at: txDate }); }
        }
        let reg = accountId ? await db.cash_registers.get(Number(accountId)) : await db.cash_registers.filter(r => r.is_default_for === (method === 'bank_transfer' ? 'transfer' : method === 'credit_card' ? 'card' : 'cash') && r.is_active !== false).first();
        if (reg) { const methodLabel = method === 'bank_transfer' ? 'Banka/Havale' : method === 'credit_card' ? 'Kredi Kartı' : 'Nakit Kasa'; await db.cash_transactions.add({ purchase_id: Number(purchaseId), register_id: reg.id, transaction_type: 'purchase_out', amount, notes: notes ? `${methodLabel}: ${notes}` : `${methodLabel} Ödemesi`, reference: p.invoice_number || `ALI-${purchaseId}`, created_at: txDate }); await db.cash_registers.update(reg.id, { current_balance: Math.round((reg.current_balance - amount) * 100) / 100 }); }
        return newPaid;
      });
    } catch (e) { throw new Error('Ödeme eklenirken hata: ' + e.message); }
  },

  async getByProductId(productId) {
    try {
      if (isSupabase()) {
        const { data: items, error: iErr } = await supabase.from('purchase_items').select('*').eq('product_id', productId);
        if (iErr) throw iErr;
        if (!items?.length) return [];
        const purchaseIds = [...new Set(items.map(i => i.purchase_id))];
        const [{ data: purchases }, { data: suppliers }] = await Promise.all([
          supabase.from('purchases').select('id,purchase_number,created_at,supplier_id,status').in('id', purchaseIds),
          supabase.from('suppliers').select('id,name')
        ]);
        const pMap = Object.fromEntries((purchases || []).map(p => [p.id, p]));
        const sMap = Object.fromEntries((suppliers || []).map(s => [s.id, s.name]));
        return items.map(pi => { const p = pMap[pi.purchase_id] || {}; return { ...pi, purchase_number: p.purchase_number || `A-${pi.purchase_id}`, created_at: p.created_at, supplier_name: sMap[p.supplier_id] || '—', status: p.status }; }).sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
      }
      const purchaseItems = await db.purchase_items.where('product_id').equals(Number(productId)).toArray();
      if (!purchaseItems.length) return [];
      const purchaseIds = [...new Set(purchaseItems.map(pi => pi.purchase_id))];
      const purchases = await Promise.all(purchaseIds.map(id => db.purchases.get(id)));
      const pMap = Object.fromEntries(purchases.filter(Boolean).map(p => [p.id, p]));
      const suppliers = await db.suppliers.toArray();
      const sMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
      return purchaseItems.map(pi => { const p = pMap[pi.purchase_id] || {}; return { ...pi, purchase_number: p.purchase_number || `A-${pi.purchase_id}`, created_at: p.created_at, supplier_name: sMap[p.supplier_id] || '—', status: p.status }; }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    } catch (e) { throw new Error('Alış geçmişi getirilirken hata: ' + e.message); }
  },

  async getPurchasePayments(purchaseId) {
    try {
      if (isSupabase()) {
        const { data: txs } = await supabase.from('cash_transactions').select('*,cash_registers(name)').eq('purchase_id', purchaseId).eq('transaction_type', 'purchase_out');
        const { data: regs } = await supabase.from('cash_registers').select('id,name');
        const regMap = Object.fromEntries((regs || []).map(r => [r.id, r.name]));
        return (txs || []).map(c => {
          const n = (c.notes || '').toLowerCase();
          const method = n.includes('kredi') ? 'Kredi Kartı' : n.includes('banka') || n.includes('havale') ? 'Havale/EFT' : 'Nakit Ödeme';
          return { id: `cash_${c.id}`, amount: c.amount, date: new Date(Number(c.created_at)).toISOString(), method, notes: c.notes || c.reference || 'Kasa çıkışı', register: regMap[c.register_id] || '—' };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      const allCash = await db.cash_transactions.toArray();
      const p = await db.purchases.get(Number(purchaseId));
      const refToken1 = `ali-${purchaseId}`;
      const refToken2 = p?.invoice_number ? String(p.invoice_number).toLowerCase().trim() : null;
      const cashPayments = allCash.filter(c => {
        if (c.transaction_type !== 'out' && c.transaction_type !== 'purchase_out') return false;
        if (c.purchase_id !== undefined && c.purchase_id !== null) return Number(c.purchase_id) === Number(purchaseId);
        const ref = (c.reference || '').toLowerCase().trim(); const notes = (c.notes || '').toLowerCase();
        return ref === refToken1 || (refToken2 && ref === refToken2) || notes.includes(refToken1) || (refToken2 && notes.includes(refToken2));
      });
      const allRegisters = await db.cash_registers.toArray();
      const regMap = Object.fromEntries(allRegisters.map(r => [r.id, r.name || r.type || 'Kasa']));
      return cashPayments.map(c => { const n = (c.notes || '').toLowerCase(); const method = n.includes('kredi') ? 'Kredi Kartı Ödemesi' : n.includes('banka') || n.includes('havale') ? 'Havale/EFT Ödemesi' : 'Nakit Ödeme'; return { id: `cash_${c.id}`, amount: c.amount, date: new Date(c.created_at).toISOString(), method, notes: c.notes || c.reference || 'Kasa çıkışı', register: c.register_id ? (regMap[c.register_id] || `Kasa #${c.register_id}`) : '—' }; }).sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) { return []; }
  },

  async updateCategory(purchaseId, categoryId) {
    try {
      if (isSupabase()) { const { error } = await supabase.from('purchases').update({ category_id: categoryId }).eq('id', purchaseId); if (error) throw error; return true; }
      await db.purchases.update(Number(purchaseId), { category_id: categoryId }); return true;
    } catch (e) { throw new Error('Kategori güncellenirken hata: ' + e.message); }
  }
};
