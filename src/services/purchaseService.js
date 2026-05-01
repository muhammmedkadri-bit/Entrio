import { db } from '../db';
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';

export const purchaseService = {
  // ─── Create ───────────────────────────────────────────────────────────────
  async create(purchaseData, items, paymentData) {
    try {
      return await db.transaction('rw',
        db.purchases,
        db.purchase_items,
        db.products,
        db.stock_movements,
        db.cash_transactions,
        db.cash_registers,
        db.supplier_transactions,
        db.suppliers,
        async () => {
          const now = Date.now();
          const today = new Date().toISOString().split('T')[0];

          // ── Compute totals from items ─────────────────────────────────────
          let subtotal      = 0;
          let discountTotal = 0;
          let kdvTotal      = 0;
          let otvTotal      = 0;

          const enrichedItems = items.map(item => {
            const base        = Math.round(item.unit_price * item.quantity * 100) / 100;
            const discAmt     = item.discount_type === 'amount'
              ? Math.round(Math.min(item.discount_value || 0, base) * 100) / 100
              : Math.round(base * ((item.discount_value || 0) / 100) * 100) / 100;
            const discPct     = base > 0 ? Math.round((discAmt / base) * 10000) / 100 : 0;
            const afterDisc   = Math.round((base - discAmt) * 100) / 100;
            const kdvAmt      = Math.round(afterDisc * ((item.kdv_rate || 0) / 100) * 100) / 100;
            const otvAmt      = Math.round(afterDisc * ((item.otv_rate || 0) / 100) * 100) / 100;
            const lineTotal   = Math.round((afterDisc + kdvAmt + otvAmt) * 100) / 100;

            subtotal      += afterDisc;
            discountTotal += discAmt;
            kdvTotal      += kdvAmt;
            otvTotal      += otvAmt;

            return {
              product_id:       item.product_id,
              name:             item.name,
              quantity:         item.quantity,
              unit:             item.unit || 'adet',
              unit_price:       item.unit_price,
              discount_percent: discPct,
              discount_amount:  discAmt,
              kdv_rate:         item.kdv_rate || 0,
              otv_rate:         item.otv_rate || 0,
              kdv_amount:       kdvAmt,
              otv_amount:       otvAmt,
              line_total:       lineTotal,
            };
          });

          subtotal      = Math.round(subtotal * 100) / 100;
          discountTotal = Math.round(discountTotal * 100) / 100;
          kdvTotal      = Math.round(kdvTotal * 100) / 100;
          otvTotal      = Math.round(otvTotal * 100) / 100;
          const grandTotal = Math.round((subtotal + kdvTotal + otvTotal) * 100) / 100;
          const paidNow    = Math.min(paymentData.paidNow || 0, grandTotal);

          const pData = {
            purchase_number:  purchaseData.invoice_number || null,
            invoice_number:   purchaseData.invoice_number || null,
            invoice_date:     purchaseData.invoice_date   || today,
            due_date:         purchaseData.due_date       || today,
            supplier_id:      purchaseData.supplier_id    || null,
            supplier_name:    purchaseData.supplier_name  || null,
            subtotal,
            discount_amount:  discountTotal,
            kdv_amount:       kdvTotal,
            otv_amount:       otvTotal,
            total_amount:     grandTotal,
            paid_amount:      paidNow,
            payment_method:   paymentData.method || 'cash',
            waybill_number:   purchaseData.waybill_number || null,
            waybill_date:     purchaseData.waybill_date   || null,
            notes:            purchaseData.notes          || null,
            invoice_title:    purchaseData.invoice_title  || null,
            siparis_no:       purchaseData.siparis_no     || null,
            siparis_date:     purchaseData.siparis_date   || null,
            status:           'received',
            created_at:       now,
          };

          const purchaseId = await db.purchases.add(pData);

          // ── Insert items + update stock ───────────────────────────────────
          for (const item of enrichedItems) {
            await db.purchase_items.add({ purchase_id: purchaseId, ...item });

            const product = await db.products.get(item.product_id);
            if (product && product.track_stock !== false) {
              // Tracked: update stock quantity + record movement
              const newQty = Math.round((product.stock_quantity + item.quantity) * 1000) / 1000;
              await db.products.update(item.product_id, {
                stock_quantity: newQty,
                purchase_price: item.unit_price,
              });
              await db.stock_movements.add({
                product_id:    item.product_id,
                movement_type: 'purchase',
                quantity:      item.quantity,
                unit_price:    item.unit_price,
                reference_id:  purchaseId,
                reference:     pData.invoice_number || null,
                created_at:    now,
              });
            } else if (product) {
              // Untracked: only update purchase price, skip stock change
              await db.products.update(item.product_id, { purchase_price: item.unit_price });
            }
          }

          // ── Cash register deduction ───────────────────────────────────────
          // Helper to save a single cash transaction with hard purchase_id FK
          const saveCashTx = async (regId, amt, label, notes) => {
            await db.cash_transactions.add({
              purchase_id:      Number(purchaseId),    // Hard FK — primary lookup key
              register_id:      regId,
              transaction_type: 'purchase_out',
              amount:           amt,
              reference:        pData.invoice_number || `ALI-${purchaseId}`,
              notes:            notes || label,
              created_at:       now,
            });
            const reg = await db.cash_registers.get(regId);
            if (reg) {
              await db.cash_registers.update(regId, {
                current_balance: Math.round((reg.current_balance - amt) * 100) / 100,
              });
            }
          };

          const findReg = async (defaultFor) =>
            db.cash_registers.filter(r => r.is_default_for === defaultFor && r.is_active !== false).first();

          if (paymentData.method === 'split' && paymentData.splits && paidNow > 0) {
            // ── Parçalı Ödeme: iterate each leg ────────────────────────────
            const legs = [
              { key: 'cash',          defaultFor: 'cash',     label: 'Nakit Kasa' },
              { key: 'bank_transfer', defaultFor: 'transfer', label: 'Banka/Havale' },
              { key: 'credit_card',   defaultFor: 'card',     label: 'Kredi Kartı' },
            ];
            for (const leg of legs) {
              const info = paymentData.splits[leg.key];
              const amt  = parseFloat(info?.amount) || 0;
              if (amt <= 0) continue;
              let regId = info.account_id;
              if (!regId) {
                const reg = await findReg(leg.defaultFor);
                regId = reg?.id || 1;
              }
              const noteText = info.notes
                ? `${leg.label} (Parçalı): ${info.notes}`
                : `${leg.label} (Parçalı Ödeme)`;
              try {
                await db.cash_transactions.add({
                  purchase_id:      Number(purchaseId),
                  register_id:      regId,
                  transaction_type: 'purchase_out',
                  amount:           amt,
                  reference:        pData.invoice_number || `ALI-${purchaseId}`,
                  notes:            noteText,
                  created_at:       now,
                });
                const reg = await db.cash_registers.get(regId);
                if (reg) {
                  await db.cash_registers.update(regId, {
                    current_balance: Math.round((reg.current_balance - amt) * 100) / 100,
                  });
                } else {
                  console.warn('[PurchaseService] Kasa bulunamadı (split leg):', regId);
                }
              } catch (splitErr) {
                console.error('[PurchaseService] Parçalı ödeme kaydı hatası:', splitErr);
              }
            }
          } else if (paidNow > 0) {
            // ── Tekil Ödeme ─────────────────────────────────────────────────
            const methodMap = {
              cash:          { defaultFor: 'cash',     label: 'Nakit Ödeme' },
              bank_transfer: { defaultFor: 'transfer', label: 'Banka/Havale Ödemesi' },
              credit_card:   { defaultFor: 'card',     label: 'Kredi Kartı Ödemesi' },
            };
            const meta  = methodMap[paymentData.method] || methodMap.cash;
            const reg   = await findReg(meta.defaultFor);
            const regId = reg?.id || 1;
            await saveCashTx(regId, paidNow, meta.label, meta.label);
          }

          // ── Supplier balance ──────────────────────────────────────────────
          if (pData.supplier_id) {
            const supplier = await db.suppliers.get(pData.supplier_id);
            if (supplier) {
              let newBalance = Math.round((supplier.balance + grandTotal) * 100) / 100;

              // 1. Purchase transaction (fatura kaydı)
              await db.supplier_transactions.add({
                supplier_id:      pData.supplier_id,
                transaction_type: 'purchase',
                amount:           grandTotal,
                balance_after:    newBalance,
                reference_id:     purchaseId,
                created_at:       now,
              });

              if (paidNow > 0 && paymentData.method === 'split' && paymentData.splits) {
                // 2a. Split payment: create individual supplier_transaction for each leg
                const splitLegs = [
                  { key: 'cash',          label: 'Nakit Ödeme' },
                  { key: 'bank_transfer', label: 'Havale/EFT Ödemesi' },
                  { key: 'credit_card',   label: 'Kredi Kartı Ödemesi' },
                ];
                let offset = 100;
                for (const leg of splitLegs) {
                  const info = paymentData.splits[leg.key];
                  const amt  = parseFloat(info?.amount) || 0;
                  if (amt <= 0) continue;

                  newBalance = Math.round((newBalance - amt) * 100) / 100;
                  await db.supplier_transactions.add({
                    supplier_id:      pData.supplier_id,
                    transaction_type: 'payment',
                    amount:           amt,
                    balance_after:    newBalance,
                    reference_id:     purchaseId,
                    notes:            info.notes ? `${leg.label} (Parçalı): ${info.notes}` : `${leg.label} (Parçalı Ödeme)`,
                    created_at:       now + offset,
                  });
                  offset += 100;
                }
              } else if (paidNow > 0 && paymentData.method !== 'split') {
                // 2b. Tekil ödeme
                newBalance = Math.round((newBalance - paidNow) * 100) / 100;
                await db.supplier_transactions.add({
                  supplier_id:      pData.supplier_id,
                  transaction_type: 'payment',
                  amount:           paidNow,
                  balance_after:    newBalance,
                  reference_id:     purchaseId,
                  notes:            `Peşinat (${paymentData.method})`,
                  created_at:       now + 100,
                });
              }

              await db.suppliers.update(pData.supplier_id, { balance: newBalance });
            }
          }

          return {
            purchaseId,
            invoice_number: pData.invoice_number,
            item_count:     enrichedItems.length,
            status:         'success',
          };
        }
      );
    } catch (error) {
      console.error(error);
      throw new Error('Alış kaydedilirken hata oluştu: ' + error.message);
    }
  },

  // ─── Get All (enriched) ───────────────────────────────────────────────────
  async getAll(filters = {}) {
    try {
      let purchases = await db.purchases.toArray();
      purchases.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      // Load suppliers for name enrichment
      const suppliers = await db.suppliers.toArray();
      const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

      // Load item counts
      const allItems = await db.purchase_items.toArray();
      const itemCountMap = {};
      allItems.forEach(item => {
        itemCountMap[item.purchase_id] = (itemCountMap[item.purchase_id] || 0) + 1;
      });

      purchases = purchases.map(p => {
        const supplier = supplierMap[p.supplier_id];
        const total  = p.total_amount || 0;
        const paid   = p.paid_amount  || 0;
        const remaining = Math.round((total - paid) * 100) / 100;
        let payment_status = 'unpaid';
        if (remaining <= 0)               payment_status = 'paid';
        else if (paid > 0)                payment_status = 'partial';

        return {
          ...p,
          supplier_name:    supplier?.name || p.supplier_name || null,
          supplier_phone:   supplier?.phone || null,
          supplier_balance: supplier?.balance || 0,
          item_count:       itemCountMap[p.id] || 0,
          remaining,
          payment_status,
          subtotal:         p.subtotal || p.total_amount || 0,
        };
      });

      // ── Filters ────────────────────────────────────────────────────────
      if (filters.supplier_id) {
        purchases = purchases.filter(p => p.supplier_id === filters.supplier_id);
      }

      if (filters.payment_status && filters.payment_status !== 'all') {
        purchases = purchases.filter(p => p.payment_status === filters.payment_status);
      }

      if (filters.startDate && filters.endDate) {
        purchases = purchases.filter(p => {
          try {
            const d = p.invoice_date ? parseISO(p.invoice_date) : new Date(p.created_at);
            return isWithinInterval(d, { start: filters.startDate, end: filters.endDate });
          } catch { return true; }
        });
      }

      return purchases;
    } catch (e) {
      throw new Error('Alış faturaları getirilirken hata oluştu.');
    }
  },

  // ─── Get By ID (full with items) ─────────────────────────────────────────
  async getById(id) {
    try {
      const p = await db.purchases.get(id);
      if (!p) throw new Error('Fatura bulunamadı.');
      const items = await db.purchase_items.where('purchase_id').equals(id).toArray();

      const supplier = p.supplier_id ? await db.suppliers.get(p.supplier_id) : null;
      const total    = p.total_amount || 0;
      const paid     = p.paid_amount  || 0;
      const remaining = Math.round((total - paid) * 100) / 100;
      let payment_status = 'unpaid';
      if (remaining <= 0) payment_status = 'paid';
      else if (paid > 0)  payment_status = 'partial';

      return {
        ...p,
        supplier,
        supplier_name:  supplier?.name || p.supplier_name || null,
        items,
        remaining,
        payment_status,
        subtotal: p.subtotal || p.total_amount || 0,
      };
    } catch (e) {
      throw e;
    }
  },

  // ─── Month Summary (for cards) ────────────────────────────────────────────
  async getMonthSummary() {
    try {
      const now   = new Date();
      const start = startOfMonth(now);
      const end   = endOfMonth(now);

      const all = await db.purchases.toArray();
      const thisMonth = all.filter(p => {
        try {
          const d = p.invoice_date ? parseISO(p.invoice_date) : new Date(p.created_at);
          return isWithinInterval(d, { start, end });
        } catch { return false; }
      });

      const totalAmount = thisMonth.reduce((s, p) => s + (p.total_amount || 0), 0);
      const paidAmount  = thisMonth.reduce((s, p) => s + (p.paid_amount  || 0), 0);
      const pendingDebt = Math.max(0, totalAmount - paidAmount);

      return {
        count:        thisMonth.length,
        totalAmount:  Math.round(totalAmount * 100) / 100,
        paidAmount:   Math.round(paidAmount  * 100) / 100,
        pendingDebt:  Math.round(pendingDebt * 100) / 100,
      };
    } catch {
      return { count: 0, totalAmount: 0, paidAmount: 0, pendingDebt: 0 };
    }
  },

  // ─── Cancel ───────────────────────────────────────────────────────────────
  async cancel(id) {
    try {
      return await db.transaction('rw', db.purchases, db.purchase_items, db.products, db.stock_movements, async () => {
        const p = await db.purchases.get(id);
        if (!p || p.status === 'cancelled') throw new Error('İptal edilecek uygun fatura bulunamadı.');

        if (p.status === 'received') {
          const items = await db.purchase_items.where('purchase_id').equals(id).toArray();
          for (const item of items) {
            const product = await db.products.get(item.product_id);
            if (product) {
              const newQty = Math.round((product.stock_quantity - item.quantity) * 1000) / 1000;
              await db.products.update(item.product_id, { stock_quantity: newQty });
              await db.stock_movements.add({
                product_id:    item.product_id,
                movement_type: 'adjustment_out',
                quantity:      item.quantity,
                notes:         `Fatura iptali (#${id})`,
                reference:     p.invoice_number || `#${id}`,
                created_at:    Date.now(),
              });
            }
          }
        }
        await db.purchases.update(id, { status: 'cancelled' });
        return true;
      });
    } catch (e) {
      throw new Error('İptal işlemi başarısız: ' + e.message);
    }
  },

  // ─── Add Payment ─────────────────────────────────────────────────────────
  async addPayment(purchaseId, amount, method, notes, accountId = null, date = null) {
    try {
      return await db.transaction('rw', db.purchases, db.suppliers, db.supplier_transactions, db.cash_transactions, db.cash_registers, async () => {
        const p = await db.purchases.get(purchaseId);
        const txDate = date ? new Date(date).getTime() : Date.now();
        if (!p) throw new Error('Fatura bulunamadı.');

        const debt = Math.max(0, (p.total_amount || 0) - (p.paid_amount || 0));
        if (amount > debt + 0.001) throw new Error('Ödenen miktar toplamı aşamaz.');

        const newPaid = Math.round(((p.paid_amount || 0) + amount) * 100) / 100;
        await db.purchases.update(purchaseId, { paid_amount: newPaid });

        if (p.supplier_id) {
          const supplier = await db.suppliers.get(p.supplier_id);
          if (supplier) {
            const newBalance = Math.round((supplier.balance - amount) * 100) / 100;
            await db.suppliers.update(p.supplier_id, { balance: newBalance });
            await db.supplier_transactions.add({
              supplier_id:      p.supplier_id,
              transaction_type: 'payment',
              amount,
              balance_after:    newBalance,
              reference_id:     purchaseId,
              notes:            notes || method,
              created_at:       txDate,
            });
          }
        }

        let reg;
        if (accountId) {
          reg = await db.cash_registers.get(Number(accountId));
        } else {
          let defaultFor = 'cash';
          if (method === 'bank_transfer') defaultFor = 'transfer';
          if (method === 'credit_card') defaultFor = 'card';
          reg = await db.cash_registers
            .filter(r => r.is_default_for === defaultFor && r.is_active !== false)
            .first();
        }
          
        if (reg) {
          const methodLabel = method === 'bank_transfer' ? 'Banka/Havale' : method === 'credit_card' ? 'Kredi Kartı' : 'Nakit Kasa';
          await db.cash_transactions.add({
            purchase_id:      Number(purchaseId),            // Hard FK
            register_id:      reg.id,
            transaction_type: 'purchase_out',
            amount,
            notes:            notes ? `${methodLabel}: ${notes}` : `${methodLabel} Ödemesi`,
            reference:        p.invoice_number || `ALI-${purchaseId}`,
            created_at:       txDate,
          });
          await db.cash_registers.update(reg.id, {
            current_balance: Math.round((reg.current_balance - amount) * 100) / 100,
          });
        }

        return newPaid;
      });
    } catch (e) {
      throw new Error('Ödeme eklenirken hata: ' + e.message);
    }
  },

  // ─── Get by Product ID ────────────────────────────────────────────────────
  async getByProductId(productId) {
    try {
      const purchaseItems = await db.purchase_items.where('product_id').equals(productId).toArray();
      if (!purchaseItems.length) return [];

      const purchaseIds = [...new Set(purchaseItems.map(pi => pi.purchase_id))];
      const purchases   = await Promise.all(purchaseIds.map(id => db.purchases.get(id)));
      const purchaseMap = Object.fromEntries(purchases.filter(Boolean).map(p => [p.id, p]));

      const suppliers    = await db.suppliers.toArray();
      const supplierMap  = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

      return purchaseItems.map(pi => {
        const purchase = purchaseMap[pi.purchase_id] || {};
        return {
          ...pi,
          purchase_number: purchase.purchase_number || `A-${pi.purchase_id}`,
          created_at:      purchase.created_at,
          supplier_name:   supplierMap[purchase.supplier_id] || '—',
          status:          purchase.status,
        };
      }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    } catch (error) {
      throw new Error('Alış geçmişi getirilirken hata oluştu.');
    }
  },

  // ─── Update Category ───────────────────────────────────────────────────────
  async updateCategory(purchaseId, categoryId) {
    try {
      await db.purchases.update(purchaseId, { category_id: categoryId });
      return true;
    } catch (e) {
      throw new Error('Kategori güncellenirken hata oluştu.');
    }
  },

  // ─── Get Purchase Payments ─────────────────────────────────────────────────
  async getPurchasePayments(purchaseId) {
    try {
      const p = await db.purchases.get(purchaseId);
      if (!p) return [];

      let payments = [];

      // 1. Supplier payments — use filter() since reference_id is NOT indexed
      // (REMOVED from this fetch to prevent double-entry bug in Fatura Hareketleri list,
      // as every payment already creates a cash_transaction reflecting the payment flow).
      /*
      if (p.supplier_id) {
        ...
      }
      */

      // 2. Cash/Bank/POS payments
      // ── Primary: strict purchase_id FK (new records) ────────────────────
      // ── Fallback: string reference matching (legacy records) ─────────────
      const allCash = await db.cash_transactions.toArray();
      const refToken1 = `ali-${purchaseId}`;                                    // normalised
      const refToken2 = p.invoice_number ? String(p.invoice_number).toLowerCase().trim() : null;

      const cashPayments = allCash.filter(c => {
        if (c.transaction_type !== 'out' && c.transaction_type !== 'purchase_out') return false;

        // ── Hard FK match (new records have this field) ──────────────────
        if (c.purchase_id !== undefined && c.purchase_id !== null) {
          return Number(c.purchase_id) === Number(purchaseId);
        }

        // ── Legacy fallback: reference / notes string matching ───────────
        const ref   = (c.reference || '').toLowerCase().trim();
        const notes = (c.notes    || '').toLowerCase();

        if (ref === refToken1)               return true; // ALI-8
        if (refToken2 && ref === refToken2)  return true; // THL337762
        if (notes.includes(refToken1))       return true;
        if (refToken2 && notes.includes(refToken2)) return true;

        return false;
      });

      // Build a register lookup map once for performance
      const allRegisters = await db.cash_registers.toArray();
      const regMap = {};
      allRegisters.forEach(r => { regMap[r.id] = r.name || r.type || 'Kasa'; });

      payments = [...payments, ...cashPayments.map(c => {
        let methodLbl = 'Kasa / Banka İşlemi';
        const n = (c.notes || '').toLowerCase();
        if (n.includes('kredi'))   methodLbl = 'Kredi Kartı Ödemesi';
        else if (n.includes('banka') || n.includes('havale')) methodLbl = 'Havale/EFT Ödemesi';
        else if (n.includes('nakit')) methodLbl = 'Nakit Ödeme';
        else if (n.includes('peşinat')) methodLbl = 'Peşinat';

        return {
          id:       `cash_${c.id}`,
          amount:   c.amount,
          date:     new Date(c.created_at).toISOString(),
          method:   methodLbl,
          notes:    c.notes || c.reference || 'Kasa çıkışı',
          register: c.register_id ? (regMap[c.register_id] || `Kasa #${c.register_id}`) : '—',
        };
      })];

      return payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error(e);
      return [];
    }
  },
};
