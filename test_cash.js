import { db } from './src/db/index.js';
import { cashService } from './src/services/cashService.js';
import { dayCloseService } from './src/services/dayCloseService.js';

async function run() {
  const regs = await db.cash_registers.toArray();
  for (const reg of regs) {
    const sum = await cashService.getDailySummary(reg.id, new Date());
    console.log(reg.name, 'Summary:', JSON.stringify(sum.totals));
  }
}
run().catch(console.error).then(() => process.exit(0));
