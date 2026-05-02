import { db } from './src/db/index.js';

async function main() {
  const t = await db.cash_registers.where('is_active').equals(true).toArray();
  const f = await db.cash_registers.filter(r => r.is_active !== false).toArray();
  console.log('where(true):', t.length);
  console.log('filter(!=false):', f.length);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
