-- ═══════════════════════════════════════════════════════════════════════════
-- Entrio POS - SQL RPC Fonksiyonları (Bölüm 3: Veri Yönetimi ve Güvenlik)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. KULLANICI ŞİFRE DOĞRULAMA ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_user_password(
  p_email TEXT,
  p_password TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_password TEXT;
BEGIN
  -- Güvenlik için e-postayı küçük harfe çevir
  SELECT password INTO v_user_password
  FROM public.users
  WHERE email = LOWER(p_email) AND is_active = true
  LIMIT 1;

  -- Eğer kullanıcı yoksa veya şifre eşleşmiyorsa
  IF v_user_password IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_user_password = p_password THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- ─── 2. TÜM VERİLERİ SIFIRLAMA (FABRİKA AYARLARI) ──────────────────────
CREATE OR REPLACE FUNCTION public.wipe_all_data()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- TRUNCATE CASCADE ile tüm ilişkili işlemsel ve tanım verilerini sıfırla.
  -- users, branches ve settings tabloları hariç.
  TRUNCATE TABLE 
    public.sale_items,
    public.sales,
    public.purchase_items,
    public.purchases,
    public.cash_transactions,
    public.cash_registers,
    public.customer_transactions,
    public.customers,
    public.supplier_transactions,
    public.suppliers,
    public.stock_movements,
    public.products,
    public.categories,
    public.quick_notes
  CASCADE;

  -- Varsayılan perakende müşterisini yeniden ekle (ID: 1 olacak şekilde)
  -- Truncate sonrası identity resetlendiği için ilk eklenen kayıt 1 olur
  ALTER SEQUENCE public.customers_id_seq RESTART WITH 1;
  INSERT INTO public.customers (name, customer_type, balance, is_active)
  VALUES ('Perakende Müşteri', 'retail', 0, true);

  -- Varsayılan kasaları yeniden oluştur
  ALTER SEQUENCE public.cash_registers_id_seq RESTART WITH 1;
  INSERT INTO public.cash_registers (name, type, is_default_for, current_balance, general_balance, last_day_close_date, is_active)
  VALUES
  ('Nakit Kasa', 'cash', 'cash', 0, 0, CURRENT_DATE, true),
  ('POS Hesabı 1', 'pos', 'card', 0, 0, CURRENT_DATE, true),
  ('Banka Hesabı 1', 'bank', 'transfer', 0, 0, CURRENT_DATE, true);

  -- Varsayılan kategorileri ekle
  ALTER SEQUENCE public.categories_id_seq RESTART WITH 1;
  INSERT INTO public.categories (name, color, icon)
  VALUES
  ('Genel', '#65c43d', 'tag'),
  ('Gıda', '#22c55e', 'shopping-bag'),
  ('Elektronik', '#3b82f6', 'cpu'),
  ('Giyim', '#f59e0b', 'shirt');

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Veri silme hatası: %', SQLERRM;
  RETURN FALSE;
END;
$$;
