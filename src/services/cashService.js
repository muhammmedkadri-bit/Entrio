import { db } from '../db';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

export const cashService = {
  async getRegisters() {
    try {
      return await db.cash_registers.filter(r => r.is_active !== false).toArray();
    } catch (e) {
      throw new Error('Kasalar getirilirken hata oluştu.');
    }
  },

  async getRegisterById(id) {
    try {
      const reg = await db.cash_registers.get(id);
      if (!reg || reg.is_active === false) throw new Error('Kasa bulunamadı.');
      return reg;
    } catch (e) {
      throw e;
    }
  },

  async createRegister(data) {
    try {
      const openingBalance = parseFloat(data.opening_balance) || 0;
      const isCreditCard = data.type === 'credit_card';
      const today = new Date().toISOString().split('T')[0];

      // Kredi kartında bakiye negatif (borç), diğerlerinde pozitif
      const initialBalance = isCreditCard ? -Math.abs(openingBalance) : openingBalance;

      const id = await db.cash_registers.add({
        name: data.name,
        type: data.type || 'cash',
        current_balance: initialBalance,
        general_balance: initialBalance, // Açılış bakiyesi genel bakiye olarak başlar
        last_day_close_date: today,
        is_active: true,
        ...(isCreditCard && {
          credit_limit: data.credit_limit || 0,
          billing_day: data.billing_day || null,
          due_day: data.due_day || null,
        })
      });

      // Kredi kartı için hareket oluşturma — borç hareket sistemi dışı tutulur
      // Diğer kasalar için açılış bakiyesi hareketi ekle
      if (!isCreditCard && openingBalance > 0) {
        await db.cash_transactions.add({
          register_id: id,
          transaction_type: 'deposit_in',
          amount: openingBalance,
          balance_after: openingBalance,
          notes: 'İlk Kasa Kurulumu',
          created_at: Date.now()
        });
      }

      return { id, ...data };
    } catch (e) {
      throw new Error('Kasa oluşturulurken hata oluştu: ' + e.message);
    }
  },

  async updateRegister(id, data) {
    try {
      await db.cash_registers.update(id, data);
      return true;
    } catch (e) {
      throw new Error('Kasa güncellenirken hata oluştu.');
    }
  },

  async adjustBalance(registerId, newBalance, reason, resetGeneral = false) {
    try {
      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        const reg = await db.cash_registers.get(registerId);
        if (!reg) throw new Error('Kasa bulunamadı.');

        const diff = newBalance - (reg.current_balance || 0);
        if (diff === 0 && !resetGeneral) return true; // Değişiklik yok

        const updateData = { current_balance: newBalance };
        if (resetGeneral) {
          updateData.general_balance = newBalance;
        }

        await db.cash_registers.update(registerId, updateData);

        await db.cash_transactions.add({
          register_id: registerId,
          transaction_type: 'balance_adjustment',
          amount: Math.abs(diff),
          balance_after: newBalance,
          notes: `Bakiye Düzeltme: ${reason || ''} (Eski Bakiye: ${reg.current_balance || 0}, Fark: ${diff})`,
          created_at: Date.now()
        });

        return true;
      });
    } catch (e) {
      throw new Error('Bakiye düzeltme başarısız: ' + e.message);
    }
  },

  async resetRegister(registerId) {
    return this.adjustBalance(registerId, 0, 'Kasa Sıfırlama', true);
  },

  async deleteRegister(registerId) {
    try {
      const txCount = await db.cash_transactions.where('register_id').equals(registerId).count();
      if (txCount > 0) {
        throw new Error(`Bu kasada ${txCount} hareket bulunuyor. Silmek için önce hareketleri kaldırın ya da kasayı arşivleyin.`);
      }
      await db.cash_registers.delete(registerId);
      return true;
    } catch (e) {
      throw e;
    }
  },

  async archiveRegister(registerId) {
    try {
      await db.cash_registers.update(registerId, { is_active: false });
      return true;
    } catch (e) {
      throw new Error('Kasa arşivlenirken hata oluştu.');
    }
  },

  async setDefaultRegister(registerId) {
    try {
      const reg = await db.cash_registers.get(registerId);
      if (!reg) throw new Error('Kasa bulunamadı.');

      let targetDefaultFor = null;
      if (reg.type === 'cash' || reg.type === 'general') targetDefaultFor = 'cash';
      else if (reg.type === 'pos' || reg.type === 'credit_card') targetDefaultFor = 'card';
      else if (reg.type === 'bank') targetDefaultFor = 'transfer';
      else throw new Error('Bu kasa tipi varsayılan ataması için uygun değil.');

      return await db.transaction('rw', db.cash_registers, async () => {
        // Eski varsayılanları temizle
        const oldDefaults = await db.cash_registers.filter(r => r.is_default_for === targetDefaultFor).toArray();
        for (const r of oldDefaults) {
          if (r.id !== registerId) {
            await db.cash_registers.update(r.id, { is_default_for: null });
          }
        }
        
        // Yeni varsayılanı ata
        await db.cash_registers.update(registerId, { is_default_for: targetDefaultFor });
        return true;
      });
    } catch(e) {
      throw new Error('Varsayılan kasa ayarlanamadı: ' + e.message);
    }
  },

  async transfer(sourceId, targetId, amount, description) {
    try {
      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        if (sourceId === targetId) throw new Error('Kaynak ve hedef kasa aynı olamaz.');
        if (amount <= 0) throw new Error('Transfer tutarı sıfırdan büyük olmalıdır.');

        const sourceReg = await db.cash_registers.get(sourceId);
        const targetReg = await db.cash_registers.get(targetId);

        if (!sourceReg) throw new Error('Kaynak kasa bulunamadı.');
        if (!targetReg) throw new Error('Hedef kasa bulunamadı.');

        const sourceGenBal = sourceReg.general_balance ?? sourceReg.current_balance ?? 0;
        const sourceDailyNet = (sourceReg.current_balance ?? 0) - sourceGenBal;
        
        let genBalImpactOut = 0;
        if (sourceDailyNet > 0) {
           genBalImpactOut = Math.max(0, amount - sourceDailyNet);
        } else {
           genBalImpactOut = amount;
        }

        const sourceNewBalance = (sourceReg.current_balance || 0) - amount;
        const sourceNewGenBal = sourceGenBal - genBalImpactOut;

        const targetGenBal = targetReg.general_balance ?? targetReg.current_balance ?? 0;
        const targetNewBalance = (targetReg.current_balance || 0) + amount;
        const targetNewGenBal = targetGenBal + amount;

        await db.cash_registers.update(sourceId, { 
          current_balance: sourceNewBalance,
          general_balance: sourceNewGenBal
        });
        
        await db.cash_registers.update(targetId, { 
          current_balance: targetNewBalance,
          general_balance: targetNewGenBal
        });

        await db.cash_transactions.add({
          register_id: sourceId,
          transaction_type: 'transfer_out',
          amount: amount,
          balance_after: sourceNewBalance,
          gen_bal_impact: -genBalImpactOut,
          notes: `Transfer: ${sourceReg.name} → ${targetReg.name}${description ? ' | ' + description : ''}`,
          created_at: Date.now()
        });

        await db.cash_transactions.add({
          register_id: targetId,
          transaction_type: 'transfer_in',
          amount: amount,
          balance_after: targetNewBalance,
          gen_bal_impact: amount,
          notes: `Transfer: ${targetReg.name} ← ${sourceReg.name}${description ? ' | ' + description : ''}`,
          created_at: Date.now() + 1
        });

        return true;
      });
    } catch (e) {
      throw new Error('Transfer işlemi başarısız: ' + e.message);
    }
  },

  async isRegisterOpen(registerId) {
    return true; // Kasa aç/kapat algoritması tamamen devredışı bırakıldı
  },

  async openRegister(registerId, countedAmount, note) {
    try {
      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        const isOpen = await this.isRegisterOpen(registerId);
        if (isOpen) throw new Error('Bu kasa zaten açık.');

        const reg = await db.cash_registers.get(registerId);
        if (!reg) throw new Error('Kasa bulunamadı.');

        // Update balance to counted amount (if different from expected, note helps debug)
        const expected = reg.current_balance || 0;
        const diff = countedAmount - expected;
        const diffNote = diff !== 0 ? ` [Sistem: ${expected}, Fak: ${diff}]` : '';

        await db.cash_registers.update(registerId, { current_balance: countedAmount });

        await db.cash_transactions.add({
          register_id: registerId,
          transaction_type: 'opening',
          amount: countedAmount,
          balance_after: countedAmount, // Not purely math based if there was difference, it OVERWRITES the logic
          notes: `${note || 'Gün başı açılış'}${diffNote}`,
          created_at: Date.now()
        });

        return true;
      });
    } catch (e) {
      throw new Error('Açılış hatası: ' + e.message);
    }
  },

  async closeRegister(registerId, countedAmount, action, floatAmount, note) {
    try {
      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
        const isOpen = await this.isRegisterOpen(registerId);
        if (!isOpen) throw new Error('Kasa zaten kapalı.');

        const reg = await db.cash_registers.get(registerId);
        if (!reg) throw new Error('Kasa bulunamadı.');

        const expected = reg.current_balance || 0;
        const diff = countedAmount - expected;
        const diffNote = diff !== 0 ? ` [Hesaplanan: ${expected}, Fak: ${diff}]` : '';

        // 1. Log Kapanış
        await db.cash_transactions.add({
          register_id: registerId,
          transaction_type: 'closing',
          amount: countedAmount, // we just record what they counted
          balance_after: countedAmount, // system temporarily resets truth to what was physically counted
          notes: `${note || 'Gün sonu kapanış'}${diffNote}`,
          created_at: Date.now()
        });

        // 2. Action based log and final balance
        let finalBalance = countedAmount;

        if (action === 'withdraw_all') {
          // everything physically withdrawn
          await db.cash_transactions.add({
            register_id: registerId,
            transaction_type: 'withdrawal_out',
            amount: countedAmount,
            balance_after: 0,
            notes: 'Kapanış Nakit Teslimi (Tümü)',
            created_at: Date.now() + 10 // strictly after closing
          });
          finalBalance = 0;
        } else if (action === 'keep_float') {
          const withdrawAmount = countedAmount - floatAmount;
          if (withdrawAmount > 0) {
            await db.cash_transactions.add({
              register_id: registerId,
              transaction_type: 'withdrawal_out',
              amount: withdrawAmount,
              balance_after: floatAmount,
              notes: `Kapanış Nakit Teslimi. (Kalan Fon: ${floatAmount})`,
              created_at: Date.now() + 10
            });
            finalBalance = floatAmount;
          }
        } 
        // else keep_all -> do nothing, balance is exactly counted amount

        await db.cash_registers.update(registerId, { current_balance: finalBalance });
        return true;
      });
    } catch (e) {
      throw new Error('Kapanış hatası: ' + e.message);
    }
  },

  async addTransaction(registerId, type, amount, description, transactionDate = null) {
    try {
      return await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {

        const reg = await db.cash_registers.get(registerId);
        if (!reg) throw new Error('Kasa bulunamadı.');

        let newBalance = reg.current_balance || 0;
        
        // Define INS and OUTS
        const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in'];
        const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out'];

        if (ins.includes(type) || type === 'in') newBalance += amount;
        else if (outs.includes(type) || type === 'out') newBalance -= amount;

        newBalance = Math.round(newBalance * 100) / 100;

        await db.cash_registers.update(registerId, { current_balance: newBalance });

        await db.cash_transactions.add({
          register_id: registerId,
          transaction_type: type,
          amount,
          balance_after: newBalance,
          notes: description,
          created_at: transactionDate ? new Date(transactionDate).getTime() : Date.now()
        });

        return newBalance;
      });
    } catch (e) {
      throw new Error('İşlem kaydedilemedi: ' + e.message);
    }
  },

  async getTransactions(registerId, filters = {}) {
    try {
      let query = db.cash_transactions.where('register_id').equals(registerId);
      let txs = await query.reverse().sortBy('created_at');

      if (filters.startDate && filters.endDate) {
        txs = txs.filter(t => isWithinInterval(t.created_at, { start: filters.startDate, end: filters.endDate }));
      }
      if (filters.type && filters.type !== 'all') {
        txs = txs.filter(t => t.transaction_type === filters.type);
      }
      return txs;
    } catch (e) {
      throw new Error('İşlem geçmişi alınamadı.');
    }
  },

  async getDailySummary(registerId, targetDate = new Date()) {
    try {
      const { dayCloseService } = await import('./dayCloseService');
      const reg = await db.cash_registers.get(registerId);
      if (!reg) throw new Error('Kasa bulunamadı');

      // Use the new centralized dayCloseService for filtering logic
      const effectiveTxs = await dayCloseService.getRegisterTransactionsForToday(reg);

      const summary = {
        openingAmount: 0,
        totals: {
          sale_in: 0,
          customer_payment_in: 0,
          deposit_in: 0,
          return_in: 0,
          expense_out: 0,
          supplier_payment_out: 0,
          withdrawal_out: 0,
          purchase_out: 0
        },
        calculatedClosing: 0
      };

      // Find the LATEST opening of today or just take the first opening 
      const openingTx = effectiveTxs.slice().reverse().find(t => t.transaction_type === 'opening');
      if (openingTx) {
        summary.openingAmount = openingTx.amount;
        summary.calculatedClosing = openingTx.amount;
      } else {
        // if no opening today, try to figure out from last balance
        const reg = await db.cash_registers.get(registerId);
         // not 100% accurate historically, but works for live daily tracking
        summary.calculatedClosing = reg ? reg.current_balance : 0;
      }

      const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in'];
      const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out'];

      effectiveTxs.forEach(t => {
        if (t.transaction_type !== 'opening' && t.transaction_type !== 'closing') {
          if (summary.totals[t.transaction_type] !== undefined) {
             summary.totals[t.transaction_type] += t.amount;
          }
          
          // only affect calculated closing if we are basing it off opening amount logic
          if (openingTx) {
            if (ins.includes(t.transaction_type) || t.transaction_type === 'in') summary.calculatedClosing += t.amount;
            else if (outs.includes(t.transaction_type) || t.transaction_type === 'out') summary.calculatedClosing -= t.amount;
          }
        }
      });

      return summary;
    } catch (e) {
      throw e;
    }
  },

  async deleteTransaction(id) {
    return await db.transaction('rw', [db.cash_transactions, db.cash_registers, db.suppliers, db.supplier_transactions, db.customers, db.customer_transactions, db.purchases, db.sales], async () => {
      const tx = await db.cash_transactions.get(id);
      if (!tx) throw new Error('Hareket bulunamadı.');

      const reg = await db.cash_registers.get(tx.register_id);
      if (!reg) throw new Error('İlgili kasa bulunamadı.');

      const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in', 'transfer_in'];
      const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'transfer_out'];

      // 1. Bu kaydın kasasını geri al
      let newRegBalance = reg.current_balance;
      let newGenBalance = reg.general_balance ?? reg.current_balance ?? 0;
      
      if (ins.includes(tx.transaction_type)) {
        newRegBalance -= tx.amount;
        if (tx.transaction_type === 'transfer_in') newGenBalance -= (tx.gen_bal_impact ?? tx.amount);
      } else if (outs.includes(tx.transaction_type)) {
        newRegBalance += tx.amount;
        if (tx.transaction_type === 'transfer_out') newGenBalance -= (tx.gen_bal_impact ?? 0); // gen_bal_impact negative
      }
      
      await db.cash_registers.update(reg.id, { 
        current_balance: Math.round(newRegBalance * 100) / 100,
        general_balance: Math.round(newGenBalance * 100) / 100
      });

      // 2. Transfer ise — karşı kasa kaydını da bul ve iptal et
      if (tx.transaction_type === 'transfer_out' || tx.transaction_type === 'transfer_in') {
        // transfer_out ve transfer_in hemen ardısıra oluşturulur; notes içinde karşı kasa adı var.
        // En güvenilir yol: aynı tutarda, aynı created_at ±1ms olan karşı transaction'ı bul
        const paired = await db.cash_transactions
          .where('amount').equals(tx.amount)
          .filter(t =>
            t.id !== id &&
            Math.abs(t.created_at - tx.created_at) <= 2 &&
            (
              (tx.transaction_type === 'transfer_out' && t.transaction_type === 'transfer_in') ||
              (tx.transaction_type === 'transfer_in' && t.transaction_type === 'transfer_out')
            )
          )
          .first();

        if (paired) {
          const pairedReg = await db.cash_registers.get(paired.register_id);
          if (pairedReg) {
            let pairedBalance = pairedReg.current_balance;
            let pairedGen = pairedReg.general_balance ?? pairedReg.current_balance ?? 0;
            if (paired.transaction_type === 'transfer_in') {
              pairedBalance -= paired.amount;
              pairedGen -= (paired.gen_bal_impact ?? paired.amount);
            }
            else if (paired.transaction_type === 'transfer_out') {
              pairedBalance += paired.amount;
              pairedGen -= (paired.gen_bal_impact ?? 0);
            }
            await db.cash_registers.update(pairedReg.id, { 
              current_balance: Math.round(pairedBalance * 100) / 100,
              general_balance: Math.round(pairedGen * 100) / 100
            });
          }
          await db.cash_transactions.delete(paired.id);
        }

        await db.cash_transactions.delete(id);
        return true;
      }

      // 3. Ters Fiş (Cari/Tedarikçi) - Seçenek B
      const now = Date.now();

      if (tx.transaction_type === 'supplier_payment_out') {
        if (!tx.purchase_id) throw new Error('Bu tedarikçi ödemesinin bağlı olduğu fatura bulunamadı.');
        const purchase = await db.purchases.get(tx.purchase_id);
        if (purchase) {
          const supplier = await db.suppliers.get(purchase.supplier_id);
          if (supplier) {
            const newSupBalance = (supplier.balance || 0) + tx.amount;
            await db.suppliers.update(supplier.id, { balance: Math.round(newSupBalance * 100) / 100 });
            await db.supplier_transactions.add({
              supplier_id: supplier.id,
              transaction_type: 'adjustment',
              amount: tx.amount,
              balance_after: Math.round(newSupBalance * 100) / 100,
              notes: `Kasa Üzerinden Ödeme İptali (İşlem: ${tx.id})`,
              created_at: now
            });
          }
        }
      } else if (tx.transaction_type === 'customer_payment_in') {
        if (!tx.reference_id) throw new Error('Bu cari tahsilatının bağlı olduğu işlem bulunamadı.');
        const sale = await db.sales.get(tx.reference_id);
        if (sale) {
          const customer = await db.customers.get(sale.customer_id);
          if (customer) {
            const newCusBalance = (customer.balance || 0) + tx.amount;
            await db.customers.update(customer.id, { balance: Math.round(newCusBalance * 100) / 100 });
            await db.customer_transactions.add({
              customer_id: customer.id,
              transaction_type: 'adjustment',
              amount: tx.amount,
              balance_after: Math.round(newCusBalance * 100) / 100,
              notes: `Kasa Üzerinden Tahsilat İptali (İşlem: ${tx.id})`,
              created_at: now
            });
          }
        }
      }

      await db.cash_transactions.delete(id);
      return true;
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
        // Eski kasadan hareketi tamamen geri al
        let oldRegBalance = oldReg.current_balance;
        if (ins.includes(tx.transaction_type)) oldRegBalance -= tx.amount;
        else if (outs.includes(tx.transaction_type)) oldRegBalance += tx.amount;
        await db.cash_registers.update(oldReg.id, { current_balance: Math.round(oldRegBalance * 100) / 100 });

        // Yeni kasayı bul ve hareketi uygula
        const newReg = await db.cash_registers.get(newRegisterId);
        if (!newReg) throw new Error('Seçilen kasa bulunamadı.');
        let newRegBalance = newReg.current_balance;
        if (ins.includes(tx.transaction_type)) newRegBalance += newAmount;
        else if (outs.includes(tx.transaction_type)) newRegBalance -= newAmount;
        await db.cash_registers.update(newReg.id, { current_balance: Math.round(newRegBalance * 100) / 100 });
      } else {
        // Aynı kasa — sadece tutar farkı işle
        const diff = newAmount - tx.amount;
        if (diff !== 0) {
          let newRegBalance = oldReg.current_balance;
          if (ins.includes(tx.transaction_type)) newRegBalance += diff;
          else if (outs.includes(tx.transaction_type)) newRegBalance -= diff;
          await db.cash_registers.update(oldReg.id, { current_balance: Math.round(newRegBalance * 100) / 100 });
        }
      }

      // Cari/Tedarikçi ters fiş (sadece tutar değişiminde)
      const now = Date.now();
      const diff = newAmount - tx.amount;
      if (diff !== 0) {
        if (tx.transaction_type === 'supplier_payment_out') {
          const purchase = tx.purchase_id ? await db.purchases.get(tx.purchase_id) : null;
          if (purchase) {
            const supplier = await db.suppliers.get(purchase.supplier_id);
            if (supplier) {
              const newSupBalance = (supplier.balance || 0) - diff;
              await db.suppliers.update(supplier.id, { balance: Math.round(newSupBalance * 100) / 100 });
              await db.supplier_transactions.add({
                supplier_id: supplier.id, transaction_type: 'adjustment',
                amount: Math.abs(diff), balance_after: Math.round(newSupBalance * 100) / 100,
                notes: `Kasa Üzerinden Ödeme Tutarı Düzeltmesi`, created_at: now
              });
            }
          }
        } else if (tx.transaction_type === 'customer_payment_in') {
          const sale = tx.reference_id ? await db.sales.get(tx.reference_id) : null;
          if (sale) {
            const customer = await db.customers.get(sale.customer_id);
            if (customer) {
              const newCusBalance = (customer.balance || 0) - diff;
              await db.customers.update(customer.id, { balance: Math.round(newCusBalance * 100) / 100 });
              await db.customer_transactions.add({
                customer_id: customer.id, transaction_type: 'adjustment',
                amount: Math.abs(diff), balance_after: Math.round(newCusBalance * 100) / 100,
                notes: `Kasa Üzerinden Tahsilat Tutarı Düzeltmesi`, created_at: now
              });
            }
          }
        }
      }

      // Kaydı güncelle
      const updatePayload = { amount: newAmount, notes: data.notes };
      if (registerChanged) updatePayload.register_id = newRegisterId;
      if (data.created_at) updatePayload.created_at = data.created_at;

      await db.cash_transactions.update(id, updatePayload);
      return true;
    });
  }
};
