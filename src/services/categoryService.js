import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';

export const categoryService = {
  async getAll() {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        return data;
      }
      return await db.categories.toArray();
    } catch (error) {
      throw new Error('Kategoriler getirilirken hata oluştu.');
    }
  },

  async getById(id) {
    try {
      if (isSupabase()) {
        const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      }
      return await db.categories.get(Number(id));
    } catch (error) {
      throw new Error('Kategori getirilirken hata oluştu.');
    }
  },

  async create(data) {
    try {
      if (isSupabase()) {
        const { data: created, error } = await supabase.from('categories').insert([data]).select().single();
        if (error) throw error;
        return created;
      }
      const id = await db.categories.add(data);
      return { id, ...data };
    } catch (error) {
      throw new Error('Kategori eklenirken hata oluştu.');
    }
  },

  async update(id, data) {
    try {
      if (isSupabase()) {
        const { data: updated, error } = await supabase.from('categories').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated;
      }
      await db.categories.update(Number(id), data);
      return await this.getById(id);
    } catch (error) {
      throw new Error('Kategori güncellenirken hata oluştu.');
    }
  },

  async delete(id) {
    try {
      if (isSupabase()) {
        const { data: products, error: pErr } = await supabase.from('products').select('id').eq('category_id', id).eq('is_active', true);
        if (pErr) throw pErr;
        if (products && products.length > 0) {
          throw new Error(`Bu kategoriye ait ${products.length} adet aktif ürün bulunmaktadır. Önce ürünleri başka kategoriye taşıyın.`);
        }
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        return true;
      }

      const products = await db.products.where('category_id').equals(Number(id)).toArray();
      const activeProducts = products.filter(p => p.is_active !== false);
      if (activeProducts.length > 0) {
        throw new Error(`Bu kategoriye ait ${activeProducts.length} adet aktif ürün bulunmaktadır. Önce ürünleri başka kategoriye taşıyın.`);
      }
      await db.categories.delete(Number(id));
      return true;
    } catch (error) {
      throw error;
    }
  }
};
