import { db } from '../db';
import { paymentRegisterService } from './paymentRegisterService';
import { generateSaleNumber } from '../utils/invoiceUtils';

export const saleService = {
  async create(saleData, saleItems, paymentData) {
    // Atomic transaction for sale creation
    try {
      return await db.transaction('rw', 
        db.sales, 
        db.sale_items, 
        db.stock_movements, 
        db.cash_transactions, 
        db.customer_transactions, 
        db.products, 
        db.customers,
        db.cash_registers,
        async () => {
          const now = Date.now();
          const mapping = await paymentRegisterService.getMapping();
          
          // 1. Generate unique sale number
          const saleNumber = await generateSaleNumber();

          // Calculate paid amount
          const isMixed = paymentData.method === 'mixed';
          const pCash = isMixed ? (paymentData.cashAmount || 0) : (paymentData.method === 'cash' ? saleData.total_amount : 0);
          const pCard = isMixed ? (paymentData.cardAmount || 0) : (paymentData.method === 'card' ? saleData.total_amount : 0);
          const pTrans = isMixed ? (paymentData.transferAmount || 0) : (paymentData.method === 'transfer' ? saleData.total_amount : 0);
          const paidAmt = pCash + pCard + pTrans;

          // 2. Create Sale Record
          const sData = {
            ...saleData,
            sale_number: saleNumber,
            payment_method: paymentData.method,
            paid_amount: paidAmt,
            created_at: now,
            status: paidAmt >= saleData.total_amount ? 'completed' : 'pending'
          };
          const saleId = await db.sales.add(sData);

          // 2. Add Sale Items & Update Stock
          for (const item of saleItems) {
            await db.sale_items.add({ sale_id: saleId, ...item });

            // Update Stock Quantity — only for tracked products
            const product = await db.products.get(item.product_id);
            if (product && product.track_stock !== false) {
              await db.products.update(item.product_id, {
                stock_quantity: product.stock_quantity - item.quantity,
              });
              await db.stock_movements.add({
                product_id:    Number(item.product_id),
                movement_type: 'sale',
                quantity:      item.quantity,
                unit_price:    item.unit_price,
                item_discount: item.discount || 0,
                reference:     saleNumber,
                created_at:    now,
              });
            }
          }

          // Helper async function to add routed transactions
          const addPaymentToRegister = async (amount, typeStr, notes) => {
            if (!amount || amount <= 0) return;
            // overrideRegisterId: explicitly selected register (e.g. from SupplierPaymentModal)
            const regId = paymentData.overrideRegisterId
              ? Number(paymentData.overrideRegisterId)
              : (mapping[typeStr] || 1);
            
            await db.cash_transactions.add({
              reference_id: saleId,
              register_id: regId,
              transaction_type: 'sale_in',
              amount,
              notes,
              created_at: now
            });
            const register = await db.cash_registers.get(regId);
            if (register) {
              await db.cash_registers.update(regId, { 
                current_balance: Math.round((register.current_balance + amount) * 100) / 100 
              });
            }
          };

          // 3. Handle Payments routed
          if (paymentData.method === 'cash') {
            await addPaymentToRegister(paymentData.cashAmount, 'cash', `Satış: ${saleNumber}`);
          } else if (paymentData.method === 'card') {
            await addPaymentToRegister(paymentData.cardAmount, 'card', `Satış (Kredi Kartı): ${saleNumber}`);
          } else if (paymentData.method === 'transfer') {
            await addPaymentToRegister(paymentData.transferAmount, 'transfer', `Satış (Havale/EFT): ${saleNumber}`);
          } else if (paymentData.method === 'mixed') {
            if (paymentData.cashAmount > 0) await addPaymentToRegister(paymentData.cashAmount, 'cash', `Parçalı Satış (Nakit): ${saleNumber}`);
            if (paymentData.cardAmount > 0) await addPaymentToRegister(paymentData.cardAmount, 'card', `Parçalı Satış (Kart): ${saleNumber}`);
            if (paymentData.transferAmount > 0) await addPaymentToRegister(paymentData.transferAmount, 'transfer', `Parçalı Satış (EFT): ${saleNumber}`);
          }

          // 4. Customer transaction — her satış için 'sale' kaydı (perakende dahil)
          const customerId = saleData.customer_id;
          if (customerId) {
            const customer = await db.customers.get(customerId);
            if (customer) {
              // Credit part (Veresiye) — bakiyeye eklenir
              if (paymentData.creditAmount > 0) {
                const newBalance = Math.round((customer.balance + paymentData.creditAmount) * 100) / 100;
                await db.customers.update(customerId, { balance: newBalance });

                await db.customer_transactions.add({
                  customer_id:      customerId,
                  transaction_type: 'sale',
                  amount:           saleData.total_amount,
                  balance_after:    newBalance,
                  reference_id:     saleId,
                  sale_number:      saleNumber,
                  notes:            `Satış — ${saleNumber}`,
                  created_at:       now,
                });
              } else {
                // Normal (nakit/kart) satış — bakiye değişmez, sadece hareket kaydı
                const currentBalance = parseFloat(customer.balance) || 0;
                await db.customer_transactions.add({
                  customer_id:      customerId,
                  transaction_type: 'sale',
                  amount:           saleData.total_amount,
                  balance_after:    currentBalance,
                  reference_id:     saleId,
                  sale_number:      saleNumber,
                  notes:            `Satış — ${saleNumber}`,
                  created_at:       now,
                });
              }
            }
          }

          return { saleId, saleNumber, status: 'success' };
      });
    } catch (error) {
      console.error('Sale error', error);
      throw new Error('Satış işlemi sırasında bir hata oluştu: ' + error.message);
    }
  },

  async createReturn(returnData, returnItems, paymentData) {
    try {
      return await db.transaction('rw', 
        db.sales, 
        db.sale_items, 
        db.stock_movements, 
        db.cash_transactions, 
        db.customer_transactions, 
        db.products, 
        db.customers,
        db.cash_registers,
        async () => {
          const now = Date.now();
          const mapping = await paymentRegisterService.getMapping();
          
          const returnNumber = 'RET-' + Date.now().toString().slice(-6);

          let refNote = returnNumber;
          if (returnData.original_sale_id) {
            const os = await db.sales.get(returnData.original_sale_id);
            if (os && os.sale_number) {
              refNote = `${os.sale_number} no'lu iade ödemesi`;
            } else {
              refNote = `${returnNumber} no'lu iade ödemesi`;
            }
          } else {
            refNote = `${returnNumber} no'lu iade ödemesi`;
          }

          const isMixed = paymentData.method === 'mixed';
          const pCash = isMixed ? (paymentData.cashAmount || 0) : (paymentData.method === 'cash' ? returnData.total_amount : 0);
          const pCard = isMixed ? (paymentData.cardAmount || 0) : (paymentData.method === 'card' ? returnData.total_amount : 0);
          const pTrans = isMixed ? (paymentData.transferAmount || 0) : (paymentData.method === 'transfer' ? returnData.total_amount : 0);
          const paidAmt = pCash + pCard + pTrans;
          const pCredit = paymentData.creditAmount || 0;

          const rData = {
            ...returnData,
            sale_number: returnNumber,
            payment_method: paymentData.method,
            paid_amount: paidAmt,
            created_at: now,
            status: 'returned'
          };
          const returnSaleId = await db.sales.add(rData);

          for (const item of returnItems) {
            await db.sale_items.add({
              sale_id: returnSaleId,
              ...item
            });

            const product = await db.products.get(item.product_id);
            if (product) {
              const newQty = product.stock_quantity + item.quantity;
              await db.products.update(item.product_id, { stock_quantity: newQty });

              await db.stock_movements.add({
                product_id: item.product_id,
                movement_type: 'return_in',
                quantity: item.quantity,
                unit_price: item.unit_price,
                reference: returnNumber,
                created_at: now
              });
            }
          }

          const removePaymentFromRegister = async (amount, typeStr, notes) => {
            if (!amount || amount <= 0) return;
            const regId = mapping[typeStr] || 1;
            
            await db.cash_transactions.add({
              reference_id: returnSaleId,
              register_id: regId,
              transaction_type: 'return_out',
              amount: amount,
              notes,
              created_at: now
            });
            const register = await db.cash_registers.get(regId);
            if (register) {
              await db.cash_registers.update(regId, { 
                current_balance: Math.round((register.current_balance - amount) * 100) / 100 
              });
            }
          };

          if (paymentData.method === 'cash') {
            await removePaymentFromRegister(pCash, 'cash', `İade : ${refNote}`);
          } else if (paymentData.method === 'card') {
            await removePaymentFromRegister(pCard, 'card', `İade : ${refNote} (Kredi Kartı)`);
          } else if (paymentData.method === 'transfer') {
            await removePaymentFromRegister(pTrans, 'transfer', `İade : ${refNote} (Havale/EFT)`);
          } else if (paymentData.method === 'mixed') {
            if (pCash > 0) await removePaymentFromRegister(pCash, 'cash', `Parçalı İade : ${refNote} (Nakit)`);
            if (pCard > 0) await removePaymentFromRegister(pCard, 'card', `Parçalı İade : ${refNote} (Kart)`);
            if (pTrans > 0) await removePaymentFromRegister(pTrans, 'transfer', `Parçalı İade : ${refNote} (EFT)`);
          }

          if (pCredit > 0) {
            const customer = await db.customers.get(returnData.customer_id);
            if (customer) {
              const newBalance = Math.round((customer.balance - pCredit) * 100) / 100;
              await db.customers.update(returnData.customer_id, { balance: newBalance });
              
              await db.customer_transactions.add({
                customer_id: returnData.customer_id,
                reference_id: returnSaleId,
                transaction_type: 'return_credit',
                amount: pCredit,
                balance_after: newBalance,
                sale_number: returnNumber,
                notes: `Veresiye İade Düşümü: ${refNote}`,
                created_at: now
              });
            }
          }

          // ─── UPDATE ORIGINAL SALE ───────────────────────────────────────
          if (returnData.original_sale_id) {
            const os = await db.sales.get(returnData.original_sale_id);
            if (os) {
              const returnedTotal = returnData.total_amount || 0;
              const newTotal = Math.max(0, (os.total_amount || 0) - returnedTotal);
              const newSubtotal = Math.max(0, (os.subtotal || 0) - returnedTotal);
              const newPaid = Math.max(0, (os.paid_amount || 0) - returnedTotal);
              
              const newStatus = newTotal <= 0.01 ? 'returned' : 'partially_returned';
              
              await db.sales.update(os.id, {
                total_amount: newTotal,
                subtotal: newSubtotal,
                paid_amount: newPaid,
                status: newStatus
              });

              const osItems = await db.sale_items.where('sale_id').equals(os.id).toArray();
              for (const rItem of returnItems) {
                const targetItem = osItems.find(i => i.product_id === rItem.product_id);
                if (targetItem) {
                  const newQty = targetItem.quantity - rItem.quantity;
                  if (newQty <= 0) {
                    await db.sale_items.delete(targetItem.id);
                  } else {
                    const newLineTotal = Math.max(0, targetItem.line_total - rItem.line_total);
                    await db.sale_items.update(targetItem.id, {
                      quantity: newQty,
                      line_total: newLineTotal
                    });
                  }
                }
              }
            }
          }

          return { returnSaleId, returnNumber: returnNumber };
        }
      );
    } catch (e) {
      console.error('Error in create return transaction:', e);
      throw new Error('İade işlemi sırasında bir hata oluştu: ' + e.message);
    }
  },

  async getAll(filters = {}) {
    try {
      return await db.sales.orderBy('created_at').reverse().toArray();
    } catch (error) {
      throw new Error('Satışlar getirilirken hata oluştu.');
    }
  },

  async getById(id) {
    try {
      const sale = await db.sales.get(id);
      if (!sale) throw new Error('Satış bulunamadı.');
      const items = await db.sale_items.where('sale_id').equals(id).toArray();
      return { ...sale, items };
    } catch (error) {
      throw new Error('Satış detayı getirilirken hata oluştu.');
    }
  },

  async getSalePayments(saleId) {
    try {
      // Load the original sale to get its sale_number
      const originalSale = await db.sales.get(Number(saleId));
      const originalSaleNumber = originalSale?.sale_number || `#${saleId}`;

      // 1) Normal cash collection transactions linked to this sale
      const cashTx = await db.cash_transactions.filter(tx => tx.reference_id === Number(saleId)).toArray();

      const payments = cashTx.map(tx => {
        let method = 'Nakit Kasa';
        if (tx.notes) {
          const n = tx.notes.toLowerCase();
          if (n.includes('banka') || n.includes('havale') || n.includes('eft')) method = 'Havale / EFT';
          else if (n.includes('kredi kartı') || n.includes('kart') || n.includes('pos')) method = 'Kredi Kartı';
        }
        return {
          id: tx.id,
          method,
          amount: tx.amount,
          date: tx.created_at,
          notes: tx.notes,
          register: tx.register_id,
          isReturn: false,
        };
      });

      // 2) Return receipts that reference this original sale — one row per returned item
      const returnReceipts = await db.sales
        .filter(s => s.original_sale_id === Number(saleId) && s.status === 'returned')
        .toArray();

      for (const ret of returnReceipts) {
        const retItems = await db.sale_items.where('sale_id').equals(ret.id).toArray();

        // Find the cash_transaction for this return receipt to get the register
        const retCashTx = await db.cash_transactions
          .filter(ct => ct.reference_id === ret.id && ct.transaction_type === 'return_out')
          .first();

        for (const ri of retItems) {
          // Resolve product name
          const product = await db.products.get(ri.product_id).catch(() => null);
          const productName = product?.name || ri.name || `Ürün #${ri.product_id}`;
          payments.push({
            id: `ret_${ret.id}_item_${ri.id}`,
            method: 'İade',
            amount: ri.line_total || (ri.unit_price * ri.quantity),
            date: ret.created_at,
            // Use original sale number, not the return receipt number
            notes: `${productName} × ${ri.quantity} adet iade edildi (${originalSaleNumber})`,
            register: retCashTx?.register_id || null,
            isReturn: true,
            returnReceiptId: ret.id,
          });
        }
      }

      return payments;
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async addPayment(saleId, amount, method, notes, accountId = null, date = null) {
    try {
      return await db.transaction('rw', db.sales, db.customers, db.customer_transactions, db.cash_transactions, db.cash_registers, async () => {
        const s = await db.sales.get(saleId);
        const txDate = date ? new Date(date).getTime() : Date.now();
        if (!s) throw new Error('Satış fişi bulunamadı.');

        const debt = Math.max(0, (s.total_amount || 0) - (s.paid_amount || 0));
        if (amount > debt + 0.001) throw new Error('Ödenen miktar toplamı aşamaz.');

        const newPaid = Math.round(((s.paid_amount || 0) + amount) * 100) / 100;
        const newStatus = newPaid >= s.total_amount ? 'completed' : 'pending';
        await db.sales.update(saleId, { paid_amount: newPaid, status: newStatus });

        if (s.customer_id) {
          const customer = await db.customers.get(s.customer_id);
          if (customer) {
            const newBalance = Math.round((customer.balance - amount) * 100) / 100;
            await db.customers.update(s.customer_id, { balance: newBalance });
            await db.customer_transactions.add({
              customer_id:      s.customer_id,
              transaction_type: 'payment',
              amount,
              balance_after:    newBalance,
              reference_id:     saleId,
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
            reference_id:     Number(saleId), // soft FK to sale
            register_id:      reg.id,
            transaction_type: 'sale_in', // receiving payment
            amount,
            notes:            notes ? `${methodLabel}: ${notes}` : `${methodLabel} Tahsilatı`,
            created_at:       txDate,
          });
          await db.cash_registers.update(reg.id, {
            current_balance: Math.round((reg.current_balance + amount) * 100) / 100,
          });
        }
        
        return true;
      });
    } catch (e) {
      throw new Error('Tahsilat eklenemedi: ' + e.message);
    }
  },

  async getTodaySummary() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();

      const salesToday = await db.sales
        .where('created_at')
        .aboveOrEqual(startOfDay)
        .toArray();

      const totalAmount = salesToday.reduce((sum, sale) => sum + sale.total_amount, 0);
      const saleCount = salesToday.length;

      return { totalAmount: Math.round(totalAmount * 100) / 100, saleCount, salesToday: salesToday.slice(0, 5) };
    } catch (error) {
      throw new Error('Bugünkü özet alınırken hata oluştu.');
    }
  },

  async getByProductId(productId) {
    try {
      // Find all sale_items for this product
      const saleItems = await db.sale_items.where('product_id').equals(Number(productId)).toArray();
      if (!saleItems.length) return [];

      // Get unique sale IDs
      const saleIds = [...new Set(saleItems.map(si => si.sale_id))];

      // Fetch all related sales
      const sales = await Promise.all(saleIds.map(id => db.sales.get(id)));
      const saleMap = Object.fromEntries(sales.filter(Boolean).map(s => [s.id, s]));

      // Fetch customers
      const customers = await db.customers.toArray();
      const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

      // Build enriched rows — one row per sale_item
      return saleItems.map(si => {
        const sale = saleMap[si.sale_id] || {};
        return {
          ...si,
          sale_number: sale.sale_number || `S-${si.sale_id}`,
          created_at: sale.created_at,
          customer_name: customerMap[sale.customer_id] || 'Perakende Müşteri',
          payment_method: sale.payment_method,
          discount: si.line_total !== undefined && si.unit_price && si.quantity
            ? Math.max(0, si.unit_price * si.quantity - si.line_total)
            : 0,
        };
      }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    } catch (error) {
      throw new Error('Satış geçmişi getirilirken hata oluştu.');
    }
  },

  async cancel(id) {
    throw new Error('İptal işlemi henüz implement edilmedi.');
  }
};
