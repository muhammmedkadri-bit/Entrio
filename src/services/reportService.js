import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { startOfDay, endOfDay, isWithinInterval, format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

// ── Yardımcı: Supabase veya Dexie'den toplu veri çek ──────────────────────
async function fetchAll(table, dexieQuery) {
  if (isSupabase()) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw error;
    return data || [];
  }
  return await dexieQuery();
}

async function fetchFiltered(table, field, startMs, endMs, dexieQuery) {
  if (isSupabase()) {
    const { data, error } = await supabase.from(table).select('*').gte(field, startMs).lte(field, endMs);
    if (error) throw error;
    return data || [];
  }
  return await dexieQuery();
}

export const reportService = {
  
  // 1. SALES REPORT
  async getSalesSummary(startDate, endDate) {
    try {
      const allSales = await fetchFiltered('sales', 'created_at', startDate.getTime(), endDate.getTime(),
        () => db.sales.where('created_at').between(startDate.getTime(), endDate.getTime()).toArray());
      const validSales = allSales.filter(s => s.status === 'completed');

      const summary = {
        totalRevenue: 0,
        totalCount: validSales.length,
        avgBasket: 0,
        totalDiscount: 0,
        totalTax: 0,
        netRevenue: 0,
        totalGrossProfit: 0, // Yeni eklendi
        byPaymentMethod: { 
          cash: { count: 0, amount: 0 }, 
          card: { count: 0, amount: 0 }, 
          credit: { count: 0, amount: 0 }, 
          mixed: { count: 0, amount: 0 } 
        },
        dailySeries: [], // { date, total, count }
        topProducts: [],
        rawSales: [] // populated below
      };

      const dailyMap = new Map();
      const daysCount = differenceInDays(endOfDay(endDate), startOfDay(startDate));
      for (let i = 0; i <= daysCount; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dKey = format(d, 'dd MMMM', { locale: tr });
        dailyMap.set(dKey, { date: dKey, total: 0, count: 0 });
      }

      for (const sale of validSales) {
        summary.totalRevenue += (sale.total_amount || 0);
        summary.totalDiscount += (sale.discount_amount || 0);
        summary.totalTax += (sale.tax_amount || 0);

        if (!summary.byPaymentMethod[sale.payment_method]) {
          summary.byPaymentMethod[sale.payment_method] = { count: 0, amount: 0 };
        }
        
        summary.byPaymentMethod[sale.payment_method].count += 1;
        summary.byPaymentMethod[sale.payment_method].amount += sale.total_amount;

        const dayKey = format(sale.created_at, 'dd MMMM', { locale: tr });
        if (dailyMap.has(dayKey)) {
          const dayStat = dailyMap.get(dayKey);
          dayStat.total += sale.total_amount;
          dayStat.count += 1;
        }
      }

      summary.netRevenue = summary.totalRevenue - summary.totalDiscount;
      summary.avgBasket = summary.totalCount > 0 ? summary.totalRevenue / summary.totalCount : 0;
      summary.dailySeries = Array.from(dailyMap.values());

      // Sale Items for Top Products
      const saleIds = validSales.map(s => s.id);
      if (saleIds.length > 0) {
        let items = [];
        if (isSupabase()) {
          const { data } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
          items = data || [];
        } else {
          items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray();
        }

        // Fetch all related products in ONE single batch request (Fixing N+1 problem)
        const productIds = [...new Set(items.map(i => i.product_id))];
        let productsData = [];
        if (isSupabase()) {
          const { data } = await supabase.from('products').select('id, name, purchase_price').in('id', productIds);
          productsData = data || [];
        } else {
          productsData = await db.products.where('id').anyOf(productIds).toArray();
        }
        const productInfoMap = new Map(productsData.map(p => [p.id, p]));

        const productMap = new Map();
        const salesMap = new Map(validSales.map(s => [s.id, s]));

        for (const item of items) {
          const sale = salesMap.get(item.sale_id);
          if (!sale) continue;

          if (!productMap.has(item.product_id)) {
            const productInfo = productInfoMap.get(item.product_id);
            productMap.set(item.product_id, {
              id: item.product_id,
              name: productInfo?.name || item.product_name || 'Bilinmeyen Ürün',
              quantity: 0,
              revenue: 0,
              cost: 0
            });
          }
          const pStat = productMap.get(item.product_id);
          pStat.quantity += (item.quantity || 0);
          
          // Satış kaleminin brüt cirosu
          const rawItemRevenue = item.line_total || (item.unit_price * item.quantity) || 0;
          
          // Fiş genelinde uygulanan iskontonun bu ürüne düşen payını hesapla
          let proratedDiscount = 0;
          if (sale.discount_amount > 0 && sale.subtotal > 0) {
            const discountRatio = sale.discount_amount / sale.subtotal;
            proratedDiscount = rawItemRevenue * discountRatio;
          }
          
          // Gerçek ciro katkısı (İskonto düşülmüş hali)
          const netItemRevenue = rawItemRevenue - proratedDiscount;
          pStat.revenue += netItemRevenue;

          // Maliyet hesabı: O anki product_price üzerinden
          const productInfoCost = productInfoMap.get(item.product_id);
          pStat.cost += ((productInfoCost?.purchase_price || 0) * (item.quantity || 0));
        }

        const topP = Array.from(productMap.values()).map(p => {
          const profit = p.revenue - p.cost;
          return {
            ...p,
            profit,
            margin: p.revenue > 0 ? (profit / p.revenue) * 100 : 0
          };
        });

        // Toplam brüt kârı hesapla
        summary.totalGrossProfit = topP.reduce((acc, p) => acc + p.profit, 0);

        // Top 10 by quantity (only those with > 0 quantity)
        summary.topProducts = topP.filter(p => p.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
      }

      summary.rawSales = validSales;
      return summary;
    } catch(e) {
      console.error(e);
      throw new Error('Satış verisi hesaplanamadı.');
    }
  },

  // 2. STOCK REPORT
  async getStockReport() {
    try {
      const [products, categories] = await Promise.all([
        fetchAll('products', () => db.products.filter(p => p.is_active !== false).toArray()),
        fetchAll('categories', () => db.categories.toArray())
      ]);
      const activeProducts = products.filter(p => p.is_active !== false);

      const summary = {
        totalProducts: products.length,
        totalPurchaseValue: 0,
        totalSaleValue: 0,
        potentialProfit: 0,
        criticalCount: 0,
        outOfStockCount: 0,
        byCategory: [], // for chart
        criticalItems: [],
        valuationTable: []
      };

      const catMap = new Map();

      for (const p of activeProducts) {
        const stock = p.stock_quantity || 0;
        const pValue = stock * (p.purchase_price || 0);
        const sValue = stock * (p.sale_price || 0);

        summary.totalPurchaseValue += pValue;
        summary.totalSaleValue += sValue;

        if (p.min_stock_level > 0 && stock <= p.min_stock_level && stock > 0) {
          summary.criticalCount++;
          summary.criticalItems.push(p);
        } else if (stock <= 0) {
          summary.outOfStockCount++;
          if (p.min_stock_level > 0) summary.criticalItems.push(p);
        }

        const catName = categories.find(c => c.id === p.category_id)?.name || 'Kategorisiz';
        if (!catMap.has(catName)) {
          catMap.set(catName, { category: catName, purchase_value: 0, sale_value: 0 });
        }
        const cStat = catMap.get(catName);
        cStat.purchase_value += pValue;
        cStat.sale_value += sValue;

        summary.valuationTable.push({
          barcode: p.barcode,
          name: p.name,
          category: catName,
          stock: stock,
          purchase_price: p.purchase_price || 0,
          sale_price: p.sale_price || 0,
          purchase_value: pValue,
          sale_value: sValue,
          profit_potential: sValue - pValue,
          margin: sValue > 0 ? ((sValue - pValue) / sValue) * 100 : 0
        });
      }

      summary.potentialProfit = summary.totalSaleValue - summary.totalPurchaseValue;
      summary.byCategory = Array.from(catMap.values());
      
      // En yüksek değerli kategoriyi başa alalım
      summary.byCategory.sort((a,b) => b.sale_value - a.sale_value);

      return summary;
    } catch(e) {
      console.error(e);
      throw new Error('Stok verisi hesaplanamadı.');
    }
  },

  // 3. CARI REPORT
  async getCariReport(type = 'customer') {
    try {
      const sbTable   = type === 'customer' ? 'customers' : 'suppliers';
      const sbTxTable = type === 'customer' ? 'customer_transactions' : 'supplier_transactions';
      const idField   = type === 'customer' ? 'customer_id' : 'supplier_id';
      const dexieTable   = type === 'customer' ? db.customers : db.suppliers;
      const dexieTxTable = type === 'customer' ? db.customer_transactions : db.supplier_transactions;

      const entities = await fetchAll(sbTable, () => dexieTable.filter(e => e.is_active !== false).toArray());
      const activeFilt = entities.filter(e => e.is_active !== false);

      const summary = {
        totalReceivable: 0,
        totalPayable: 0,
        debtorCount: 0,
        highestDebtor: null,
        avgDebt: 0,
        activeCount: 0,
        cleanCount: 0,          // Borcu olmayan (temiz hesap) sayısı
        top5Debtors: [],        // En yüksek 5 borçlu
        balanceTable: []
      };

      let debtors = [];
      // tx sayısı toplu sorgu ile
      const txAll = isSupabase()
        ? (await supabase.from(sbTxTable).select(idField)).data || []
        : await dexieTxTable.toArray();
      const txCountMap = {};
      txAll.forEach(t => { txCountMap[t[idField]] = (txCountMap[t[idField]] || 0) + 1; });

      for (const e of activeFilt) {
        const bal = Number(e.balance) || 0;
        if (txCountMap[e.id] > 0) summary.activeCount++;

        if (bal > 0) {
          if (type === 'customer') summary.totalReceivable += bal;
          else summary.totalPayable += bal;
          summary.debtorCount++;
          debtors.push({ id: e.id, name: e.name, phone: e.phone, balance: bal });
        } else {
          summary.cleanCount++;
        }

        summary.balanceTable.push({
          name: e.name,
          phone: e.phone,
          endBalance: bal
        });
      }

      // Top 5 debtors by balance
      debtors.sort((a, b) => b.balance - a.balance);
      summary.top5Debtors = debtors.slice(0, 5);
      summary.highestDebtor = debtors[0] || null;
      summary.avgDebt = summary.debtorCount > 0
        ? (type === 'customer' ? summary.totalReceivable : summary.totalPayable) / summary.debtorCount
        : 0;

      return summary;
    } catch(e) {
      console.error(e);
      throw new Error('Cari veriler hesaplanamadı.');
    }
  },

  // 4. CASH REPORT & PROFIT LOSS (Ayrı ama birleşik yapılabilir)
  async getProfitLoss(startDate, endDate) {
    try {
      const allSales = await fetchFiltered('sales', 'created_at', startDate.getTime(), endDate.getTime(),
        () => db.sales.where('created_at').between(startDate.getTime(), endDate.getTime()).toArray());
      const completedSales = allSales.filter(s => s.status === 'completed');
      const cashTxs = await fetchFiltered('cash_transactions', 'created_at', startDate.getTime(), endDate.getTime(),
        () => db.cash_transactions.where('created_at').between(startDate.getTime(), endDate.getTime()).toArray());
      // Giderler
      const expenses = cashTxs.filter(t => t.transaction_type === 'expense_out').reduce((sum, t) => sum + t.amount, 0);

      const summary = {
        revenue: 0,
        discounts: 0,
        netRevenue: 0,
        cogs: 0, // Satılan Malın Maliyeti
        grossProfit: 0,
        grossMargin: 0,
        expenses: expenses,
        netProfit: 0,
        netMargin: 0,
        trend: [], // D/W/M
        productProfitability: [] // Top list
      };

      const dailyMap = new Map();
      const itemsMap = new Map();

      // Sales Processing
      const saleIds = completedSales.map(s => s.id);
      
      let items = [];
      if (saleIds.length > 0) {
        items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray();
      }

      for (const sale of completedSales) {
        summary.revenue += sale.total_amount;
        summary.discounts += sale.discount_amount;
      }
      summary.netRevenue = summary.revenue - summary.discounts;

      // COGS Calculation
      for (const item of items) {
        if (!itemsMap.has(item.product_id)) {
          const productInfo = isSupabase()
            ? (await supabase.from('products').select('name,purchase_price').eq('id', item.product_id).single()).data
            : await db.products.get(item.product_id);
          itemsMap.set(item.product_id, {
             id: item.product_id,
             name: productInfo?.name || 'Bilinmeyen',
             qty: 0,
             revenue: 0,
             costBase: productInfo?.purchase_price || 0
          });
        }
        const p = itemsMap.get(item.product_id);
        p.qty += item.quantity;
        p.revenue += item.total_price;
      }

      for (const p of Array.from(itemsMap.values())) {
        const rowCost = p.qty * p.costBase;
        summary.cogs += rowCost;
        
        summary.productProfitability.push({
           name: p.name,
           qty: p.qty,
           revenue: p.revenue,
           cost: rowCost,
           grossProfit: p.revenue - rowCost,
           margin: p.revenue > 0 ? ((p.revenue - rowCost) / p.revenue) * 100 : 0
        });
      }

      summary.grossProfit = summary.netRevenue - summary.cogs;
      summary.grossMargin = summary.netRevenue > 0 ? (summary.grossProfit / summary.netRevenue) * 100 : 0;

      summary.netProfit = summary.grossProfit - summary.expenses;
      summary.netMargin = summary.netRevenue > 0 ? (summary.netProfit / summary.netRevenue) * 100 : 0;

      summary.productProfitability.sort((a,b) => b.grossProfit - a.grossProfit);

      // Trend chart (günlük ciro, cogs ve kar)
      for (const sale of completedSales) {
        const d = format(sale.created_at, 'dd MMMM', { locale: tr });
        if (!dailyMap.has(d)) dailyMap.set(d, { date: d, revenue: 0, cogs: 0 });
        dailyMap.get(d).revenue += sale.total_amount;
      }

      // COGS dağıtımı (kaba gün)
      for (const item of items) {
         const parent = completedSales.find(s => s.id === item.sale_id);
         if (parent) {
           const d = format(parent.created_at, 'dd MMMM', { locale: tr });
           const costBase = itemsMap.get(item.product_id)?.costBase || 0;
           dailyMap.get(d).cogs += (item.quantity * costBase);
         }
      }

      summary.trend = Array.from(dailyMap.values()).map(x => ({
         ...x,
         profit: x.revenue - x.cogs
      }));

      return summary;

    } catch(e) {
      console.error(e);
      throw new Error('Kâr Zarar özeti çıkarılamadı.');
    }
  },

  async getDashboardStats() {
    try {
      const todayStart = startOfDay(new Date());
      const end = endOfDay(new Date());

      const allDayCloseTxs = await fetchFiltered('cash_transactions', 'created_at', todayStart.getTime(), end.getTime(),
        () => db.cash_transactions.where('created_at').between(todayStart.getTime(), end.getTime())
          .filter(t => t.is_day_close || t.transaction_type === 'day_close').toArray());
      
      const todayDayCloseTxs = allDayCloseTxs.filter(t => t.is_day_close || t.transaction_type === 'day_close');
      const latestDayClose = todayDayCloseTxs.sort((a, b) => Number(b.created_at) - Number(a.created_at))[0];
      const startTimestamp = latestDayClose ? Number(latestDayClose.created_at) : todayStart.getTime();

      // PARALLEL FETCH
      const [allSalesToday, todayTxs, registers] = await Promise.all([
        fetchFiltered('sales', 'created_at', startTimestamp, end.getTime(),
          () => db.sales.where('created_at').between(startTimestamp, end.getTime()).toArray()),
        fetchFiltered('cash_transactions', 'created_at', startTimestamp, end.getTime(),
          () => db.cash_transactions.where('created_at').between(startTimestamp, end.getTime()).toArray()),
        fetchAll('cash_registers', () => db.cash_registers.filter(r => r.is_active !== false).toArray())
      ]);

      const completed = allSalesToday.filter(s => s.status === 'completed');
      const todayRevenue = completed.reduce((acc, s) => acc + Number(s.total_amount), 0);

      const todayReturns = todayTxs.filter(t => t.transaction_type === 'return_out').reduce((acc, t) => acc + Number(t.amount), 0);
      const todayReturnCount = allSalesToday.filter(s => s.status === 'returned').length;

      const totalCash = registers.filter(r => r.is_active !== false).reduce((acc, r) => acc + Number(r.current_balance), 0);

      let criticalCount = 0;
      let totalReceivable = 0;

      if (isSupabase()) {
        // Only fetch what's needed for the dashboard (not all columns, not all products/customers)
        const [{ data: pData }, { data: cData }] = await Promise.all([
          supabase.from('products').select('min_stock_level, stock_quantity').eq('is_active', true).gt('min_stock_level', 0),
          supabase.from('customers').select('balance').eq('is_active', true).gt('balance', 0)
        ]);
        
        criticalCount = (pData || []).filter(p => Number(p.stock_quantity) <= Number(p.min_stock_level)).length;
        totalReceivable = (cData || []).reduce((acc, c) => acc + Number(c.balance), 0);
      } else {
        const products = await db.products.filter(p => p.is_active !== false).toArray();
        criticalCount = products.filter(p => Number(p.min_stock_level) > 0 && Number(p.stock_quantity) <= Number(p.min_stock_level)).length;

        const customers = await db.customers.filter(c => c.is_active !== false).toArray();
        totalReceivable = customers.reduce((acc, c) => acc + (Number(c.balance) > 0 ? Number(c.balance) : 0), 0);
      }
      
      return {
         todayRevenue,           // Brüt satış
         todayReturns,           // İade toplamı (kasa çıkışı)
         netRevenue: todayRevenue, // Net satış (İadeler hariç tutulduğu için brüt ile aynı)
         todayCount: completed.length,
         todayReturnCount,
         totalCash,
         criticalCount,
         totalReceivable
      };
    } catch(e) {
      return {
         todayRevenue: 0, todayReturns: 0, netRevenue: 0,
         todayCount: 0, todayReturnCount: 0,
         totalCash: 0, criticalCount: 0, totalReceivable: 0
      }
    }
  },

  async getCashReport(startDate, endDate) {
    try {
      const txs = await fetchFiltered('cash_transactions', 'created_at', startDate.getTime(), endDate.getTime(),
        () => db.cash_transactions.where('created_at').between(startDate.getTime(), endDate.getTime()).toArray());
      const ins = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in'];
      // ℹ️ return_out ayrı kategori — gerçek giderlerle (alış, kira vs.) karıştırılmaz
      const outs = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out'];

      const summary = {
         totalIncome: 0,
         totalExpense: 0,
         totalReturns: 0,   // Kasadan çıkan iade ödemeleri (ayrı kalem)
         netFlow: 0,
         expenseBreakdown: [],
         dailySeries: []
      };

       const dailyMap = new Map();
       let pieGider = 0;
       let pieTedarikci = 0;

       // Tüm aralığı (boş günler dahil) sıfır değerlerle dolduralım
       const daysCount = differenceInDays(endOfDay(endDate), startOfDay(startDate));
       for (let i = 0; i <= daysCount; i++) {
         const d = new Date(startDate);
         d.setDate(d.getDate() + i);
         const dKey = format(d, 'dd MMMM', { locale: tr });
         dailyMap.set(dKey, { date: dKey, income: 0, expense: 0, returns: 0 });
       }

       txs.forEach(t => {
         if (t.transaction_type === 'opening' || t.transaction_type === 'closing' || t.transaction_type === 'day_close') return;

         if (ins.includes(t.transaction_type) || t.transaction_type === 'in') {
            summary.totalIncome += t.amount;
         } else if (t.transaction_type === 'return_out') {
            // İade ödemeleri: gerçek gider değil, ayrı kalem
            summary.totalReturns += t.amount;
          } else if (outs.includes(t.transaction_type) || t.transaction_type === 'out') {
             summary.totalExpense += t.amount;

             // Sadece Gider ve Tedarikçiye Ödemeler pie için sayılır
             if (t.transaction_type === 'expense_out') pieGider += t.amount;
             if (t.transaction_type === 'supplier_payment_out') pieTedarikci += t.amount;
          }

         const dKey = format(new Date(Number(t.created_at)), 'dd MMMM', { locale: tr });
         if (!dailyMap.has(dKey)) dailyMap.set(dKey, { date: dKey, income: 0, expense: 0, returns: 0 });
         const dStat = dailyMap.get(dKey);

         if (ins.includes(t.transaction_type) || t.transaction_type === 'in') {
           dStat.income += t.amount;
         } else if (t.transaction_type === 'return_out') {
           dStat.returns += t.amount;  // Grafik'te ayrı bar olarak gösterilecek
         } else if (outs.includes(t.transaction_type) || t.transaction_type === 'out') {
           dStat.expense += t.amount;
         }
      });

      let rollingBalance = 0;
      summary.dailySeries = Array.from(dailyMap.values()).map(d => {
         // Net akış = gelir - gider - iade (hepsi kasaya etkiyor)
         rollingBalance += (d.income - d.expense - d.returns);
         return { ...d, balance: rollingBalance };
      });

      // expenseBreakdown: sadece Gider, Alış ve İade Ödemeleri (type bazlı kesin)
      summary.expenseBreakdown = [
        ...(pieTedarikci > 0 ? [{ name: 'Tedarikçiye Ödemeler', value: pieTedarikci }] : []),
        ...(pieGider      > 0 ? [{ name: 'Gider',                value: pieGider }]      : []),
        ...(summary.totalReturns > 0 ? [{ name: 'İade Ödemeleri', value: summary.totalReturns }] : []),
      ];
      // netFlow: gelir - gerçek gider - iade ödemeleri
      summary.netFlow = summary.totalIncome - summary.totalExpense - summary.totalReturns;

      return summary;
    } catch(e) {
      throw new Error('Kasa raporu alınamadı');
    }
  }

};
