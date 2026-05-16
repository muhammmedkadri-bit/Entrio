import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { isWithinInterval } from 'date-fns';

export const saleService = {
  async create(saleData, saleItems, paymentData) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.rpc('create_sale', {
          p_sale_data:    saleData,
          p_items:        saleItems,
          p_payment_data: paymentData
        });
        if (error) throw error;
        return { saleId: data.saleId, saleNumber: data.saleNumber };
      }

      // ── Dexie fallback ──────────────────────────────────────────────
      return await db.transaction('rw',
        db.sales, db.sale_items, db.products, db.stock_movements,
        db.cash_transactions, db.cash_registers,
        db.customers, db.customer_transactions,
      async () => {
        const now = Date.now();
        const pCash     = paymentData.cashAmount     || 0;
        const pCard     = paymentData.cardAmount      || 0;
        const pTransfer = paymentData.transferAmount  || 0;
        const pCredit   = paymentData.creditAmount    || 0;
        const paidNow   = pCash + pCard + pTransfer;

        const saleStatus = pCredit > 0 && paidNow === 0 ? 'pending'
          : pCredit > 0 ? 'partial' : 'completed';

        const newSaleId = await db.sales.add({
          ...saleData,
          paid_amount:    paidNow,
          payment_method: paymentData.method,
          status:         saleStatus,
          created_at:     now
        });
        const saleNumber = `SAT-${new Date().getFullYear().toString().slice(-2)}${String(newSaleId).padStart(5, '0')}`;
        await db.sales.update(newSaleId, { sale_number: saleNumber });

        const findReg = async (defaultFor) =>
          db.cash_registers.filter(r => r.is_default_for === defaultFor && r.is_active !== false).first();

        for (const item of saleItems) {
          await db.sale_items.add({ sale_id: newSaleId, ...item });
          const product = await db.products.get(Number(item.product_id));
          if (product && product.track_stock !== false) {
            const newQty = Math.round((product.stock_quantity - item.quantity) * 1000) / 1000;
            await db.products.update(Number(item.product_id), { stock_quantity: newQty });
            await db.stock_movements.add({ product_id: Number(item.product_id), movement_type: 'sale', quantity: item.quantity, unit_price: item.unit_price, item_discount: item.discount || 0, reference: saleNumber, created_at: now });
          }
        }

        // Müşteri borç bakiyesi
        if (pCredit > 0 && saleData.customer_id && saleData.customer_id !== 1) {
          const customer = await db.customers.get(Number(saleData.customer_id));
          if (customer) {
            const newBalance = Math.round((customer.balance + pCredit) * 100) / 100;
            await db.customers.update(Number(saleData.customer_id), { balance: newBalance });
            await db.customer_transactions.add({ customer_id: Number(saleData.customer_id), transaction_type: 'sale', amount: pCredit, balance_after: newBalance, reference_id: newSaleId, sale_number: saleNumber, notes: 'Veresiye Satış', created_at: now });
          }
        }

        // Kasa hareketleri
        const overrideRegId = paymentData.overrideRegisterId ? Number(paymentData.overrideRegisterId) : null;
        const addCashTx = async (defaultFor, amount, label) => {
          if (amount <= 0) return;
          const reg = overrideRegId ? await db.cash_registers.get(overrideRegId) : await findReg(defaultFor);
          if (reg) {
            await db.cash_registers.update(reg.id, { current_balance: Math.round((reg.current_balance + amount) * 100) / 100 });
            await db.cash_transactions.add({ reference_id: newSaleId, register_id: reg.id, transaction_type: 'sale_in', amount, notes: `${label}: ${saleNumber}`, created_at: now });
          }
        };
        await addCashTx('cash', pCash, 'Nakit Satış');
        await addCashTx('card', pCard, 'Kredi Kartı Satış');
        await addCashTx('transfer', pTransfer, 'Havale/EFT Satış');

        return { saleId: newSaleId, saleNumber };
      });
    } catch (error) {
      throw new Error('Satış kaydedilirken hata: ' + error.message);
    }
  },

  async createReturn(returnData, returnItems, paymentData) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.rpc('create_sale_return', {
          p_return_data:  returnData,
          p_items:        returnItems,
          p_payment_data: paymentData
        });
        if (error) throw error;
        return { returnId: data.returnId, returnNumber: data.returnNumber };
      }

      // ── Dexie fallback ──
      return await db.transaction('rw',
        db.sales, db.sale_items, db.products, db.stock_movements,
        db.cash_transactions, db.cash_registers,
        db.customers, db.customer_transactions,
      async () => {
        const now = Date.now();
        const returnId = await db.sales.add({ ...returnData, payment_method: paymentData.method, paid_amount: returnData.total_amount, status: 'return', created_at: now });
        const returnNumber = `IAD-${new Date().getFullYear().toString().slice(-2)}${String(returnId).padStart(5, '0')}`;
        await db.sales.update(returnId, { sale_number: returnNumber });

        for (const item of returnItems) {
          await db.sale_items.add({ sale_id: returnId, ...item });
          const product = await db.products.get(Number(item.product_id));
          if (product && product.track_stock !== false) {
            const newQty = Math.round((product.stock_quantity + item.quantity) * 1000) / 1000;
            await db.products.update(Number(item.product_id), { stock_quantity: newQty });
            await db.stock_movements.add({ product_id: Number(item.product_id), movement_type: 'return_in', quantity: item.quantity, unit_price: item.unit_price, reference: returnNumber, created_at: now });
          }
        }

        if ((paymentData.method === 'cash' || paymentData.method === 'mixed')) {
          const reg = await db.cash_registers.filter(r => r.is_default_for === 'cash' && r.is_active !== false).first();
          if (reg) {
            await db.cash_registers.update(reg.id, { current_balance: Math.round((reg.current_balance - returnData.total_amount) * 100) / 100 });
            await db.cash_transactions.add({ reference_id: returnId, register_id: reg.id, transaction_type: 'return_out', amount: returnData.total_amount, notes: 'Nakit İade: ' + returnNumber, created_at: now });
          }
        }

        if (paymentData.method === 'credit' && returnData.customer_id && returnData.customer_id !== 1) {
          const customer = await db.customers.get(Number(returnData.customer_id));
          if (customer) {
            const newBalance = Math.round((customer.balance - returnData.total_amount) * 100) / 100;
            await db.customers.update(Number(returnData.customer_id), { balance: newBalance });
            await db.customer_transactions.add({ customer_id: Number(returnData.customer_id), transaction_type: 'return', amount: returnData.total_amount, balance_after: newBalance, reference_id: returnId, sale_number: returnNumber, notes: 'Satış İadesi', created_at: now });
          }
        }

        return { returnId, returnNumber };
      });
    } catch (error) {
      throw new Error('İade kaydedilirken hata: ' + error.message);
    }
  },

  async getAll(filters = {}) {
    try {
      if (isSupabase()) {
        let query = supabase.from('sales').select('*').order('created_at', { ascending: false });
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
        const { data, error } = await query;
        if (error) throw error;
        let sales = data;
        if (filters.startDate && filters.endDate) {
          sales = sales.filter(s => isWithinInterval(Number(s.created_at), { start: filters.startDate, end: filters.endDate }));
        }
        return sales;
      }
      let sales = await db.sales.orderBy('created_at').reverse().toArray();
      if (filters.status) sales = sales.filter(s => s.status === filters.status);
      if (filters.customer_id) sales = sales.filter(s => s.customer_id === filters.customer_id);
      if (filters.startDate && filters.endDate) sales = sales.filter(s => isWithinInterval(Number(s.created_at), { start: filters.startDate, end: filters.endDate }));
      return sales;
    } catch (e) { throw new Error('Satışlar getirilirken hata: ' + e.message); }
  },

  async getById(id) {
    try {
      if (isSupabase()) {
        const [{ data: sale, error: sErr }, { data: items, error: iErr }] = await Promise.all([
          supabase.from('sales').select('*').eq('id', id).single(),
          supabase.from('sale_items').select('*').eq('sale_id', id)
        ]);
        if (sErr) throw sErr; if (iErr) throw iErr;
        return { ...sale, items: items || [] };
      }
      const sale = await db.sales.get(Number(id));
      if (!sale) throw new Error('Satış bulunamadı.');
      const items = await db.sale_items.where('sale_id').equals(Number(id)).toArray();
      return { ...sale, items };
    } catch (e) { throw e; }
  },

  async getSalePayments(saleId) {
    try {
      if (isSupabase()) {
        // Fetch direct payment transactions
        const { data: direct, error } = await supabase.from('cash_transactions').select('*').eq('reference_id', saleId);
        if (error) throw error;

        // Fetch any return sales linked to this original sale
        const { data: retSales } = await supabase
          .from('sales')
          .select('id')
          .eq('original_sale_id', saleId)
          .eq('status', 'returned');

        let returnTxs = [];
        if (retSales && retSales.length > 0) {
          for (const ret of retSales) {
            const { data: rtx } = await supabase
              .from('cash_transactions')
              .select('*')
              .eq('reference_id', ret.id)
              .eq('transaction_type', 'return_out');
            if (rtx) returnTxs = [...returnTxs, ...rtx.map(t => ({ ...t, isReturn: true }))];
          }
        }

        const allTxs = [...(direct || []), ...returnTxs];
        return allTxs.map(t => ({
          ...t,
          date: t.created_at,
          method: t.isReturn ? 'return'
                : t.notes && t.notes.includes('Kredi Kartı') ? 'card'
                : t.notes && t.notes.includes('Havale') ? 'transfer' : 'cash',
          register: t.register_id,
          isReturn: t.isReturn || t.transaction_type === 'return_out',
        }));
      }
      const raw = await db.cash_transactions.filter(t => t.reference_id === Number(saleId)).toArray();
      return raw.map(t => ({
        ...t,
        date: t.created_at,
        method: t.transaction_type === 'return_out' ? 'return'
                : t.notes && t.notes.includes('Kredi Kartı') ? 'card'
                : t.notes && t.notes.includes('Havale') ? 'transfer' : 'cash',
        register: t.register_id,
        isReturn: t.transaction_type === 'return_out',
      }));
    } catch (e) { return []; }
  },

  async addPayment(saleId, amount, method, notes, accountId = null, date = null) {
    try {
      const txDate = date ? new Date(date).getTime() : Date.now();
      const methodLabel = method === 'cash' ? 'Nakit' : method === 'bank_transfer' ? 'Havale/EFT' : 'Kredi Kartı';
      const txType = 'customer_payment_in';

      if (isSupabase()) {
        // Get sale info
        const { data: sale } = await supabase.from('sales').select('total_amount, paid_amount, customer_id').eq('id', saleId).single();
        const newPaid = (Number(sale.paid_amount) || 0) + amount;
        const newStatus = newPaid >= Number(sale.total_amount) - 0.01 ? 'completed' : 'partial';
        await supabase.from('sales').update({ paid_amount: newPaid, status: newStatus }).eq('id', saleId);

        const regId = accountId || null;
        await supabase.from('cash_transactions').insert([{
          register_id: regId,
          reference_id: saleId,
          transaction_type: txType,
          amount,
          notes: notes || `${methodLabel} Tahsilat`,
          created_at: txDate,
        }]);
        return true;
      }

      await db.transaction('rw', db.sales, db.cash_transactions, db.cash_registers, async () => {
        const sale = await db.sales.get(Number(saleId));
        if (!sale) throw new Error('Satış bulunamadı.');
        const newPaid = (Number(sale.paid_amount) || 0) + amount;
        const newStatus = newPaid >= Number(sale.total_amount) - 0.01 ? 'completed' : 'partial';
        await db.sales.update(Number(saleId), { paid_amount: newPaid, status: newStatus });
        await db.cash_transactions.add({
          register_id: accountId ? Number(accountId) : null,
          reference_id: Number(saleId),
          transaction_type: txType,
          amount,
          notes: notes || `${methodLabel} Tahsilat`,
          created_at: txDate,
        });
      });
      return true;
    } catch (e) { throw new Error('Tahsilat eklenirken hata: ' + e.message); }
  },

  async cancel(id) {
    try {
      if (isSupabase()) {
        const { error } = await supabase.from('sales').update({ status: 'cancelled' }).eq('id', id);
        if (error) throw error;
        return true;
      }
      await db.sales.update(Number(id), { status: 'cancelled' });
      return true;
    } catch (e) { throw new Error('İptal işlemi başarısız: ' + e.message); }
  },

  async getByProductId(productId) {
    try {
      if (isSupabase()) {
        const { data: items, error: iErr } = await supabase
          .from('sale_items')
          .select('id, sale_id, quantity, unit_price, line_total, discount')
          .eq('product_id', productId);
        if (iErr) throw iErr;
        if (!items || items.length === 0) return [];

        const saleIds = [...new Set(items.map(i => i.sale_id))];
        const { data: sales, error: sErr } = await supabase
          .from('sales')
          .select('id, sale_number, created_at, status, customer_id, payment_method, total_amount')
          .in('id', saleIds)
          .order('created_at', { ascending: false });
        if (sErr) throw sErr;

        const saleMap = Object.fromEntries((sales || []).map(s => [s.id, s]));
        return items.map(item => ({ ...item, sale: saleMap[item.sale_id] || null }));
      }

      // Dexie fallback
      const items = await db.sale_items.where('product_id').equals(Number(productId)).toArray();
      const saleIds = [...new Set(items.map(i => i.sale_id))];
      const sales = await Promise.all(saleIds.map(sid => db.sales.get(Number(sid))));
      const saleMap = Object.fromEntries(sales.filter(Boolean).map(s => [s.id, s]));
      return items.map(item => ({ ...item, sale: saleMap[item.sale_id] || null }));
    } catch (e) { throw new Error('Ürün satış geçmişi alınamadı: ' + e.message); }
  }
};
