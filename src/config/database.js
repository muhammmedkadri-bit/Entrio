export const DATABASE_MODE = 'supabase'; // 'dexie' or 'supabase'

export const isSupabase = () => DATABASE_MODE === 'supabase';
export const isDexie = () => DATABASE_MODE === 'dexie';
