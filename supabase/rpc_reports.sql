-- ─── RAPORLAR İÇİN OPTİMİZASYON RPC FONKSİYONLARI ──────────────────────────

-- 1. Satış Raporu İçin: Fatura Kalemlerini ve Ürün Maliyetlerini Tek Seferde Getirir
-- (Büyük tarih aralıklarında Supabase URL sınırına takılmamak için)
CREATE OR REPLACE FUNCTION public.get_sales_report_items(start_ms BIGINT, end_ms BIGINT)
RETURNS TABLE (
  sale_id BIGINT,
  product_id BIGINT,
  name TEXT,
  quantity DECIMAL,
  unit_price DECIMAL,
  line_total DECIMAL,
  purchase_price DECIMAL
)
LANGUAGE sql
AS $$
  SELECT 
    si.sale_id,
    si.product_id,
    si.name,
    si.quantity,
    si.unit_price,
    si.line_total,
    p.purchase_price
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE s.created_at >= start_ms 
    AND s.created_at <= end_ms 
    AND s.status = 'completed';
$$;

-- 2. Cari Raporu İçin: Hangi carilerin işlem gördüğünü (activeCount) bulmak için
-- Sadece işlem görmüş unique cari ID'lerini döndürür. Böylece 100 bin satır tx çekilmez.
CREATE OR REPLACE FUNCTION public.get_active_cari_ids(tx_table TEXT)
RETURNS TABLE (cari_id BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  IF tx_table = 'customer_transactions' THEN
    RETURN QUERY SELECT DISTINCT customer_id FROM public.customer_transactions;
  ELSIF tx_table = 'supplier_transactions' THEN
    RETURN QUERY SELECT DISTINCT supplier_id FROM public.supplier_transactions;
  END IF;
END;
$$;

-- 3. Kasa Raporu Kâr/Zarar İçin: Satışların maliyetlerini (COGS) gün bazında gruplayarak verir
CREATE OR REPLACE FUNCTION public.get_cogs_by_sale(start_ms BIGINT, end_ms BIGINT)
RETURNS TABLE (
  sale_id BIGINT,
  total_cogs DECIMAL
)
LANGUAGE sql
AS $$
  SELECT 
    si.sale_id,
    SUM(si.quantity * COALESCE(p.purchase_price, 0)) AS total_cogs
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE s.created_at >= start_ms 
    AND s.created_at <= end_ms 
    AND s.status = 'completed'
  GROUP BY si.sale_id;
$$;
