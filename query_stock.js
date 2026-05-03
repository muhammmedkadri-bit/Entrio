import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('stock_movements').select('*');
  console.log('Stock movements:', data?.length);
  if(data?.length > 0) console.log(data[0]);
  
  const { data: sales } = await supabase.from('sale_items').select('*');
  console.log('Sale items:', sales?.length);
}
check();
