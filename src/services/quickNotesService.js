import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';

const LOCAL_KEY = 'entrio_quick_notes';

export const quickNotesService = {
  async getAll() {
    if (isSupabase()) {
      try {
        const { data, error } = await supabase
          .from('quick_notes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        if (error) throw error;
        // Map to {id, text} to match existing frontend structure
        return data.map(note => ({ id: note.id, text: note.content }));
      } catch (e) {
        console.error('Hızlı notlar getirilemedi:', e);
        return [];
      }
    } else {
      try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
    }
  },

  async add(text) {
    if (isSupabase()) {
      const { data, error } = await supabase
        .from('quick_notes')
        .insert([{ content: text }])
        .select()
        .single();
      if (error) throw error;
      return { id: data.id, text: data.content };
    } else {
      return { id: Date.now(), text };
    }
  },

  async update(id, text) {
    if (isSupabase()) {
      const { error } = await supabase
        .from('quick_notes')
        .update({ content: text, updated_at: Date.now() })
        .eq('id', id);
      if (error) throw error;
    }
  },

  async delete(id) {
    if (isSupabase()) {
      const { error } = await supabase
        .from('quick_notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  saveLocal(notes) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  }
};
