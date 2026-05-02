import { db } from './src/db/index.js';
import { cashService } from './src/services/cashService.js';
import { dayCloseService } from './src/services/dayCloseService.js';

async function main() {
  const registers = await db.cash_registers.toArray();
  for (const reg of registers) {
    const sum = await cashService.getDailySummary(reg.id, new Date());
    console.log(reg.name, '->', sum.totals);
  }
}
main().then(()=>process.exit(0)).catch(e => { console.error(e); process.exit(1); });
