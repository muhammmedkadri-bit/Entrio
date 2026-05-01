import { db } from '../db';
import { isWithinInterval } from 'date-fns';

export const stockService = {
  // movement type can be: 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'purchase', 'sale'
  async addMovement(productId, type, qty, unitPrice = 0, notes = '', reference = '') {
    try {
      return await db.transaction('rw', db.products, db.stock_movements, async () => {
        const product = await db.products.get(productId);
        if (!product) throw new Error('Ürün bulunamadı.');

        const isInput = ['adjustment_in', 'return_in', 'purchase'].includes(type);
        const isOutput = ['adjustment_out', 'return_out', 'sale'].includes(type);

        let newQty = product.stock_quantity;
        if (isInput) newQty += qty;
        else if (isOutput) newQty -= qty;

        // Ensure stock doesn't theoretically drop below 0 if not allowed, but we allow it per user note (just alert in UI).
        // Actually user says: "Stok miktarı hiçbir zaman negatife düşmemeli — uyarı ver ama admin override seçeneği sun" 
        // We will handle the warning in the UI, but here we just process what is given.
        
        // Round to 3 decimal places for kg precision
        newQty = Math.round(newQty * 1000) / 1000;

        await db.products.update(productId, { stock_quantity: newQty });

        await db.stock_movements.add({
          product_id: productId,
          movement_type: type,
          quantity: qty,
          unit_price: unitPrice,
          notes,
          reference, // e.g., 'SAT-001' or manual entry
          created_at: Date.now()
        });
        
        return { success: true, newStock: newQty };
      });
    } catch (error) {
      throw new Error('Stok hareketi eklenirken hata oluştu: ' + error.message);
    }
  },

  async getMovements(filters = {}) {
    try {
      let movements = await db.stock_movements.toArray();
      movements.sort((a, b) => b.created_at - a.created_at);

      if (filters.product_id) {
        movements = movements.filter(m => m.product_id === filters.product_id);
      }
      if (filters.type && filters.type !== 'all') {
        movements = movements.filter(m => m.movement_type === filters.type);
      }
      if (filters.startDate && filters.endDate) {
        movements = movements.filter(m =>
          isWithinInterval(m.created_at, { start: filters.startDate, end: filters.endDate })
        );
      }

      const products  = await db.products.toArray();
      const productMap = Object.fromEntries(products.map(p => [p.id, p.name]));

      // Build reference -> customer/supplier name lookup from sales & purchases
      const [sales, purchases, customers, suppliers] = await Promise.all([
        db.sales.toArray(),
        db.purchases.toArray(),
        db.customers.toArray(),
        db.suppliers.toArray(),
      ]);
      const customerMap  = Object.fromEntries(customers.map(c => [c.id, c.name]));
      const supplierMap  = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
      // Map sale_number -> { customer_name, is_retail, id }
      const saleRefMap = {};
      for (const s of sales) {
        const custName = s.customer_id ? (customerMap[s.customer_id] || 'Perakende') : 'Perakende';
        saleRefMap[s.sale_number] = { name: custName, id: s.id };
      }
      // Map purchase_number -> { supplier_name, id }
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
          // m.reference may be the return receipt's sale_number OR the original sale_number
          const sMap = saleRefMap[m.reference];  // direct match
          const pMap = purchaseRefMap[m.reference];
          counterparty = sMap ? sMap.name : pMap ? pMap.name : m.reference || 'Müşteri';
          reference_id = sMap ? sMap.id : pMap ? pMap.id : null;

          // For return_in: resolve the original sale's number for display
          if (m.movement_type === 'return_in' && reference_id) {
            const retSale = sales.find(s => s.id === reference_id);
            if (retSale?.original_sale_id) {
              const origSale = sales.find(s => s.id === retSale.original_sale_id);
              if (origSale) {
                // Override reference_id to point to the original sale for navigation
                reference_id = origSale.id;
                counterparty = origSale.customer_id ? (customerMap[origSale.customer_id] || 'Perakende') : 'Perakende';
                // Will be attached to returned map object
                const origSaleNumber = origSale.sale_number;
                return {
                  ...m,
                  product_name: productMap[m.product_id] || 'Silinmiş Ürün',
                  counterparty,
                  reference_id,
                  original_sale_id: origSale.id,
                  original_sale_number: origSaleNumber,
                };
              }
            }
          }
        } else if (m.movement_type === 'transfer') {
          counterparty = 'Transfer';
        }
        return {
          ...m,
          product_name: productMap[m.product_id] || 'Silinmiş Ürün',
          counterparty,
          reference_id
        };
      });
    } catch (error) {
      throw new Error('Stok hareketleri getirilirken hata oluştu.');
    }
  },

  async getLowStockProducts() {
    try {
      const allProducts = await db.products.toArray();
      return allProducts.filter(p => p.min_stock_level > 0 && p.stock_quantity <= p.min_stock_level && p.is_active !== false);
    } catch (error) {
      throw new Error('Kritik stok listesi getirilirken hata oluştu.');
    }
  }
};
