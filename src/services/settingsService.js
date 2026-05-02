import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';

export const settingsService = {
  async get(key) {
    if (isSupabase()) {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw new Error('Ayar getirilirken hata: ' + error.message);
      }
      return data ? { key, value: data.value } : undefined;
    } else {
      return await db.settings.get(key);
    }
  },

  async put(key, value) {
    if (isSupabase()) {
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value });
      
      if (error) {
        throw new Error('Ayar kaydedilirken hata: ' + error.message);
      }
    } else {
      await db.settings.put({ key, value });
    }
  }
};
