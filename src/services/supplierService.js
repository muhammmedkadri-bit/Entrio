import { db } from '../db';
import { isWithinInterval } from 'date-fns';

export const supplierService = {
  async getAll(filters = {}) {
    try {
      let suppliers = await db.suppliers.toArray();
      if (filters.activeOnly !== false) {
        suppliers = suppliers.filter(s => s.is_active !== false);
      }

      if (filters.search) {
        const query = filters.search.toLowerCase();
        suppliers = suppliers.filter(s => 
          s.name.toLowerCase().includes(query) || 
          (s.phone && s.phone.includes(query)) ||
          (s.tax_number && s.tax_number.includes(query))
        );
      }

      if (filters.balanceStatus) {
        let customFilter = (s) => true;
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
      const supplier = await db.suppliers.get(id);
      if (!supplier) throw new Error('Tedarikçi bulunamadı.');
      return supplier;
    } catch (error) {
      throw error;
    }
  },

  async create(data) {
    try {
      return await db.transaction('rw', db.suppliers, db.supplier_transactions, async () => {
        const openingBalance = parseFloat(data.opening_balance) || 0;
        const dataToSave = { ...data, balance: openingBalance, is_active: true };
        delete dataToSave.opening_balance;

        const id = await db.suppliers.add(dataToSave);

        if (openingBalance !== 0) {
          await db.supplier_transactions.add({
            supplier_id: id,
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
      throw new Error('Tedarikçi eklenirken hata oluştu.');
    }
  },

  async update(id, data) {
    try {
      const dataToSave = { ...data };
      delete dataToSave.opening_balance;
      await db.suppliers.update(id, dataToSave);
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
      await db.suppliers.update(id, { is_active: false });
      return true;
    } catch (error) {
      throw error;
    }
  },

  async addTransaction(supplierId, type, amount, notes = '', referenceId = null) {
    try {
      return await db.transaction('rw', db.suppliers, db.supplier_transactions, async () => {
        const supplier = await db.suppliers.get(supplierId);
        if (!supplier) throw new Error('Tedarikçi bulunamadı.');

        let newBalance = supplier.balance || 0;
        if (type === 'purchase') newBalance += amount;
        else if (type === 'payment') newBalance -= amount;
        
        newBalance = Math.round(newBalance * 100) / 100;

        await db.suppliers.update(supplierId, { balance: newBalance });

        await db.supplier_transactions.add({
          supplier_id: supplierId,
          transaction_type: type,
          amount,
          balance_after: newBalance,
          notes,
          reference_id: referenceId,
          created_at: Date.now()
        });

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
    const tables = [
      db.suppliers, db.supplier_transactions,
      db.purchases, db.cash_transactions, db.cash_registers,
    ];
    return await db.transaction('rw', tables, async () => {
      const supplier = await db.suppliers.get(supplierId);
      if (!supplier) throw new Error('Tedarikçi bulunamadı.');

      const amt = Number(Number(totalAmount).toFixed(2));
      if (amt <= 0) throw new Error('Geçersiz ödeme tutarı.');

      const now = Date.now();

      // ── 1. Açık faturaları al, eskiden yeniye sırala ─────────────────────
      const allPurchases = await db.purchases
        .where('supplier_id').equals(supplierId)
        .filter(p =>
          p.status !== 'cancelled' &&
          Number(((p.total_amount || 0) - (p.paid_amount || 0)).toFixed(2)) > 0.001
        )
        .toArray();
      allPurchases.sort((a, b) => (a.created_at || 0) - (b.created_at || 0)); // FIFO: oldest first

      // ── 2. FIFO dağıtım ───────────────────────────────────────────────────
      let remaining = amt;
      const allocations = []; // { purchase_id, applied, invoice_number }

      for (const purchase of allPurchases) {
        if (remaining <= 0) break;
        const purchaseDebt = Number(
          ((purchase.total_amount || 0) - (purchase.paid_amount || 0)).toFixed(2)
        );
        const applied = Number(Math.min(remaining, purchaseDebt).toFixed(2));
        const newPaid  = Number(((purchase.paid_amount || 0) + applied).toFixed(2));

        await db.purchases.update(purchase.id, { paid_amount: newPaid });
        allocations.push({
          purchase_id:    purchase.id,
          applied,
          invoice_number: purchase.invoice_number || null,
          invoice_title:  purchase.invoice_title  || null,
        });
        remaining = Number((remaining - applied).toFixed(2));
      }

      // ── 3. Tedarikçi bakiyesini güncelle ─────────────────────────────────
      const newSupplierBalance = Number(((supplier.balance || 0) - amt).toFixed(2));
      await db.suppliers.update(supplierId, { balance: newSupplierBalance });

      // ── 4. supplier_transactions — her fatura payı için ayrı kayıt ───────
      let runningBal = parseFloat(supplier.balance) || 0;
      const baseNotes = (description || '').trim();

      for (let i = 0; i < allocations.length; i++) {
        const alloc = allocations[i];
        runningBal = Number((runningBal - alloc.applied).toFixed(2));
        const invoiceRef = alloc.invoice_number
          ? `${alloc.invoice_number}`
          : `Fatura #${alloc.purchase_id}`;
        const invoiceTitle = alloc.invoice_title || 'Alış Faturası';
        await db.supplier_transactions.add({
          supplier_id:      supplierId,
          transaction_type: 'payment',
          amount:           alloc.applied,
          balance_after:    runningBal,
          reference_id:     alloc.purchase_id,
          payment_method:   method,
          notes: baseNotes
            ? `${baseNotes} ← ${invoiceRef} (${invoiceTitle})`
            : `${invoiceRef} — ${invoiceTitle}`,
          created_at: now + i * 10,
        });
      }

      // ── 5. Cari avans — fazla ödeme durumu ───────────────────────────────
      if (remaining > 0.001) {
        runningBal = Number((runningBal - remaining).toFixed(2));
        await db.supplier_transactions.add({
          supplier_id:      supplierId,
          transaction_type: 'payment',
          amount:           remaining,
          balance_after:    runningBal,
          payment_method:   method,
          notes:            baseNotes ? `${baseNotes} (Cari Avans)` : 'Cari Avans — Fazla Ödeme',
          created_at:       now + allocations.length * 10,
        });
      }

      // ── 6. Kasa hareketi ─────────────────────────────────────────────────
      const methodToDefaultFor = {
        'Nakit':                 'cash',
        'Kredi Kartı':           'card',
        'Banka Havalesi / EFT':  'transfer',
        'Çek':                   null,
      };
      const defaultFor = methodToDefaultFor[method] ?? 'cash';

      let reg = null;
      if (registerId) {
        reg = await db.cash_registers.get(Number(registerId));
      }
      if (!reg && defaultFor) {
        reg = await db.cash_registers
          .filter(r => r.is_default_for === defaultFor && r.is_active !== false)
          .first();
      }

      if (reg) {
        // ── 6a. POS passthrough: müşteriden gelen kredi kartı tahsilatı (gelir) ────────
        if (passthroughIncome) {
          await db.cash_transactions.add({
            register_id:      reg.id,
            transaction_type: 'pos_card_in',
            amount:           amt,
            notes:            `Müşteri Kredi Kartı Tahsilatı → ${supplier.name} ödemesine yönlendirme`,
            created_at:       now - 1,
          });
          // Bakiyeyi geçici olarak artır; adım 6c geri düşürür → net 0
          const tmpBalance = Number(((reg.current_balance || 0) + amt).toFixed(2));
          await db.cash_registers.update(reg.id, { current_balance: tmpBalance });
          reg = { ...reg, current_balance: tmpBalance };
        }

        // ── 6b. Her fatura payı için gider kaydı ─────────────────────────────────────
        const methodLabel =
          method === 'Nakit'                      ? 'Nakit Kasa'
          : method === 'Kredi Kartı'              ? 'Kredi Kartı'
          : method === 'Kredi Kartı / Mail Order' ? 'Kredi Kartı / Mail Order'
          : method === 'Banka Havalesi / EFT'     ? 'Havale/EFT'
          : method;

        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i];
          const invoiceRef = alloc.invoice_number || `Fatura #${alloc.purchase_id}`;
          await db.cash_transactions.add({
            purchase_id:      Number(alloc.purchase_id),
            register_id:      reg.id,
            transaction_type: 'supplier_payment_out',
            amount:           alloc.applied,
            reference:        alloc.invoice_number || `ALI-${alloc.purchase_id}`,
            notes: baseNotes
              ? `${methodLabel}: ${baseNotes} (${invoiceRef})`
              : `${methodLabel} Ödemesi (${invoiceRef})`,
            created_at: now + i * 5,
          });
        }

        // ── 6c. Register bakiyesini toplam tutarla güncelle ──────────────────────────
        await db.cash_registers.update(reg.id, {
          current_balance: Number((reg.current_balance - amt).toFixed(2)),
        });
      }


      return {
        totalPaid:   amt,
        allocations,
        overpayment: remaining > 0.001 ? remaining : 0,
        newBalance:  newSupplierBalance,
      };
    });
  },


  async getTransactions(supplierId, filters = {}) {
    try {
      let txs = await db.supplier_transactions.where('supplier_id').equals(supplierId).toArray();
      txs.sort((a, b) => b.created_at - a.created_at);

      if (filters.startDate && filters.endDate) {
        txs = txs.filter(t => isWithinInterval(t.created_at, { start: filters.startDate, end: filters.endDate }));
      }
      if (filters.type && filters.type !== 'all') {
        txs = txs.filter(t => t.transaction_type === filters.type);
      }

      // Enrich purchase transactions with invoice_number and invoice_title from purchases table
      const purchaseIds = [...new Set(
        txs.filter(t => t.transaction_type === 'purchase' && t.reference_id).map(t => Number(t.reference_id))
      )];
      let invoiceMap = {};
      if (purchaseIds.length > 0) {
        const purchases = await Promise.all(purchaseIds.map(pid => db.purchases.get(pid).catch(() => null)));
        purchases.forEach(p => {
          if (p) invoiceMap[p.id] = {
            invoice_number: p.invoice_number || null,
            invoice_title:  p.invoice_title  || null,
          };
        });
      }

      return txs.map(t => {
        const info = (t.transaction_type === 'purchase' && t.reference_id)
          ? (invoiceMap[Number(t.reference_id)] || {})
          : {};
        return {
          ...t,
          invoice_number: info.invoice_number || null,
          invoice_title:  info.invoice_title  || null,
        };
      });
    } catch (error) {
      throw new Error('İşlem geçmişi getirilirken hata oluştu.');
    }
  },

  /**
   * Tedarikçiden tahsilat al (balance < 0 — biz alacaklıyız).
   * type = 'cash_collection' → kasa hareketi oluşur
   * type = 'offset'          → sadece bakiye güncellenir
   */
  async collectFromSupplier(supplierId, amount, type, method, registerId, date, description) {
    try {
      const tables = [db.suppliers, db.supplier_transactions];
      if (type === 'cash_collection') {
        tables.push(db.cash_transactions, db.cash_registers);
      }

      return await db.transaction('rw', tables, async () => {
        const supplier = await db.suppliers.get(supplierId);
        if (!supplier) throw new Error('Tedarikçi bulunamadı.');

        const currentBalance = parseFloat(supplier.balance) || 0;
        if (currentBalance >= 0) throw new Error('Tedarikçide tahsil edilecek alacak bulunmuyor.');

        const maxCollectable = Math.abs(currentBalance);
        if (amount > maxCollectable + 0.001) throw new Error(`Tahsilat tutarı alacak tutarını (${maxCollectable.toFixed(2)}₺) aşamaz.`);

        // balance < 0 means we are owed money. Adding amount brings it toward 0.
        const newBalance = Math.round((currentBalance + amount) * 100) / 100;
        await db.suppliers.update(supplierId, { balance: newBalance });

        await db.supplier_transactions.add({
          supplier_id: supplierId,
          transaction_type: type === 'offset' ? 'offset' : 'collection',
          amount,
          balance_after: newBalance,
          payment_method: type === 'cash_collection' ? method : 'offset',
          transaction_date: date || new Date().toISOString().split('T')[0],
          notes: description || (type === 'offset' ? 'Mahsuplaşma' : `Tahsilat (${method})`),
          created_at: Date.now()
        });

        // Cash register entry — only for cash_collection
        if (type === 'cash_collection' && registerId) {
          const regId = parseInt(registerId);
          await db.cash_transactions.add({
            register_id: regId,
            transaction_type: 'deposit_in',
            amount,
            notes: `Tedarikçi Tahsilatı: ${supplier.name}`,
            created_at: Date.now()
          });
          const reg = await db.cash_registers.get(regId);
          if (reg) {
            await db.cash_registers.update(regId, {
              current_balance: Math.round((reg.current_balance + amount) * 100) / 100
            });
          }
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
      const totalCount = suppliers.length;
      let totalDebt = 0;
      let totalReceivable = 0;

      suppliers.forEach(s => {
        const bal = parseFloat(s.balance) || 0;
        if (bal > 0) totalDebt += bal;
        else if (bal < 0) totalReceivable += Math.abs(bal);
      });

      return {
        totalCount,
        totalDebt,
        totalReceivable,
        netBalance: totalDebt - totalReceivable
      };
    } catch (error) {
      return { totalCount: 0, totalDebt: 0, totalReceivable: 0, netBalance: 0 };
    }
  }
};
