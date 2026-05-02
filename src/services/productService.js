import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { format } from 'date-fns';

export const productService = {
  async getAll(filters = {}) {
    try {
      if (isSupabase()) {
        let query = supabase.from('products').select('*').eq('is_active', true);
        if (filters.category_id) query = query.eq('category_id', filters.category_id);
        if (filters.search) {
          query = query.or(`name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%`);
        }
        if (filters.stockStatus === 'critical') {
          query = query.gt('stock_quantity', 0).filter('stock_quantity', 'lte', 'min_stock_level');
        } else if (filters.stockStatus === 'out') {
          query = query.lte('stock_quantity', 0);
        } else if (filters.stockStatus === 'normal') {
          query = query.filter('stock_quantity', 'gt', 'min_stock_level');
        }
        const { data, error } = await query.order('name');
        if (error) throw error;
        // Filtreler Supabase'de tam desteklenmiyorsa client-side da filtrele
        let products = data;
        if (filters.stockStatus === 'critical') {
          products = products.filter(p => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= Number(p.min_stock_level));
        } else if (filters.stockStatus === 'out') {
          products = products.filter(p => Number(p.stock_quantity) <= 0);
        } else if (filters.stockStatus === 'normal') {
          products = products.filter(p => Number(p.stock_quantity) > Number(p.min_stock_level));
        }
        return products;
      }
      
      // ── Dexie fallback ──────────────────────────────────────────────────────
      let products = await db.products.toArray();
      products = products.filter(p => p.is_active !== false);
      if (filters.category_id) products = products.filter(p => p.category_id === filters.category_id);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        products = products.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q)));
      }
      if (filters.stockStatus === 'critical') products = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level);
      else if (filters.stockStatus === 'out') products = products.filter(p => p.stock_quantity <= 0);
      else if (filters.stockStatus === 'normal') products = products.filter(p => p.stock_quantity > p.min_stock_level);
      return products;
    } catch (error) {
      throw new Error('Ürünler getirilirken bir hata oluştu.');
    }
  },

  async getById(id) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) throw new Error('Ürün bulunamadı.');
        return data;
      }
      const product = await db.products.get(Number(id));
      if (!product) throw new Error('Ürün bulunamadı.');
      return product;
    } catch (error) {
      throw error.message === 'Ürün bulunamadı.' ? error : new Error('Ürün detayı getirilirken hata oluştu.');
    }
  },

  async getByBarcode(barcode) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase
          .from('products').select('*').eq('barcode', barcode).eq('is_active', true).maybeSingle();
        if (error) throw error;
        return data;
      }
      return await db.products.where('barcode').equals(barcode).filter(p => p.is_active !== false).first();
    } catch (error) {
      throw new Error('Barkod ile arama yapılırken hata oluştu.');
    }
  },

  async create(data) {
    try {
      if (isSupabase()) {
        // Benzersiz barkod kontrolü
        if (data.barcode) {
          const { data: existing } = await supabase
            .from('products').select('id').eq('barcode', data.barcode).eq('is_active', true).maybeSingle();
          if (existing) throw new Error('Bu barkoda sahip aktif bir ürün zaten var.');
        }
        const dataToSave = { ...data, is_active: true };
        const { data: created, error } = await supabase.from('products').insert([dataToSave]).select().single();
        if (error) throw error;
        return created;
      }

      const existing = await db.products.where('barcode').equals(data.barcode).first();
      if (existing && existing.is_active !== false) throw new Error('Bu barkoda sahip aktif bir ürün zaten var.');
      const dataToSave = { ...data, is_active: true };
      const id = await db.products.add(dataToSave);
      return { id, ...dataToSave };
    } catch (error) {
      throw error;
    }
  },

  async update(id, data) {
    try {
      if (isSupabase()) {
        if (data.barcode) {
          const { data: existing } = await supabase
            .from('products').select('id').eq('barcode', data.barcode).neq('id', id).eq('is_active', true).maybeSingle();
          if (existing) throw new Error('Bu barkod başka bir ürün tarafından kullanılıyor.');
        }
        const { data: updated, error } = await supabase.from('products').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated;
      }

      if (data.barcode) {
        const existing = await db.products.where('barcode').equals(data.barcode).first();
        if (existing && existing.id !== Number(id) && existing.is_active !== false) {
          throw new Error('Bu barkod başka bir ürün tarafından kullanılıyor.');
        }
      }
      await db.products.update(Number(id), data);
      return await this.getById(id);
    } catch (error) {
      throw error;
    }
  },

  async delete(id) {
    try {
      if (isSupabase()) {
        const { count, error: countErr } = await supabase
          .from('sale_items').select('*', { count: 'exact', head: true }).eq('product_id', id);
        if (countErr) throw countErr;
        if (count > 0) {
          const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
          if (error) throw error;
          return { type: 'soft', message: 'Ürün satış geçmişi olduğu için pasife alındı.' };
        }
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        return { type: 'hard', message: 'Ürün tamamen silindi.' };
      }

      const salesCount = await db.sale_items.where('product_id').equals(Number(id)).count();
      if (salesCount > 0) {
        await db.products.update(Number(id), { is_active: false });
        return { type: 'soft', message: 'Ürün satış geçmişi olduğu için pasife alındı.' };
      }
      await db.products.delete(Number(id));
      return { type: 'hard', message: 'Ürün tamamen silindi.' };
    } catch (error) {
      throw new Error('Ürün silinirken bir hata oluştu.');
    }
  },

  async searchByNameOrBarcode(query) {
    return this.getAll({ search: query });
  },

  async exportToCSV(filters = {}) {
    try {
      const products = await this.getAll(filters);
      const categories = isSupabase()
        ? (await supabase.from('categories').select('*')).data || []
        : await db.categories.toArray();
      const suppliers = isSupabase()
        ? (await supabase.from('suppliers').select('*')).data || []
        : await db.suppliers.toArray();

      const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
      const supMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

      const headers = ["Barkod", "Ürün Adı", "Kategori", "Birim", "Alış Fiyatı", "Satış Fiyatı", "KDV", "Stok Miktarı", "Min Stok", "Tedarikçi"];
      const rows = products.map(p => [
        `"${p.barcode || ''}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${catMap[p.category_id] || ''}"`,
        `"${p.unit || ''}"`,
        p.purchase_price,
        p.sale_price,
        p.tax_rate,
        p.stock_quantity,
        p.min_stock_level,
        `"${supMap[p.supplier_id] || ''}"`
      ]);

      const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `stok-listesi-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (error) {
      throw new Error('CSV dışa aktarılırken hata oluştu.');
    }
  }
};
