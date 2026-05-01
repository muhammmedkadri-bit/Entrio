import { db } from '../db';
import { startOfDay, endOfDay, format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export const reportService = {
  
  // 1. SALES REPORT
  async getSalesSummary(startDate, endDate) {
    // Sadece 'completed' satışlar
    const sales = await db.sales
        .where('created_at').between(startDate.getTime(), endDate.getTime())
        .toArray();
      
      const completedSales = sales.filter(s => s.status === 'completed');

      const summary = {
        totalRevenue: 0,
        totalCount: completedSales.length,
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
        rawSales: completedSales
      };

      const dailyMap = new Map();

      for (const sale of completedSales) {
        summary.totalRevenue += (sale.total_amount || 0);
        summary.totalDiscount += (sale.discount_amount || 0);
        summary.totalTax += (sale.tax_amount || 0);

        if (!summary.byPaymentMethod[sale.payment_method]) {
          summary.byPaymentMethod[sale.payment_method] = { count: 0, amount: 0 };
        }
        summary.byPaymentMethod[sale.payment_method].count += 1;
        summary.byPaymentMethod[sale.payment_method].amount += sale.total_amount;

        const dayKey = format(sale.created_at, 'dd MMMM', { locale: tr });
        if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, { date: dayKey, total: 0, count: 0 });
        
        const dayStat = dailyMap.get(dayKey);
        dayStat.total += sale.total_amount;
        dayStat.count += 1;
      }

      summary.netRevenue = summary.totalRevenue - summary.totalDiscount;
      summary.avgBasket = summary.totalCount > 0 ? summary.totalRevenue / summary.totalCount : 0;
      summary.dailySeries = Array.from(dailyMap.values());

      // Sale Items for Top Products
      const saleIds = completedSales.map(s => s.id);
      if (saleIds.length > 0) {
        const items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray();
        const productMap = new Map();
        const salesMap = new Map(completedSales.map(s => [s.id, s]));

        for (const item of items) {
          const sale = salesMap.get(item.sale_id);
          if (!sale) continue;

          if (!productMap.has(item.product_id)) {
            const productInfo = await db.products.get(item.product_id);
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
          const productInfo = await db.products.get(item.product_id);
          pStat.cost += (productInfo?.purchase_price || 0) * (item.quantity || 0);
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

        // Top 10 by quantity
        summary.topProducts = topP.sort((a, b) => b.quantity - a.quantity).slice(0, 10);
      }

    return summary;
  },

  // 2. STOCK REPORT
  async getStockReport() {
    const products = await db.products.filter(p => p.is_active !== false).toArray();
      const categories = await db.categories.toArray();

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

      for (const p of products) {
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
  },

  // 3. CARI REPORT
  async getCariReport(type = 'customer') {
    const table = type === 'customer' ? db.customers : db.suppliers;
      const txTable = type === 'customer' ? db.customer_transactions : db.supplier_transactions;
      
      const entities = await table.filter(e => e.is_active !== false).toArray();

      const summary = {
        totalReceivable: 0,
        totalPayable: 0,
        debtorCount: 0,         // Borcu olan müşteri sayısı
        highestDebtor: null,    // En yüksek borçlu müşteri {name, balance}
        avgDebt: 0,             // Ortalama veresiye borcu (borçlu başına)
        activeCount: 0,         // Hiç işlem yapmış aktif müşteri/tedarikçi sayısı
        cleanCount: 0,          // Borcu olmayan (temiz hesap) sayısı
        top5Debtors: [],        // En yüksek 5 borçlu
        balanceTable: []
      };

      let debtors = [];

      for (const e of entities) {
        const bal = e.balance || 0;

        // Check if entity has any transactions to count as 'active'
        const txCount = await txTable
          .where(type === 'customer' ? 'customer_id' : 'supplier_id')
          .equals(e.id)
          .count();
        if (txCount > 0) summary.activeCount++;

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
  },

  // 4. CASH REPORT & PROFIT LOSS (Ayrı ama birleşik yapılabilir)
  async getProfitLoss(startDate, endDate) {
    const sales = await db.sales.where('created_at').between(startDate.getTime(), endDate.getTime()).toArray();
      const completedSales = sales.filter(s => s.status === 'completed');

      const cashTxs = await db.cash_transactions.where('created_at').between(startDate.getTime(), endDate.getTime()).toArray();
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
          const productInfo = await db.products.get(item.product_id);
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
  },

  async getDashboardStats() {
    const todayStart = startOfDay(new Date());
      const end = endOfDay(new Date());

      // Global Day Close cutoff: Find the latest day_close transaction for today
      const todayDayCloseTxs = await db.cash_transactions
        .where('created_at').between(todayStart.getTime(), end.getTime())
        .filter(t => t.is_day_close || t.transaction_type === 'day_close')
        .toArray();
      
      const latestDayClose = todayDayCloseTxs.sort((a, b) => b.created_at - a.created_at)[0];
      const startTimestamp = latestDayClose ? latestDayClose.created_at : todayStart.getTime();

      // 1. Sales today (cutoff sonrası)
      const todaySales = await db.sales.where('created_at').between(startTimestamp, end.getTime()).toArray();
      const completed = todaySales.filter(s => s.status === 'completed');
      const todayRevenue = completed.reduce((acc, s) => acc + s.total_amount, 0);

      // 1b. Returns today — kasadan çıkan iade ödemeleri (cutoff sonrası)
      const todayTxs = await db.cash_transactions.where('created_at').between(startTimestamp, end.getTime()).toArray();
      const todayReturns = todayTxs
        .filter(t => t.transaction_type === 'return_out')
        .reduce((acc, t) => acc + t.amount, 0);
      const todayReturnCount = todaySales.filter(s => s.status === 'returned').length;

      // 2. Cash balance
      const registers = await db.cash_registers.filter(r => r.is_active !== false).toArray();
      const totalCash = registers.reduce((acc, r) => acc + r.current_balance, 0);

      // 3. Critical stock
      const products = await db.products.filter(p => p.is_active !== false).toArray();
      const criticalCount = products.filter(p => p.min_stock_level > 0 && p.stock_quantity <= p.min_stock_level).length;

      // 4. Receivables
      const customers = await db.customers.filter(c => c.is_active !== false).toArray();
      const totalReceivable = customers.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
      
    return {
        todayRevenue,           // Brüt satış
        todayReturns,           // İade toplamı (kasa çıkışı)
        netRevenue: Math.max(0, todayRevenue - todayReturns), // Net satış
        todayCount: completed.length,
        todayReturnCount,
        totalCash,
        criticalCount,
        totalReceivable
    };
  },

  async getCashReport(startDate, endDate) {
    const txs = await db.cash_transactions.where('created_at').between(startDate.getTime(), endDate.getTime()).toArray();
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
         // Yalnızca açılış/kapanış ve günsonu hariç gerçek paralar
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

         const dKey = format(t.created_at, 'dd MMMM', { locale: tr });
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
  }

};
