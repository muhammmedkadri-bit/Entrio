import Dexie from 'dexie';

export const db = new Dexie('RetailPOSDB');

// --- ŞİFRELEME (HASHING) YARDIMCI FONKSİYONU ---
export async function hashPassword(password) {
  // Şifreyi UTF-8 formatında byte dizisine çeviriyoruz
  const msgBuffer = new TextEncoder().encode(password);
  // Tarayıcının yerleşik crypto API'si ile SHA-256 algoritmasını kullanarak özetliyoruz (hashliyoruz)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  // Çıkan sonucu hexadecimal (onaltılık) bir metne çeviriyoruz
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- VERSION 1 ---
db.version(1).stores({
  branches: '++id, name, is_active',
  profiles: '++id, full_name, role, branch_id, is_active',
  categories: '++id, name, parent_id',
  suppliers: '++id, name, phone, email, balance, is_active',
  customers: '++id, name, phone, email, balance, customer_type, is_active',
  products: '++id, barcode, name, category_id, supplier_id, sale_price, purchase_price, stock_quantity, min_stock_level, tax_rate, unit, is_active',
  stock_movements: '++id, product_id, movement_type, quantity, created_at',
  sales: '++id, sale_number, customer_id, total_amount, payment_method, status, created_at',
  sale_items: '++id, sale_id, product_id, quantity, unit_price, line_total',
  purchases: '++id, purchase_number, supplier_id, total_amount, status, created_at',
  purchase_items: '++id, purchase_id, product_id, quantity, unit_price',
  cash_registers: '++id, name, current_balance, is_active',
  cash_transactions: '++id, register_id, transaction_type, amount, created_at',
  customer_transactions: '++id, customer_id, transaction_type, amount, balance_after, created_at',
  supplier_transactions: '++id, supplier_id, transaction_type, amount, balance_after, created_at'
});

// --- VERSION 2 ---
// Added extended schemas for cash_registers and supplier_transactions
db.version(2).stores({
  cash_registers: '++id, name, type, is_default_for, is_active',
  supplier_transactions: '++id, supplier_id, transaction_type, amount, payment_method, transaction_date, created_at'
}).upgrade(async tx => {
  // Update existing supplier transactions with default values
  await tx.table('supplier_transactions').toCollection().modify(st => {
    if (!st.payment_method) st.payment_method = 'bank_transfer';
    if (!st.transaction_date) st.transaction_date = new Date().toISOString().split('T')[0];
  });

  // Seed new cash registers for existing databases during upgrade
  const registersCount = await tx.table('cash_registers').count();
  if (registersCount > 0) {
    const existingNakit = await tx.table('cash_registers').where('name').equals('Nakit Kasa').first();
    if (!existingNakit) {
      await tx.table('cash_registers').bulkAdd([
        { name: 'Nakit Kasa', type: 'cash', is_default_for: 'cash', current_balance: 0, is_active: true },
        { name: 'POS Hesabı 1', type: 'pos', is_default_for: 'card', current_balance: 0, is_active: true },
        { name: 'Banka Hesabı 1', type: 'bank', is_default_for: 'transfer', current_balance: 0, is_active: true }
      ]);
    }
  }
});

// --- VERSION 3 ---
// Adds invoice_number field index to purchases; nullifies old auto-generated ALI-XXXX numbers
db.version(3).stores({
  purchases: '++id, purchase_number, invoice_number, supplier_id, total_amount, status, created_at'
}).upgrade(async tx => {
  await tx.table('purchases').toCollection().modify(p => {
    if (p.purchase_number && p.purchase_number.startsWith('ALI-')) {
      p.purchase_number = null;
    }
  });
});

// --- VERSION 4 ---
// Adds invoice_date, due_date, tax breakdowns, waybill info fields
db.version(4).stores({
  purchases: '++id, purchase_number, invoice_number, invoice_date, due_date, supplier_id, total_amount, paid_amount, status, created_at',
  purchase_items: '++id, purchase_id, product_id, quantity, unit_price, unit, kdv_rate, otv_rate'
}).upgrade(async tx => {
  const today = new Date().toISOString().split('T')[0];
  await tx.table('purchases').toCollection().modify(p => {
    if (!p.invoice_date) p.invoice_date = today;
    if (!p.due_date) p.due_date = today;
    if (p.discount_amount === undefined) p.discount_amount = 0;
    if (p.kdv_amount === undefined) p.kdv_amount = 0;
    if (p.otv_amount === undefined) p.otv_amount = 0;
    if (!p.waybill_number) p.waybill_number = null;
    if (!p.waybill_date) p.waybill_date = null;
    if (!p.notes) p.notes = null;
  });
  await tx.table('purchase_items').toCollection().modify(item => {
    if (!item.unit) item.unit = 'adet';
    if (item.discount_percent === undefined) item.discount_percent = 0;
    if (item.discount_amount === undefined) item.discount_amount = 0;
    if (item.kdv_rate === undefined) item.kdv_rate = 0;
    if (item.otv_rate === undefined) item.otv_rate = 0;
    if (item.kdv_amount === undefined) item.kdv_amount = 0;
    if (item.otv_amount === undefined) item.otv_amount = 0;
  });
});

// --- VERSION 5 ---
// Günlük bakiye / genel bakiye ayrımı
db.version(5).stores({
  cash_registers: '++id, name, type, is_default_for, is_active, general_balance, last_day_close_date'
}).upgrade(async tx => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await tx.table('cash_registers').toCollection().modify(reg => {
    if (reg.general_balance === undefined) reg.general_balance = reg.current_balance || 0;
    if (!reg.last_day_close_date) reg.last_day_close_date = today;
  });
});

// --- VERSION 6 ---
// Users and Settings tables for Settings Page refactor
db.version(6).stores({
  users: '++id, email, role, branch_id, is_active',
  settings: 'key' // key is the primary key
}).upgrade(async tx => {
  // Seed initial users - ŞİFRELEME EKLENDİ
  const usersCount = await tx.table('users').count();
  if (usersCount === 0) {
    const adminHash = await hashPassword('admin123');
    const cashierHash = await hashPassword('kasiyer123');
    await tx.table('users').bulkAdd([
      { email: 'admin@pos.com', password: adminHash, full_name: 'Hesap Yöneticisi', role: 'admin', branch_id: 1, is_active: true },
      { email: 'kasiyer@pos.com', password: cashierHash, full_name: 'Kasiyer', role: 'cashier', branch_id: 1, is_active: true }
    ]);
  }

  // Seed initial settings
  const settingsCount = await tx.table('settings').count();
  if (settingsCount === 0) {
    await tx.table('settings').bulkAdd([
      { key: 'company_info', value: { name: 'Entrio Perakende', address: 'Merkez Mah. Atatürk Cad. No:1', phone: '0850 123 45 67', logo: null } },
      { key: 'receipt_template', value: 'template_1' }
    ]);
  }
});

// --- VERSION 7 ---
// Gün sonu sistemi v2 (konsolide, saat bazlı cutoff, JSON data)
db.version(7).stores({
  cash_registers: '++id, name, type, is_default_for, is_active, general_balance, last_day_close_date, last_day_close_at',
  cash_transactions: '++id, register_id, transaction_type, amount, balance_after, created_at, is_day_close, is_consolidated'
}).upgrade(async tx => {
  await tx.table('cash_registers').toCollection().modify(reg => {
    if (reg.general_balance === undefined) reg.general_balance = reg.current_balance || 0;
    if (reg.last_day_close_at === undefined) reg.last_day_close_at = null;
  });

  await tx.table('cash_transactions').toCollection().modify(t => {
    if (t.is_day_close === undefined) t.is_day_close = (t.transaction_type === 'day_close');
    if (t.is_consolidated === undefined) t.is_consolidated = !!t.is_consolidated;
    if (t.day_close_data === undefined) t.day_close_data = null;
  });
});

// --- VERSION 8 ---
// Şifre düzeltme migrasyonu
// db.on('ready') yerine upgrade mantığı ile (Deadlock engellemek için)
db.version(8).stores({}).upgrade(async tx => {
  const users = await tx.table('users').toArray();
  for (const user of users) {
    // Şifre 64 karakter (SHA-256 uzunluğu) değilse düz metin kabul et ve şifrele
    if (user.password && user.password.length !== 64) {
      const hashed = await hashPassword(user.password);
      await tx.table('users').update(user.id, { password: hashed });
    }
  }
});

db.on('populate', async () => {
  await db.branches.bulkAdd([
    { name: 'Merkez Şube', is_active: true }
  ]);

  await db.customers.bulkAdd([
    { name: 'Perakende Müşteri', customer_type: 'retail', balance: 0, is_active: true }
  ]);

  // Seed both old default and new specialized registers
  const today = new Date().toISOString().split('T')[0];
  await db.cash_registers.bulkAdd([
    { name: 'Nakit Kasa', type: 'cash', is_default_for: 'cash', current_balance: 0, general_balance: 0, last_day_close_date: today, last_day_close_at: null, is_active: true },
    { name: 'POS Hesabı 1', type: 'pos', is_default_for: 'card', current_balance: 0, general_balance: 0, last_day_close_date: today, last_day_close_at: null, is_active: true },
    { name: 'Banka Hesabı 1', type: 'bank', is_default_for: 'transfer', current_balance: 0, general_balance: 0, last_day_close_date: today, last_day_close_at: null, is_active: true }
  ]);

  await db.categories.bulkAdd([
    { name: 'Genel', color: '#65c43d', icon: 'tag' },
    { name: 'Gıda', color: '#22c55e', icon: 'shopping-bag' },
    { name: 'Elektronik', color: '#3b82f6', icon: 'cpu' },
    { name: 'Giyim', color: '#f59e0b', icon: 'shirt' }
  ]);

  // ŞİFRELEME EKLENDİ
  const adminHash = await hashPassword('Entrio2026!');
  const cashierHash = await hashPassword('kasiyer123');
  await db.users.bulkAdd([
    { email: 'admin@pos.com', password: adminHash, full_name: 'Hesap Yöneticisi', role: 'admin', branch_id: 1, is_active: true },
    { email: 'kasiyer@pos.com', password: cashierHash, full_name: 'Kasiyer', role: 'cashier', branch_id: 1, is_active: true }
  ]);

  await db.settings.bulkAdd([
    { key: 'company_info', value: { name: 'Entrio Perakende', address: 'Merkez Mah. Atatürk Cad. No:1', phone: '0850 123 45 67', logo: null } },
    { key: 'receipt_template', value: 'template_1' }
  ]);
});