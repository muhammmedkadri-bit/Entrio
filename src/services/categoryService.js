import { db } from '../db';

export const categoryService = {
  async getAll() {
    return await db.categories.toArray();
  },

  async getById(id) {
    return await db.categories.get(id);
  },

  async create(data) {
    const id = await db.categories.add(data);
    return { id, ...data };
  },

  async update(id, data) {
    await db.categories.update(id, data);
    return await this.getById(id);
  },

  async delete(id) {
    const products = await db.products.where('category_id').equals(id).toArray();
    const activeProducts = products.filter(p => p.is_active !== false);
    if (activeProducts.length > 0) {
      throw new Error(`Bu kategoriye ait ${activeProducts.length} adet aktif ürün bulunmaktadır. Önce ürünleri başka kategoriye taşıyın.`);
    }
    await db.categories.delete(id);
    return true;
  }
};
