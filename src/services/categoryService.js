import { db } from '../db';

export const categoryService = {
  async getAll() {
    try {
      return await db.categories.toArray();
    } catch (error) {
      throw new Error('Kategoriler getirilirken hata oluştu.');
    }
  },

  async getById(id) {
    try {
      return await db.categories.get(id);
    } catch (error) {
      throw new Error('Kategori getirilirken hata oluştu.');
    }
  },

  async create(data) {
    try {
      const id = await db.categories.add(data);
      return { id, ...data };
    } catch (error) {
      throw new Error('Kategori eklenirken hata oluştu.');
    }
  },

  async update(id, data) {
    try {
      await db.categories.update(id, data);
      return await this.getById(id);
    } catch (error) {
      throw new Error('Kategori güncellenirken hata oluştu.');
    }
  },

  async delete(id) {
    try {
      const products = await db.products.where('category_id').equals(id).toArray();
      const activeProducts = products.filter(p => p.is_active !== false);
      if (activeProducts.length > 0) {
        throw new Error(`Bu kategoriye ait ${activeProducts.length} adet aktif ürün bulunmaktadır. Önce ürünleri başka kategoriye taşıyın.`);
      }
      await db.categories.delete(id);
      return true;
    } catch (error) {
      throw error;
    }
  }
};
