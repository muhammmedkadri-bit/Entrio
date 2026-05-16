-- ═══════════════════════════════════════════════════════════════════════════
-- Entrio POS - SQL RPC Fonksiyonları (Bölüm 2: Alış + Kasa Ödeme + Gün Sonu)
-- Supabase SQL Editor'de rpc_functions_part1.sql'den SONRA çalıştırın.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 3. ALIŞ/FATURA OLUŞTURMA ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_purchase(
  p_purchase_data JSONB,
  p_items         JSONB,
  p_payment_data  JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id   BIGINT;
  v_now           BIGINT;
  v_item          JSONB;
  v_product       RECORD;
  v_supplier      RECORD;
  v_reg           RECORD;
  v_new_qty       DECIMAL(15,3);
  v_supplier_id   BIGINT;
  v_grand_total   DECIMAL(15,2);
  v_paid_now      DECIMAL(15,2);
  v_inv_number    TEXT;
  v_sup_balance   DECIMAL(15,2);
  v_method        TEXT;
  v_splits        JSONB;
  v_split_key     TEXT;
  v_split_amt     DECIMAL(15,2);
  v_split_def     TEXT;
  v_offset        INT;
BEGIN
  v_now         := FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000);
  v_supplier_id := NULLIF(p_purchase_data->>'supplier_id', '')::BIGINT;
  v_grand_total := COALESCE((p_purchase_data->>'total_amount')::DECIMAL, 0);
  v_paid_now    := COALESCE((p_payment_data->>'paidNow')::DECIMAL, 0);
  v_method      := p_payment_data->>'method';
  v_splits      := p_payment_data->'splits';
  v_inv_number  := p_purchase_data->>'invoice_number';

  -- Alış kaydı ekle
  INSERT INTO public.purchases (
    purchase_number, invoice_number, invoice_title, invoice_date, due_date,
    supplier_id, supplier_name, subtotal, total_amount, paid_amount,
    payment_method, discount_amount, kdv_amount, otv_amount,
    waybill_number, waybill_date, notes, siparis_no, siparis_date,
    status, created_at
  ) VALUES (
    v_inv_number,
    v_inv_number,
    p_purchase_data->>'invoice_title',
    NULLIF(p_purchase_data->>'invoice_date', '')::DATE,
    NULLIF(p_purchase_data->>'due_date', '')::DATE,
    v_supplier_id,
    p_purchase_data->>'supplier_name',
    COALESCE((p_purchase_data->>'subtotal')::DECIMAL, v_grand_total),
    v_grand_total, v_paid_now, v_method,
    COALESCE((p_purchase_data->>'discount_amount')::DECIMAL, 0),
    COALESCE((p_purchase_data->>'kdv_amount')::DECIMAL, 0),
    COALESCE((p_purchase_data->>'otv_amount')::DECIMAL, 0),
    p_purchase_data->>'waybill_number',
    NULLIF(p_purchase_data->>'waybill_date', '')::DATE,
    p_purchase_data->>'notes',
    p_purchase_data->>'siparis_no',
    NULLIF(p_purchase_data->>'siparis_date', '')::DATE,
    'received', v_now
  ) RETURNING id INTO v_purchase_id;

  -- Kalemler + stok güncelleme
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.purchase_items (
      purchase_id, product_id, name, quantity, unit_price, unit, line_total,
      kdv_rate, otv_rate, discount_percent, discount_amount, kdv_amount, otv_amount
    ) VALUES (
      v_purchase_id, (v_item->>'product_id')::BIGINT, v_item->>'name',
      (v_item->>'quantity')::DECIMAL, (v_item->>'unit_price')::DECIMAL,
      COALESCE(v_item->>'unit', 'adet'),
      COALESCE((v_item->>'line_total')::DECIMAL, (v_item->>'quantity')::DECIMAL * (v_item->>'unit_price')::DECIMAL),
      COALESCE((v_item->>'kdv_rate')::DECIMAL, 0),
      COALESCE((v_item->>'otv_rate')::DECIMAL, 0),
      COALESCE((v_item->>'discount_percent')::DECIMAL, 0),
      COALESCE((v_item->>'discount_amount')::DECIMAL, 0),
      COALESCE((v_item->>'kdv_amount')::DECIMAL, 0),
      COALESCE((v_item->>'otv_amount')::DECIMAL, 0)
    );

    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;
    IF FOUND THEN
      IF v_product.track_stock IS NOT FALSE THEN
        v_new_qty := ROUND((COALESCE(v_product.stock_quantity, 0) + (v_item->>'quantity')::DECIMAL)::NUMERIC, 3);
        UPDATE public.products SET stock_quantity = v_new_qty, purchase_price = (v_item->>'unit_price')::DECIMAL WHERE id = v_product.id;
        INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_price, reference_id, reference, created_at)
        VALUES (v_product.id, 'purchase', (v_item->>'quantity')::DECIMAL, (v_item->>'unit_price')::DECIMAL, v_purchase_id, v_inv_number, v_now);
      ELSE
        UPDATE public.products SET purchase_price = (v_item->>'unit_price')::DECIMAL WHERE id = v_product.id;
      END IF;
    END IF;
  END LOOP;

  -- Kasa çıkışı (parçalı veya tekil)
  IF v_paid_now > 0 THEN
    IF v_method = 'split' AND v_splits IS NOT NULL THEN
      -- Parçalı ödeme
      FOR v_split_key, v_split_def IN
        VALUES ('cash','cash'), ('credit_card','card'), ('bank_transfer','transfer')
      LOOP
        v_split_amt := COALESCE((v_splits->v_split_key->>'amount')::DECIMAL, 0);
        IF v_split_amt > 0 THEN
          SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = v_split_def AND is_active = true LIMIT 1;
          IF FOUND THEN
            UPDATE public.cash_registers SET current_balance = ROUND((current_balance - v_split_amt)::NUMERIC, 2) WHERE id = v_reg.id;
            INSERT INTO public.cash_transactions (purchase_id, register_id, transaction_type, amount, reference, notes, created_at)
            VALUES (v_purchase_id, v_reg.id, 'purchase_out', v_split_amt, COALESCE(v_inv_number, 'ALI-' || v_purchase_id), v_split_key || ' (Parçalı Ödeme)', v_now);
          END IF;
        END IF;
      END LOOP;
    ELSE
      -- Tekil ödeme
      v_split_def := CASE v_method WHEN 'bank_transfer' THEN 'transfer' WHEN 'credit_card' THEN 'card' ELSE 'cash' END;
      SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = v_split_def AND is_active = true LIMIT 1;
      IF FOUND THEN
        UPDATE public.cash_registers SET current_balance = ROUND((current_balance - v_paid_now)::NUMERIC, 2) WHERE id = v_reg.id;
        INSERT INTO public.cash_transactions (purchase_id, register_id, transaction_type, amount, reference, notes, created_at)
        VALUES (v_purchase_id, v_reg.id, 'purchase_out', v_paid_now, COALESCE(v_inv_number, 'ALI-' || v_purchase_id), v_method || ' Ödemesi', v_now);
      END IF;
    END IF;
  END IF;

  -- Tedarikçi bakiyesi ve işlem kayıtları
  IF v_supplier_id IS NOT NULL THEN
    SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_supplier_id;
    IF FOUND THEN
      v_sup_balance := ROUND((COALESCE(v_supplier.balance, 0) + v_grand_total)::NUMERIC, 2);
      -- 1. Fatura hareketi
      INSERT INTO public.supplier_transactions (supplier_id, transaction_type, amount, balance_after, reference_id, created_at)
      VALUES (v_supplier_id, 'purchase', v_grand_total, v_sup_balance, v_purchase_id, v_now);

      -- 2. Ödeme hareketi(leri)
      v_offset := 100;
      IF v_paid_now > 0 AND v_method = 'split' AND v_splits IS NOT NULL THEN
        FOR v_split_key IN VALUES ('cash'), ('bank_transfer'), ('credit_card') LOOP
          v_split_amt := COALESCE((v_splits->v_split_key->>'amount')::DECIMAL, 0);
          IF v_split_amt > 0 THEN
            v_sup_balance := ROUND((v_sup_balance - v_split_amt)::NUMERIC, 2);
            INSERT INTO public.supplier_transactions (supplier_id, transaction_type, amount, balance_after, reference_id, notes, created_at)
            VALUES (v_supplier_id, 'payment', v_split_amt, v_sup_balance, v_purchase_id, v_split_key || ' (Parçalı Ödeme)', v_now + v_offset);
            v_offset := v_offset + 100;
          END IF;
        END LOOP;
      ELSIF v_paid_now > 0 THEN
        v_sup_balance := ROUND((v_sup_balance - v_paid_now)::NUMERIC, 2);
        INSERT INTO public.supplier_transactions (supplier_id, transaction_type, amount, balance_after, reference_id, notes, created_at)
        VALUES (v_supplier_id, 'payment', v_paid_now, v_sup_balance, v_purchase_id, 'Peşinat (' || v_method || ')', v_now + 100);
      END IF;

      UPDATE public.suppliers SET balance = v_sup_balance WHERE id = v_supplier_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('purchaseId', v_purchase_id, 'invoiceNumber', v_inv_number, 'status', 'success');
END;
$$;

-- ─── 4. FATURAYA EK ÖDEME ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_purchase_payment(
  p_purchase_id BIGINT,
  p_amount      DECIMAL,
  p_method      TEXT,
  p_notes       TEXT,
  p_account_id  BIGINT,
  p_date        BIGINT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_purchase  RECORD;
  v_supplier  RECORD;
  v_reg       RECORD;
  v_new_paid  DECIMAL(15,2);
  v_new_bal   DECIMAL(15,2);
  v_tx_date   BIGINT;
  v_default_for TEXT;
BEGIN
  v_tx_date := COALESCE(p_date, FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000));

  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura bulunamadı.'; END IF;

  IF p_amount > ((v_purchase.total_amount - COALESCE(v_purchase.paid_amount, 0)) + 0.001) THEN
    RAISE EXCEPTION 'Ödenen miktar toplamı aşamaz.';
  END IF;

  v_new_paid := ROUND((COALESCE(v_purchase.paid_amount, 0) + p_amount)::NUMERIC, 2);
  UPDATE public.purchases SET paid_amount = v_new_paid WHERE id = p_purchase_id;

  IF v_purchase.supplier_id IS NOT NULL THEN
    SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_purchase.supplier_id;
    IF FOUND THEN
      v_new_bal := ROUND((COALESCE(v_supplier.balance, 0) - p_amount)::NUMERIC, 2);
      UPDATE public.suppliers SET balance = v_new_bal WHERE id = v_purchase.supplier_id;
      INSERT INTO public.supplier_transactions (supplier_id, transaction_type, amount, balance_after, reference_id, notes, created_at)
      VALUES (v_purchase.supplier_id, 'payment', p_amount, v_new_bal, p_purchase_id, COALESCE(p_notes, p_method), v_tx_date);
    END IF;
  END IF;

  IF p_account_id IS NOT NULL THEN
    SELECT * INTO v_reg FROM public.cash_registers WHERE id = p_account_id AND is_active = true;
  ELSE
    v_default_for := CASE p_method WHEN 'bank_transfer' THEN 'transfer' WHEN 'credit_card' THEN 'card' ELSE 'cash' END;
    SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = v_default_for AND is_active = true LIMIT 1;
  END IF;

  IF FOUND THEN
    UPDATE public.cash_registers SET current_balance = ROUND((current_balance - p_amount)::NUMERIC, 2) WHERE id = v_reg.id;
    INSERT INTO public.cash_transactions (purchase_id, register_id, transaction_type, amount, notes, reference, created_at)
    VALUES (p_purchase_id, v_reg.id, 'purchase_out', p_amount,
            COALESCE(p_notes, p_method || ' Ödemesi'),
            COALESCE(v_purchase.invoice_number, 'ALI-' || p_purchase_id),
            v_tx_date);
  END IF;

  RETURN jsonb_build_object('newPaid', v_new_paid, 'status', 'success');
END;
$$;

-- ─── 5. GÜN SONU ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.perform_day_close(
  p_is_auto       BOOLEAN DEFAULT false,
  p_triggered_by  TEXT    DEFAULT 'manual'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_today           DATE;
  v_now_ts          TEXT;
  v_now_ms          BIGINT;
  v_reg             RECORD;
  v_tx              RECORD;
  v_today_start_ms  BIGINT;
  v_from_ms         BIGINT;
  v_income          DECIMAL(15,2);
  v_expense         DECIMAL(15,2);
  v_daily_net       DECIMAL(15,2);
  v_total_income    DECIMAL(15,2) := 0;
  v_total_expense   DECIMAL(15,2) := 0;
  v_total_net       DECIMAL(15,2) := 0;
  v_tx_count        INT := 0;
  v_primary_reg_id  BIGINT;
  v_summaries       JSONB := '[]'::JSONB;
  v_reg_summary     JSONB;
  v_close_data      JSONB;
  v_description     TEXT;
BEGIN
  v_today          := CURRENT_DATE;
  v_now_ts         := NOW()::TEXT;
  v_now_ms         := FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000);
  v_today_start_ms := FLOOR(EXTRACT(EPOCH FROM (v_today::TIMESTAMP)) * 1000);

  FOR v_reg IN SELECT * FROM public.cash_registers WHERE is_active = true LOOP
    IF v_primary_reg_id IS NULL THEN v_primary_reg_id := v_reg.id; END IF;

    -- SADECE son kapanıştan bu yana olanları al (Eğer hiç kapanmadıysa tümünü al)
    v_from_ms := COALESCE(v_reg.last_day_close_at, 0);

    -- Gelir topla
    SELECT COALESCE(SUM(amount), 0) INTO v_income
    FROM public.cash_transactions
    WHERE register_id = v_reg.id
      AND created_at > v_from_ms
      AND is_day_close IS NOT TRUE
      AND transaction_type IN ('sale_in','customer_payment_in','deposit_in','opening','transfer_in','return_in','in');

    -- Gider topla
    SELECT COALESCE(SUM(amount), 0) INTO v_expense
    FROM public.cash_transactions
    WHERE register_id = v_reg.id
      AND created_at > v_from_ms
      AND is_day_close IS NOT TRUE
      AND transaction_type IN ('purchase_out','supplier_payment_out','expense_out','withdrawal_out','transfer_out','return_out','out');

    -- İşlem sayısı
    SELECT COUNT(*) INTO v_tx_count
    FROM public.cash_transactions
    WHERE register_id = v_reg.id
      AND created_at > v_from_ms
      AND is_day_close IS NOT TRUE;

    v_daily_net := ROUND((COALESCE(v_reg.current_balance,0) - COALESCE(v_reg.general_balance,0))::NUMERIC, 2);

    v_reg_summary := jsonb_build_object(
      'register_id',    v_reg.id,
      'register_name',  v_reg.name,
      'opening_balance', COALESCE(v_reg.general_balance, 0),
      'closing_balance', COALESCE(v_reg.current_balance, 0),
      'income',   v_income,
      'expense',  v_expense,
      'daily_net', v_daily_net,
      'transaction_count', v_tx_count
    );
    v_summaries   := v_summaries || v_reg_summary;
    v_total_income  := v_total_income  + v_income;
    v_total_expense := v_total_expense + v_expense;
    v_total_net     := v_total_net     + v_daily_net;

    -- Kasayı güncelle
    UPDATE public.cash_registers SET
      general_balance     = current_balance,
      last_day_close_date = v_today,
      last_day_close_at   = v_now_ms
    WHERE id = v_reg.id;
  END LOOP;

  -- Konsolide gün sonu fişi
  v_description := CASE WHEN p_is_auto
    THEN TO_CHAR(NOW(), 'DD Mon YYYY') || ' Otomatik Gün Sonu'
    ELSE TO_CHAR(NOW(), 'DD Mon YYYY') || ' Manuel Gün Sonu'
  END;

  v_close_data := jsonb_build_object(
    'date',           TO_CHAR(NOW(), 'YYYY-MM-DD'),
    'triggered_at',   v_now_ts,
    'trigger_type',   p_triggered_by,
    'is_auto',        p_is_auto,
    'total_income',   ROUND(v_total_income::NUMERIC, 2),
    'total_expense',  ROUND(v_total_expense::NUMERIC, 2),
    'net_cashflow',   ROUND((v_total_income - v_total_expense)::NUMERIC, 2),
    'total_daily_net', ROUND(v_total_net::NUMERIC, 2),
    'register_summaries', v_summaries
  );

  IF v_primary_reg_id IS NOT NULL THEN
    INSERT INTO public.cash_transactions (
      register_id, transaction_type, amount, notes,
      is_day_close, is_consolidated, day_close_data, created_at
    ) VALUES (
      v_primary_reg_id, 'day_close',
      ROUND(v_total_net::NUMERIC, 2),
      v_description, true, true, v_close_data, v_now_ms
    );
  END IF;

  RETURN v_close_data;
END;
$$;

-- --- Z RAPORU VERİ TOPLAMA (Preview için) ---
CREATE OR REPLACE FUNCTION public.get_z_report_data(
  p_from_ms BIGINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_from_ms      BIGINT;
  v_now_ms       BIGINT;
  v_ciro         DECIMAL(15,2) := 0;
  v_tahsilat     DECIMAL(15,2) := 0;
  v_veresiye     DECIMAL(15,2) := 0;
  v_gider        DECIMAL(15,2) := 0;
  v_iade_sayi    INT := 0;
  v_iade_tutar   DECIMAL(15,2) := 0;
  v_satis_sayi   INT := 0;
  v_nakit_kar    DECIMAL(15,2) := 0;
  v_veresiye_kar DECIMAL(15,2) := 0;
  v_top5         JSONB;
  v_saatlik      JSONB;
  v_gider_cats   JSONB;
  v_odeme_dag    JSONB;
  v_kasa_durum   JSONB;
BEGIN
  v_now_ms  := FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000);
  v_from_ms := COALESCE(p_from_ms,
    FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE::TIMESTAMP)) * 1000));

  -- Ciro: aktif satislar (iade ve iptal haric)
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(CASE WHEN payment_method != 'credit' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total_amount ELSE 0 END), 0)
  INTO v_satis_sayi, v_ciro, v_tahsilat, v_veresiye
  FROM public.sales
  WHERE created_at >= v_from_ms AND created_at <= v_now_ms
    AND (status IS NULL OR status NOT IN ('return', 'cancelled'));

  -- Iadeler
  SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total_amount), 0)
  INTO v_iade_sayi, v_iade_tutar
  FROM public.sales
  WHERE created_at >= v_from_ms AND created_at <= v_now_ms
    AND status = 'return';

  -- Gider (kasa hareketleri)
  SELECT COALESCE(SUM(amount), 0) INTO v_gider
  FROM public.cash_transactions
  WHERE created_at >= v_from_ms AND created_at <= v_now_ms
    AND is_day_close IS NOT TRUE
    AND transaction_type IN ('purchase_out','supplier_payment_out','expense_out','withdrawal_out','return_out');

  -- Kar (AOM = purchase_price)
  SELECT
    COALESCE(SUM(CASE WHEN s.payment_method != 'credit'
      THEN si.line_total - (COALESCE(p.purchase_price, 0) * si.quantity) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.payment_method = 'credit'
      THEN si.line_total - (COALESCE(p.purchase_price, 0) * si.quantity) ELSE 0 END), 0)
  INTO v_nakit_kar, v_veresiye_kar
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE s.created_at >= v_from_ms AND s.created_at <= v_now_ms
    AND (s.status IS NULL OR s.status NOT IN ('return', 'cancelled'));

  -- Top 5 Urun
  SELECT COALESCE(jsonb_agg(t ORDER BY t.adet DESC), '[]'::JSONB) INTO v_top5 FROM (
    SELECT p.name, SUM(si.quantity) AS adet, ROUND(SUM(si.line_total)::NUMERIC,2) AS ciro,
      ROUND(SUM(si.line_total - COALESCE(p.purchase_price,0)*si.quantity)::NUMERIC,2) AS kar
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    LEFT JOIN public.products p ON p.id = si.product_id
    WHERE s.created_at >= v_from_ms AND s.created_at <= v_now_ms
      AND (s.status IS NULL OR s.status NOT IN ('return','cancelled'))
    GROUP BY p.name ORDER BY adet DESC LIMIT 5
  ) t;

  -- Saatlik (08-20)
  SELECT COALESCE(jsonb_agg(h ORDER BY h.saat), '[]'::JSONB) INTO v_saatlik FROM (
    SELECT EXTRACT(HOUR FROM TO_TIMESTAMP(created_at::FLOAT/1000) AT TIME ZONE 'Europe/Istanbul')::INT AS saat,
      COUNT(*) AS satis, ROUND(SUM(total_amount)::NUMERIC,2) AS tutar
    FROM public.sales
    WHERE created_at >= v_from_ms AND created_at <= v_now_ms
      AND (status IS NULL OR status NOT IN ('return','cancelled'))
    GROUP BY saat ORDER BY saat
  ) h;

  -- Gider Kategorileri
  SELECT COALESCE(jsonb_agg(g ORDER BY g.tutar DESC), '[]'::JSONB) INTO v_gider_cats FROM (
    SELECT CASE transaction_type
        WHEN 'purchase_out' THEN 'Mal Alimi'
        WHEN 'supplier_payment_out' THEN 'Tedarikci Odemesi'
        WHEN 'expense_out' THEN 'Genel Gider'
        WHEN 'withdrawal_out' THEN 'Para Cikisi'
        WHEN 'return_out' THEN 'Iade Odemesi'
        ELSE 'Diger' END AS kategori,
      ROUND(SUM(amount)::NUMERIC,2) AS tutar
    FROM public.cash_transactions
    WHERE created_at >= v_from_ms AND created_at <= v_now_ms
      AND is_day_close IS NOT TRUE
      AND transaction_type IN ('purchase_out','supplier_payment_out','expense_out','withdrawal_out','return_out')
    GROUP BY transaction_type ORDER BY tutar DESC
  ) g;

  -- Odeme Yontemi Dagilimi
  SELECT COALESCE(jsonb_agg(pm ORDER BY pm.tutar DESC), '[]'::JSONB) INTO v_odeme_dag FROM (
    SELECT payment_method AS yontem, COUNT(*) AS adet, ROUND(SUM(total_amount)::NUMERIC,2) AS tutar
    FROM public.sales
    WHERE created_at >= v_from_ms AND created_at <= v_now_ms
      AND (status IS NULL OR status NOT IN ('return','cancelled'))
    GROUP BY payment_method ORDER BY tutar DESC
  ) pm;

  -- Kasa Durumu
  SELECT COALESCE(jsonb_agg(k ORDER BY k.tur, k.ad), '[]'::JSONB) INTO v_kasa_durum FROM (
    SELECT id, name AS ad, type AS tur,
      COALESCE(general_balance, 0) AS acilis,
      COALESCE(current_balance, 0) AS kapanis,
      ROUND((COALESCE(current_balance,0) - COALESCE(general_balance,0))::NUMERIC,2) AS net
    FROM public.cash_registers WHERE is_active = true
  ) k;

  RETURN jsonb_build_object(
    'ciro',       ROUND(v_ciro::NUMERIC,2),
    'tahsilat',   ROUND(v_tahsilat::NUMERIC,2),
    'veresiye',   ROUND(v_veresiye::NUMERIC,2),
    'gider',      ROUND(v_gider::NUMERIC,2),
    'net',        ROUND((v_tahsilat - v_gider)::NUMERIC,2),
    'satis_sayi', v_satis_sayi,
    'iade_sayi',  v_iade_sayi,
    'iade_tutar', ROUND(v_iade_tutar::NUMERIC,2),
    'nakit_kar',  ROUND(v_nakit_kar::NUMERIC,2),
    'veresiye_kar', ROUND(v_veresiye_kar::NUMERIC,2),
    'toplam_kar', ROUND((v_nakit_kar + v_veresiye_kar)::NUMERIC,2),
    'top5',       v_top5,
    'saatlik',    v_saatlik,
    'gider_cats', v_gider_cats,
    'odeme_dag',  v_odeme_dag,
    'kasalar',    v_kasa_durum,
    'from_ms',    v_from_ms
  );
END;
$$;
