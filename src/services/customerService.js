import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { isWithinInterval } from 'date-fns';

export const customerService = {
  async getAll(filters = {}) {
    try {
      if (isSupabase()) {
        let query = supabase.from('customers').select('*').eq('is_active', true);
        if (filters.search) {
          query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
        }
        if (filters.customerType && filters.customerType !== 'all') {
          query = query.eq('customer_type', filters.customerType);
        }
        const { data, error } = await query.order('name');
        if (error) throw error;
        let customers = data;
        if (filters.balanceStatus) {
          if (filters.balanceStatus === 'debt') customers = customers.filter(c => Number(c.balance) > 0);
          else if (filters.balanceStatus === 'credit') customers = customers.filter(c => Number(c.balance) < 0);
          else if (filters.balanceStatus === 'zero') customers = customers.filter(c => !c.balance || Number(c.balance) === 0);
        }
        return customers;
      }

      // ── Dexie fallback ──
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
        let customFilter = () => true;
        if (filters.balanceStatus === 'debt') customFilter = c => c.balance > 0;
        else if (filters.balanceStatus === 'credit') customFilter = c => c.balance < 0;
        else if (filters.balanceStatus === 'zero') customFilter = c => c.balance === 0 || !c.balance;
        customers = customers.filter(customFilter);
      }
      return customers;
    } catch (error) {
      throw new Error('Müşteriler getirilirken hata oluştu.');
    }
  },

  async getById(id) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) throw new Error('Müşteri bulunamadı.');
        return data;
      }
      const customer = await db.customers.get(Number(id));
      if (!customer) throw new Error('Müşteri bulunamadı.');
      return customer;
    } catch (error) {
      throw error;
    }
  },

  async create(data) {
    try {
      const openingBalance = parseFloat(data.opening_balance) || 0;
      const { city, district, address, opening_balance, ...validData } = data;
      const dataToSave = { ...validData, balance: openingBalance, is_active: true };

      if (isSupabase()) {
        const { data: created, error } = await supabase.from('customers').insert([dataToSave]).select().single();
        if (error) throw error;
        if (openingBalance !== 0) {
          await supabase.from('customer_transactions').insert([{
            customer_id: created.id,
            transaction_type: 'adjustment',
            amount: Math.abs(openingBalance),
            balance_after: openingBalance,
            notes: 'Açılış Bakiyesi',
            created_at: Date.now()
          }]);
        }
        return created;
      }

      return await db.transaction('rw', db.customers, db.customer_transactions, async () => {
        const id = await db.customers.add(dataToSave);
        if (openingBalance !== 0) {
          await db.customer_transactions.add({
            customer_id: id, transaction_type: 'adjustment',
            amount: Math.abs(openingBalance), balance_after: openingBalance,
            notes: 'Açılış Bakiyesi', created_at: Date.now()
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
      const { city, district, address, opening_balance, ...validData } = data;
      const dataToSave = { ...validData };
      if (isSupabase()) {
        const { data: updated, error } = await supabase.from('customers').update(dataToSave).eq('id', id).select().single();
        if (error) throw error;
        return updated;
      }
      await db.customers.update(Number(id), dataToSave);
      return await this.getById(id);
    } catch (error) {
      throw new Error('Müşteri güncellenirken hata oluştu.');
    }
  },

  async delete(id) {
    try {
      const c = await this.getById(id);
      if (c.balance !== 0 && c.balance !== undefined) {
        throw new Error('Bakiyesi olan bir müşteri silinemez. Önce hesabı sıfırlamalısınız.');
      }
      if (isSupabase()) {
        const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', id);
        if (error) throw error;
        return true;
      }
      await db.customers.update(Number(id), { is_active: false });
      return true;
    } catch (error) {
      throw error;
    }
  },

  async collectPayment(customerId, amount, method, registerId, description) {
    try {
      if (isSupabase()) {
        const customer = await this.getById(customerId);
        const newBalance = Math.round((Number(customer.balance) - amount) * 100) / 100;

        // 1. Müşteri bakiyesini güncelle
        const { error: custErr } = await supabase.from('customers').update({ balance: newBalance }).eq('id', customerId);
        if (custErr) throw custErr;

        // 2. Müşteri hareket kaydı
        await supabase.from('customer_transactions').insert([{
          customer_id: customerId, transaction_type: 'payment',
          amount, balance_after: newBalance,
          notes: description || `Tahsilat (${method})`,
          created_at: Date.now()
        }]);

        // 3. FIFO: Açık satışlara dağıtım
        const { data: unpaidSales } = await supabase
          .from('sales')
          .select('*')
          .eq('customer_id', customerId)
          .or('status.eq.pending,paid_amount.lt.total_amount')
          .order('created_at', { ascending: true });

        let remaining = amount;
        for (const sale of (unpaidSales || [])) {
          if (remaining <= 0) break;
          const debt = Math.max(0, Number(sale.total_amount) - Number(sale.paid_amount || 0));
          if (debt <= 0) continue;
          const applyAmt = Math.min(debt, remaining);
          const newPaidAmount = Math.round((Number(sale.paid_amount || 0) + applyAmt) * 100) / 100;
          await supabase.from('sales').update({
            paid_amount: newPaidAmount,
            status: newPaidAmount >= Number(sale.total_amount) ? 'completed' : 'pending'
          }).eq('id', sale.id);
          if (registerId) {
            await supabase.from('cash_transactions').insert([{
              reference_id: sale.id, register_id: registerId,
              transaction_type: 'customer_payment_in', amount: applyAmt,
              notes: description || `Tahsilat (${method}) - Toplu Dağılım`,
              created_at: Date.now()
            }]);
          }
          remaining -= applyAmt;
        }

        // 4. Fazla avans kasa kaydı
        if (remaining > 0 && registerId) {
          await supabase.from('cash_transactions').insert([{
            register_id: registerId, transaction_type: 'customer_payment_in',
            amount: remaining, notes: description || `Tahsilat: ${customer.name} (Fazla/Avans Ödeme)`,
            created_at: Date.now()
          }]);
        }

        // 5. Kasa bakiyesi güncelle
        if (registerId) {
          const { data: reg } = await supabase.from('cash_registers').select('current_balance').eq('id', registerId).single();
          if (reg) {
            await supabase.from('cash_registers').update({
              current_balance: Math.round((Number(reg.current_balance) + amount) * 100) / 100
            }).eq('id', registerId);
          }
        }
        return newBalance;
      }

      // ── Dexie fallback ──
      return await db.transaction('rw', db.customers, db.customer_transactions, db.cash_registers, db.cash_transactions, db.sales, async () => {
        const customer = await db.customers.get(Number(customerId));
        if (!customer) throw new Error('Müşteri bulunamadı.');
        const newBalance = Math.round((customer.balance - amount) * 100) / 100;
        await db.customers.update(Number(customerId), { balance: newBalance });
        await db.customer_transactions.add({
          customer_id: Number(customerId), transaction_type: 'payment',
          amount, balance_after: newBalance,
          notes: description || `Tahsilat (${method})`, created_at: Date.now()
        });
        let remainingToDistribute = amount;
        const allSales = await db.sales.where('customer_id').equals(Number(customerId)).toArray();
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
          if (registerId) {
            await db.cash_transactions.add({
              reference_id: sale.id, register_id: registerId,
              transaction_type: 'customer_payment_in', amount: applyAmt,
              notes: description || `Tahsilat (${method}) - Toplu Dağılım`, created_at: Date.now()
            });
          }
          remainingToDistribute -= applyAmt;
        }
        if (remainingToDistribute > 0 && registerId) {
          await db.cash_transactions.add({
            register_id: registerId, transaction_type: 'customer_payment_in',
            amount: remainingToDistribute, notes: description || `Tahsilat: ${customer.name} (Fazla/Avans Ödeme)`,
            created_at: Date.now()
          });
        }
        if (registerId) {
          const reg = await db.cash_registers.get(Number(registerId));
          if (reg) await db.cash_registers.update(Number(registerId), { current_balance: Math.round((reg.current_balance + amount) * 100) / 100 });
        }
        return newBalance;
      });
    } catch (error) {
      throw new Error('Tahsilat kaydedilirken hata oluştu: ' + error.message);
    }
  },

  async refundCustomer(customerId, amount, type, method, registerId, date, description) {
    try {
      const customer = await this.getById(customerId);
      const currentBalance = parseFloat(customer.balance) || 0;
      if (currentBalance >= 0) throw new Error('Müşterinin iade edilecek alacağı bulunmuyor.');
      const maxRefundable = Math.abs(currentBalance);
      if (amount > maxRefundable + 0.001) throw new Error(`İade tutarı, müşteri alacağını (${maxRefundable.toFixed(2)}₺) aşamaz.`);
      const newBalance = Math.round((currentBalance + amount) * 100) / 100;

      if (isSupabase()) {
        await supabase.from('customers').update({ balance: newBalance }).eq('id', customerId);
        await supabase.from('customer_transactions').insert([{
          customer_id: customerId,
          transaction_type: type === 'offset' ? 'offset' : 'refund',
          amount, balance_after: newBalance,
          payment_method: type === 'cash_refund' ? method : 'offset',
          transaction_date: date || new Date().toISOString().split('T')[0],
          notes: description || (type === 'offset' ? 'Mahsuplaşma' : `İade (${method})`),
          created_at: Date.now()
        }]);
        if (type === 'cash_refund' && registerId) {
          await supabase.from('cash_transactions').insert([{
            register_id: parseInt(registerId), transaction_type: 'expense_out',
            amount, notes: `Müşteriye İade: ${customer.name}`, created_at: Date.now()
          }]);
          const { data: reg } = await supabase.from('cash_registers').select('current_balance').eq('id', registerId).single();
          if (reg) await supabase.from('cash_registers').update({ current_balance: Math.round((Number(reg.current_balance) - amount) * 100) / 100 }).eq('id', registerId);
        }
        return newBalance;
      }

      // ── Dexie fallback ──
      const tables = [db.customers, db.customer_transactions];
      if (type === 'cash_refund') tables.push(db.cash_transactions, db.cash_registers);
      return await db.transaction('rw', tables, async () => {
        await db.customers.update(Number(customerId), { balance: newBalance });
        await db.customer_transactions.add({
          customer_id: Number(customerId),
          transaction_type: type === 'offset' ? 'offset' : 'refund',
          amount, balance_after: newBalance,
          payment_method: type === 'cash_refund' ? method : 'offset',
          transaction_date: date || new Date().toISOString().split('T')[0],
          notes: description || (type === 'offset' ? 'Mahsuplaşma' : `İade (${method})`),
          created_at: Date.now()
        });
        if (type === 'cash_refund' && registerId) {
          const regId = parseInt(registerId);
          await db.cash_transactions.add({
            register_id: regId, transaction_type: 'expense_out',
            amount, notes: `Müşteriye İade: ${customer.name}`, created_at: Date.now()
          });
          const reg = await db.cash_registers.get(regId);
          if (reg) await db.cash_registers.update(regId, { current_balance: Math.round((reg.current_balance - amount) * 100) / 100 });
        }
        return newBalance;
      });
    } catch (error) {
      throw new Error('İade kaydedilirken hata oluştu: ' + error.message);
    }
  },

  async getTransactions(customerId, filters = {}) {
    try {
      const getTime = (val) => { if (!val) return 0; const n = Number(val); if (!isNaN(n)) return n; return new Date(val).getTime() || 0; };

      if (isSupabase()) {
        let query = supabase.from('customer_transactions').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        let txs = data || [];

        // Perakende satışları ve peşin ödenen diğer satışları da hareketlere dahil et
        const { data: salesData } = await supabase.from('sales').select('*').eq('customer_id', customerId);
        if (salesData && salesData.length > 0) {
            // Sadece veresiye (credit) OLMAYAN satışları veya perakende müşterisinin tüm satışlarını ekle
            // Çünkü veresiyeler zaten customer_transactions'a insert ediliyor (create_sale içinde)
            const cashSales = salesData.filter(s => 
                (s.payment_method !== 'credit' && s.status !== 'pending' && s.status !== 'partial') || Number(customerId) === 1
            );
            
            const salesTxs = cashSales.map(s => {
                const isReturn = s.status === 'return';
                return {
                    id: 'sale_' + s.id,
                    customer_id: s.customer_id,
                    transaction_type: isReturn ? 'return' : 'sale',
                    amount: s.total_amount,
                    balance_after: 0,
                    payment_method: s.payment_method,
                    transaction_date: new Date(getTime(s.created_at)).toISOString(),
                    reference_id: s.id,
                    sale_number: s.sale_number,
                    notes: isReturn ? 'Peşin Satış İadesi' : 'Peşin Satış',
                    created_at: s.created_at
                };
            });
            
        // Eğer aynı sale_number'a sahip customer_transactions varsa (örneğin partial payment), 
        // duplicate olmaması için salesTxs'den ayıklayalım
        const existingSaleNumbers = new Set(txs.map(t => t.sale_number).filter(Boolean));
        const uniqueSalesTxs = salesTxs.filter(st => !existingSaleNumbers.has(st.sale_number));

        let combinedTxs = [...txs, ...uniqueSalesTxs];

        // Matematik Hesaplama Mantığı Düzeltmesi
        // Önce işlemleri eskiden yeniye sıralıyoruz ki koşu bakiyesini hesaplayabilelim
        combinedTxs.sort((a, b) => getTime(a.created_at) - getTime(b.created_at));

        let currentBalance = 0;
        for (const t of combinedTxs) {
            if (typeof t.id === 'string' && t.id.startsWith('sale_')) {
                t.balance_after = currentBalance;
            } else {
                currentBalance = t.balance_after || 0;
            }
        }

        // UI için işlemleri yeniden sondan başa sıralıyoruz
        combinedTxs.sort((a, b) => {
          const dayA = new Date(a.created_at).setHours(0, 0, 0, 0);
          const dayB = new Date(b.created_at).setHours(0, 0, 0, 0);
          if (dayA === dayB) {
              const idA = typeof a.id === 'number' ? a.id : 0;
              const idB = typeof b.id === 'number' ? b.id : 0;
              if (idA && idB) return idB - idA;
              return typeof a.id === 'string' && typeof b.id === 'number' ? 1 : 
                     typeof a.id === 'number' && typeof b.id === 'string' ? -1 : 0;
          }
          return getTime(b.created_at) - getTime(a.created_at);
        });

        txs = combinedTxs;
        } // CLOSING salesData block

        if (filters.startDate && filters.endDate) {
          txs = txs.filter(t => isWithinInterval(getTime(t.created_at), { start: filters.startDate, end: filters.endDate }));
        }
        if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.transaction_type === filters.type);
        return txs;
      }

      let txs = await db.customer_transactions.where('customer_id').equals(Number(customerId)).toArray();
      
      // Dexie fallback için aynısı
      const allSales = await db.sales.where('customer_id').equals(Number(customerId)).toArray();
      const cashSales = allSales.filter(s => 
          (s.payment_method !== 'credit' && s.status !== 'pending' && s.status !== 'partial') || Number(customerId) === 1
      );
      const salesTxs = cashSales.map(s => {
          const isReturn = s.status === 'return';
          return {
              id: 'sale_' + s.id,
              customer_id: s.customer_id,
              transaction_type: isReturn ? 'return' : 'sale',
              amount: s.total_amount,
              balance_after: 0, // Geçici olarak 0, aşağıda hesaplanacak
              payment_method: s.payment_method,
              transaction_date: new Date(getTime(s.created_at)).toISOString(),
              reference_id: s.id,
              sale_number: s.sale_number,
              notes: isReturn ? 'Peşin Satış İadesi' : 'Peşin Satış',
              created_at: s.created_at
          };
      });
      const existingSaleNumbers = new Set(txs.map(t => t.sale_number).filter(Boolean));
      const uniqueSalesTxs = salesTxs.filter(st => !existingSaleNumbers.has(st.sale_number));
      
      let combinedTxs = [...txs, ...uniqueSalesTxs];

      // Matematik Hesaplama Mantığı Düzeltmesi (Peşin işlemlerde bakiye sıfırlanmasını engelle)
      // Önce işlemleri eskiden yeniye sıralıyoruz ki koşu bakiyesini hesaplayabilelim
      combinedTxs.sort((a, b) => getTime(a.created_at) - getTime(b.created_at));

      let currentBalance = 0;
      for (const t of combinedTxs) {
          if (typeof t.id === 'string' && t.id.startsWith('sale_')) {
              // Peşin ödemeli işlem net bakiyeyi değiştirmediği için anlık bakiye aynı kalır
              t.balance_after = currentBalance;
          } else {
              // Gerçek bir cari işlem, sistemdeki hesaplanmış bakiyeyi günceller
              currentBalance = t.balance_after || 0;
          }
      }

      // UI için işlemleri yeniden sondan başa (en yeni en üstte) sıralıyoruz
      combinedTxs.sort((a, b) => {
        const dayA = new Date(a.created_at).setHours(0, 0, 0, 0);
        const dayB = new Date(b.created_at).setHours(0, 0, 0, 0);
        if (dayA === dayB) {
            const idA = typeof a.id === 'number' ? a.id : 0;
            const idB = typeof b.id === 'number' ? b.id : 0;
            if (idA && idB) return idB - idA;
            return typeof a.id === 'string' && typeof b.id === 'number' ? 1 : 
                   typeof a.id === 'number' && typeof b.id === 'string' ? -1 : 0;
        }
        return getTime(b.created_at) - getTime(a.created_at);
      });
      
      txs = combinedTxs;
      
      if (filters.startDate && filters.endDate) txs = txs.filter(t => isWithinInterval(t.created_at, { start: filters.startDate, end: filters.endDate }));
      if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.transaction_type === filters.type);
      return txs;
    } catch (error) {
      throw new Error('İşlem geçmişi getirilirken hata oluştu.');
    }
  },

  async getSummary() {
    try {
      const customers = await this.getAll();
      let totalReceivable = 0;
      let totalDebt = 0;
      customers.forEach(c => {
        const bal = parseFloat(c.balance) || 0;
        if (bal > 0) totalReceivable += bal;
        else if (bal < 0) totalDebt += Math.abs(bal);
      });
      return { totalCount: customers.length, totalReceivable, totalDebt, netBalance: totalReceivable - totalDebt };
    } catch (error) {
      return { totalCount: 0, totalReceivable: 0, totalDebt: 0, netBalance: 0 };
    }
  }
};
