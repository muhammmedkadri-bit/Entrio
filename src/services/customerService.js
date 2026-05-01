import { db } from '../db';
import { isWithinInterval } from 'date-fns';

export const customerService = {
  async getAll(filters = {}) {
    let customers = await db.customers.toArray();
    customers = customers.filter(c => c.is_active !== false);

    if (filters.search) {
      const query = filters.search.toLowerCase();
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query)) ||
        (c.tax_number && c.tax_number.includes(query))
      );
    }

    if (filters.customerType && filters.customerType !== 'all') {
      customers = customers.filter(c => c.customer_type === filters.customerType);
    }

    if (filters.balanceStatus) {
      let customFilter = (c) => true;
      if (filters.balanceStatus === 'debt') customFilter = c => c.balance > 0;
      else if (filters.balanceStatus === 'credit') customFilter = c => c.balance < 0;
      else if (filters.balanceStatus === 'zero') customFilter = c => c.balance === 0 || !c.balance;

      customers = customers.filter(customFilter);
    }

    return customers;
  },

  async getById(id) {
    const customer = await db.customers.get(id);
    if (!customer) throw new Error('Müşteri bulunamadı.');
    return customer;
  },

  async create(data) {
    try {
      return await db.transaction('rw', db.customers, db.customer_transactions, async () => {
        const openingBalance = parseFloat(data.opening_balance) || 0;
        const dataToSave = { ...data, balance: openingBalance, is_active: true };
        delete dataToSave.opening_balance; 
        
        const id = await db.customers.add(dataToSave);

        if (openingBalance !== 0) {
          await db.customer_transactions.add({
            customer_id: id,
            transaction_type: 'adjustment',
            amount: Math.abs(openingBalance),
            balance_after: openingBalance,
            notes: 'Açılış Bakiyesi',
            created_at: Date.now()
          });
        }
        return { id, ...dataToSave };
      });
    } catch (error) {
      throw new Error('Müşteri eklenirken hata oluştu.');
    }
  },

  async update(id, data) {
    try {
      const dataToSave = { ...data };
      delete dataToSave.opening_balance; 
      await db.customers.update(id, dataToSave);
      return await this.getById(id);
    } catch (error) {
      throw new Error('Müşteri güncellenirken hata oluştu.');
    }
  },

  async delete(id) {
    const c = await this.getById(id);
    if (c.balance !== 0 && c.balance !== undefined) {
      throw new Error('Bakiyesi olan bir müşteri silinemez. Önce hesabı sıfırlamalısınız.');
    }
    await db.customers.update(id, { is_active: false });
    return true;
  },

  async collectPayment(customerId, amount, method, registerId, description) {
    try {
      return await db.transaction('rw', db.customers, db.customer_transactions, db.cash_registers, db.cash_transactions, db.sales, async () => {
        const customer = await db.customers.get(customerId);
        if (!customer) throw new Error('Müşteri bulunamadı.');

        const newBalance = Math.round((customer.balance - amount) * 100) / 100;
        await db.customers.update(customerId, { balance: newBalance });

        await db.customer_transactions.add({
          customer_id: customerId,
          transaction_type: 'payment',
          amount,
          balance_after: newBalance,
          notes: description || `Tahsilat (${method})`,
          created_at: Date.now()
        });

        // ── FIFO Mantığı ile Açık Faturalara Dağıtım ──
        let remainingToDistribute = amount;
        
        // Müşterinin tüm satışlarını çekip sadece açık olanları tarihe göre (eskiden yeniye) sıralıyoruz
        const allSales = await db.sales.where('customer_id').equals(customerId).toArray();
        const unpaidSales = allSales
          .filter(s => s.status === 'pending' || (s.total_amount > (s.paid_amount || 0)))
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        for (const sale of unpaidSales) {
          if (remainingToDistribute <= 0) break;
          
          const debt = Math.max(0, sale.total_amount - (sale.paid_amount || 0));
          if (debt <= 0) continue;

          const applyAmt = Math.min(debt, remainingToDistribute);
          const newPaidAmount = Math.round(((sale.paid_amount || 0) + applyAmt) * 100) / 100;
          
          await db.sales.update(sale.id, {
            paid_amount: newPaidAmount,
            status: newPaidAmount >= sale.total_amount ? 'completed' : 'pending'
          });

          // İlgili faturaya kasa/ödeme hareketini bağla (Eğer kasa seçildiyse)
          if (registerId) {
            await db.cash_transactions.add({
              reference_id: sale.id, // Bu id sayesinde Satış Hareketlerinde listelenecek
              register_id: registerId,
              transaction_type: 'customer_payment_in',
              amount: applyAmt,
              notes: description || `Tahsilat (${method}) - Toplu Dağılım`,
              created_at: Date.now()
            });
          }

          remainingToDistribute -= applyAmt;
        }

        // Eğer hala dağıtılamayan tutar kaldıysa (örneğin avans ödemesi), onu da kasaya genel gelir olarak kaydet
        if (remainingToDistribute > 0 && registerId) {
          await db.cash_transactions.add({
            register_id: registerId,
            transaction_type: 'customer_payment_in',
            amount: remainingToDistribute,
            notes: description || `Tahsilat: ${customer.name} (Fazla/Avans Ödeme)`,
            created_at: Date.now()
          });
        }

        // Kasa bakiyesini güncelle
        if (registerId) {
          const reg = await db.cash_registers.get(registerId);
          if (reg) {
            await db.cash_registers.update(registerId, { current_balance: Math.round((reg.current_balance + amount) * 100) / 100 });
          }
        }

        return newBalance;
      });
    } catch (error) {
      throw new Error('Tahsilat kaydedilirken hata oluştu: ' + error.message);
    }
  },

  /**
   * Müşteriye nakit iade veya mahsuplaşma (balance < 0 — biz müşteriye borçluyuz).
   * type = 'cash_refund' -> kasa hareketli çıkış (out)
   * type = 'offset'      -> sadece cari balance güncellenir
   */
  async refundCustomer(customerId, amount, type, method, registerId, date, description) {
    try {
      const tables = [db.customers, db.customer_transactions];
      if (type === 'cash_refund') {
        tables.push(db.cash_transactions, db.cash_registers);
      }

      return await db.transaction('rw', tables, async () => {
        const customer = await db.customers.get(customerId);
        if (!customer) throw new Error('Müşteri bulunamadı.');

        const currentBalance = parseFloat(customer.balance) || 0;
        if (currentBalance >= 0) throw new Error('Müşterinin iade edilecek alacağı bulunmuyor.');

        const maxRefundable = Math.abs(currentBalance);
        if (amount > maxRefundable + 0.001) throw new Error(`İade tutarı, müşteri alacağını (${maxRefundable.toFixed(2)}₺) aşamaz.`);

        // balance < 0 (müşteri alacaklı). adding amount pushes it towards 0.
        const newBalance = Math.round((currentBalance + amount) * 100) / 100;
        await db.customers.update(customerId, { balance: newBalance });

        await db.customer_transactions.add({
          customer_id: customerId,
          transaction_type: type === 'offset' ? 'offset' : 'refund',
          amount,
          balance_after: newBalance,
          payment_method: type === 'cash_refund' ? method : 'offset',
          transaction_date: date || new Date().toISOString().split('T')[0],
          notes: description || (type === 'offset' ? 'Mahsuplaşma' : `İade (${method})`),
          created_at: Date.now()
        });

        if (type === 'cash_refund' && registerId) {
          const regId = parseInt(registerId);
          await db.cash_transactions.add({
            register_id: regId,
            transaction_type: 'expense_out',
            amount,
            notes: `Müşteriye İade: ${customer.name}`,
            created_at: Date.now()
          });

          const reg = await db.cash_registers.get(regId);
          if (reg) {
            await db.cash_registers.update(regId, {
              current_balance: Math.round((reg.current_balance - amount) * 100) / 100
            });
          }
        }

        return newBalance;
      });
    } catch (error) {
      throw new Error('İade kaydedilirken hata oluştu: ' + error.message);
    }
  },

  async getTransactions(customerId, filters = {}) {
    try {
      let txs = await db.customer_transactions.where('customer_id').equals(customerId).toArray();
      txs.sort((a, b) => {
        const dayA = new Date(a.created_at).setHours(0, 0, 0, 0);
        const dayB = new Date(b.created_at).setHours(0, 0, 0, 0);
        if (dayA === dayB) return b.id - a.id;
        return b.created_at - a.created_at;
      });

      if (filters.startDate && filters.endDate) {
        txs = txs.filter(t => isWithinInterval(t.created_at, { start: filters.startDate, end: filters.endDate }));
      }
      if (filters.type && filters.type !== 'all') {
        txs = txs.filter(t => t.transaction_type === filters.type);
      }
      return txs;
    } catch (error) {
      throw new Error('İşlem geçmişi getirilirken hata oluştu.');
    }
  },

  async getSummary() {
    try {
      const customers = await this.getAll();
      const totalCount = customers.length;
      let totalReceivable = 0; 
      let totalDebt = 0;       

      customers.forEach(c => {
        const bal = parseFloat(c.balance) || 0;
        if (bal > 0) totalReceivable += bal;
        else if (bal < 0) totalDebt += Math.abs(bal);
      });

      return {
        totalCount,
        totalReceivable,
        totalDebt,
        netBalance: totalReceivable - totalDebt
      };
    } catch (error) {
      return { totalCount: 0, totalReceivable: 0, totalDebt: 0, netBalance: 0 };
    }
  }
};
