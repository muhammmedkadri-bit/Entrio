import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { isWithinInterval } from 'date-fns';

export const stockService = {
  async addMovement(productId, type, qty, unitPrice = 0, notes = '', reference = '') {
    try {
      const isInput  = ['adjustment_in', 'return_in', 'purchase'].includes(type);
      const isOutput = ['adjustment_out', 'return_out', 'sale'].includes(type);

      if (isSupabase()) {
        const { data: product, error: pErr } = await supabase.from('products').select('stock_quantity,track_stock').eq('id', productId).single();
        if (pErr) throw pErr;
        if (!product) throw new Error('Ürün bulunamadı.');

        let newQty = Number(product.stock_quantity) || 0;
        if (isInput) newQty += qty;
        else if (isOutput) newQty -= qty;
        newQty = Math.round(newQty * 1000) / 1000;

        await supabase.from('products').update({ stock_quantity: newQty }).eq('id', productId);
        await supabase.from('stock_movements').insert([{
          product_id: Number(productId), movement_type: type,
          quantity: qty, unit_price: unitPrice, notes, reference, created_at: Date.now()
        }]);
        return { success: true, newStock: newQty };
      }

      return await db.transaction('rw', db.products, db.stock_movements, async () => {
        const product = await db.products.get(Number(productId));
        if (!product) throw new Error('Ürün bulunamadı.');
        let newQty = product.stock_quantity || 0;
        if (isInput) newQty += qty;
        else if (isOutput) newQty -= qty;
        newQty = Math.round(newQty * 1000) / 1000;
        await db.products.update(Number(productId), { stock_quantity: newQty });
        await db.stock_movements.add({ product_id: Number(productId), movement_type: type, quantity: qty, unit_price: unitPrice, notes, reference, created_at: Date.now() });
        return { success: true, newStock: newQty };
      });
    } catch (error) {
      throw new Error('Stok hareketi eklenirken hata oluştu: ' + error.message);
    }
  },

  async getMovements(filters = {}) {
    try {
      let movements, products, sales, purchases, customers, suppliers;

      if (isSupabase()) {
        let q = supabase.from('stock_movements').select('*').order('created_at', { ascending: false });
        if (filters.product_id) q = q.eq('product_id', filters.product_id);
        if (filters.type && filters.type !== 'all') q = q.eq('movement_type', filters.type);
        if (filters.startDate && filters.endDate) q = q.gte('created_at', filters.startDate.getTime()).lte('created_at', filters.endDate.getTime());

        const [
          { data: m, error: mErr },
          { data: p  }, { data: s  }, { data: pur },
          { data: cust }, { data: sup }
        ] = await Promise.all([
          q,
          supabase.from('products').select('id,name'),
          supabase.from('sales').select('id,sale_number,customer_id,original_sale_id'),
          supabase.from('purchases').select('id,purchase_number,supplier_id'),
          supabase.from('customers').select('id,name'),
          supabase.from('suppliers').select('id,name'),
        ]);
        if (mErr) throw mErr;
        movements = m || [];
        products = p || []; sales = s || []; purchases = pur || [];
        customers = cust || []; suppliers = sup || [];
      } else {
        movements = await db.stock_movements.toArray();
        movements.sort((a, b) => b.created_at - a.created_at);
        if (filters.product_id) movements = movements.filter(m => Number(m.product_id) === Number(filters.product_id));
        if (filters.type && filters.type !== 'all') movements = movements.filter(m => m.movement_type === filters.type);
        if (filters.startDate && filters.endDate) movements = movements.filter(m => isWithinInterval(m.created_at, { start: filters.startDate, end: filters.endDate }));
        [products, sales, purchases, customers, suppliers] = await Promise.all([
          db.products.toArray(), db.sales.toArray(), db.purchases.toArray(),
          db.customers.toArray(), db.suppliers.toArray()
        ]);
      }

      const productMap   = Object.fromEntries(products.map(p => [p.id, p.name]));
      const customerMap  = Object.fromEntries(customers.map(c => [c.id, c.name]));
      const supplierMap  = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

      const saleRefMap = {};
      for (const s of sales) {
        const custName = s.customer_id ? (customerMap[s.customer_id] || 'Perakende') : 'Perakende';
        saleRefMap[s.sale_number] = { name: custName, id: s.id, original_sale_id: s.original_sale_id };
      }
      const purchaseRefMap = {};
      for (const p of purchases) {
        const suppName = p.supplier_id ? (supplierMap[p.supplier_id] || 'Tedarikçi') : 'Tedarikçi';
        purchaseRefMap[p.purchase_number] = { name: suppName, id: p.id };
      }

      return movements.map(m => {
        let counterparty = null;
        let reference_id = null;

        if (m.movement_type === 'sale' || m.movement_type === 'out') {
          const sMap = saleRefMap[m.reference];
          counterparty = sMap ? sMap.name : 'Perakende';
          reference_id = sMap ? sMap.id : null;
        } else if (m.movement_type === 'purchase') {
          const pMap = purchaseRefMap[m.reference];
          counterparty = pMap ? pMap.name : m.reference;
          reference_id = pMap ? pMap.id : null;
        } else if (m.movement_type === 'adjustment_in' || m.movement_type === 'adjustment_out') {
          counterparty = 'Manuel Düzeltme';
        } else if (m.movement_type === 'return_in' || m.movement_type === 'return_out') {
          const sMap = saleRefMap[m.reference];
          const pMap = purchaseRefMap[m.reference];
          counterparty = sMap ? sMap.name : pMap ? pMap.name : m.reference || 'Müşteri';
          reference_id = sMap ? sMap.id : pMap ? pMap.id : null;

          if (m.movement_type === 'return_in' && reference_id) {
            const retEntry = saleRefMap[m.reference];
            if (retEntry?.original_sale_id) {
              const origEntry = Object.values(saleRefMap).find(s => s.id === retEntry.original_sale_id);
              if (origEntry) {
                return {
                  ...m,
                  product_name: productMap[m.product_id] || 'Silinmiş Ürün',
                  counterparty: origEntry.name,
                  reference_id: origEntry.id,
                  original_sale_id: origEntry.id,
                };
              }
            }
          }
        } else if (m.movement_type === 'transfer') {
          counterparty = 'Transfer';
        }

        return { ...m, product_name: productMap[m.product_id] || 'Silinmiş Ürün', counterparty, reference_id };
      });
    } catch (error) {
      throw new Error('Stok hareketleri getirilirken hata oluştu.');
    }
  },

  async getLowStockProducts() {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.from('products').select('*').eq('is_active', true).gt('min_stock_level', 0);
        if (error) throw error;
        return (data || []).filter(p => Number(p.stock_quantity) <= Number(p.min_stock_level));
      }
      const allProducts = await db.products.toArray();
      return allProducts.filter(p => p.min_stock_level > 0 && p.stock_quantity <= p.min_stock_level && p.is_active !== false);
    } catch (error) {
      throw new Error('Kritik stok listesi getirilirken hata oluştu.');
    }
  }
};
