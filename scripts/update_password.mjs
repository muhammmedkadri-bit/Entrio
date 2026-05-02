// Geçici script: admin şifresini admin123 olarak günceller
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env dosyasından değerleri al
const envFile = readFileSync('.env', 'utf-8');
const url  = envFile.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key  = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

const supabase = createClient(url, key);

// SHA-256 of "admin123"
const ADMIN123_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

const { data, error } = await supabase
  .from('users')
  .update({ password: ADMIN123_HASH })
  .eq('email', 'admin@pos.com')
  .select();

if (error) {
  console.error('❌ Hata:', error.message);
  process.exit(1);
}

console.log('✅ Şifre güncellendi:', data);
process.exit(0);
