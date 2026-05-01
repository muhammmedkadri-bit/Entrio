import { db } from '../db';
import { format } from 'date-fns';

export const productService = {
  async getAll(filters = {}) {
    try {
      let products = await db.products.toArray();
      
      // Filter active (soft delete)
      products = products.filter(p => p.is_active !== false);

      if (filters.category_id) {
        products = products.filter(p => p.category_id === filters.category_id);
      }
      
      if (filters.search) {
        const query = filters.search.toLowerCase();
        products = products.filter(p => 
          (p.name && p.name.toLowerCase().includes(query)) || 
          (p.barcode && p.barcode.includes(query))
        );
      }

      if (filters.stockStatus) {
        if (filters.stockStatus === 'critical') {
          products = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level);
        } else if (filters.stockStatus === 'out') {
          products = products.filter(p => p.stock_quantity <= 0);
        } else if (filters.stockStatus === 'normal') {
          products = products.filter(p => p.stock_quantity > p.min_stock_level);
        }
      }

      return products;
    } catch (error) {
      throw new Error('Ürünler getirilirken bir hata oluştu.');
    }
  },

  async getById(id) {
    try {
      const product = await db.products.get(id);
      if (!product) throw new Error('Ürün bulunamadı.');
      return product;
    } catch (error) {
      throw error.message === 'Ürün bulunamadı.' ? error : new Error('Ürün detayı getirilirken hata oluştu.');
    }
  },

  async getByBarcode(barcode) {
    try {
      return await db.products.where('barcode').equals(barcode).filter(p => p.is_active !== false).first();
    } catch (error) {
      throw new Error('Barkod ile arama yapılırken hata oluştu.');
    }
  },

  async create(data) {
    try {
      // Check unique barcode
      const existing = await db.products.where('barcode').equals(data.barcode).first();
      if (existing && existing.is_active !== false) {
        throw new Error('Bu barkoda sahip aktif bir ürün zaten var.');
      }
      
      const dataToSave = { ...data, is_active: true };
      const id = await db.products.add(dataToSave);
      return { id, ...dataToSave };
    } catch (error) {
      throw error;
    }
  },

  async update(id, data) {
    try {
      if (data.barcode) {
        const existing = await db.products.where('barcode').equals(data.barcode).first();
        if (existing && existing.id !== id && existing.is_active !== false) {
          throw new Error('Bu barkod başka bir ürün tarafından kullanılıyor.');
        }
      }
      await db.products.update(id, data);
      return await this.getById(id);
    } catch (error) {
      throw error;
    }
  },

  async delete(id) {
    try {
      // Check if product was sold
      const salesCount = await db.sale_items.where('product_id').equals(id).count();
      if (salesCount > 0) {
        // Soft delete
        await db.products.update(id, { is_active: false });
        return { type: 'soft', message: 'Ürün satış geçmişi olduğu için pasife alındı.' };
      } else {
        // Hard delete
        await db.products.delete(id);
        return { type: 'hard', message: 'Ürün tamamen silindi.' };
      }
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
      const categories = await db.categories.toArray();
      const suppliers = await db.suppliers.toArray();

      const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
      const supMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

      const headers = ["Barkod", "Ürün Adı", "Kategori", "Birim", "Alış Fiyatı", "Satış Fiyatı", "KDV", "Stok Miktarı", "Min Stok", "Tedarikçi"];
      
      const rows = products.map(p => [
        `"${p.barcode}"`, // Quote to prevent excel scientific notation
        `"${p.name.replace(/"/g, '""')}"`,
        `"${catMap[p.category_id] || ''}"`,
        `"${p.unit || ''}"`,
        p.purchase_price,
        p.sale_price,
        p.tax_rate,
        p.stock_quantity,
        p.min_stock_level,
        `"${supMap[p.supplier_id] || ''}"`
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      // Add BOM for Turkish utf-8 excel support
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `stok-listesi-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`);
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
