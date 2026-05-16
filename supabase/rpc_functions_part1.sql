-- ═══════════════════════════════════════════════════════════════════════════
-- Entrio POS - SQL RPC Fonksiyonları (Bölüm 1: Satış İşlemleri)
-- Supabase SQL Editor'de schema.sql'den SONRA çalıştırın.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. SATIŞ OLUŞTURMA ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_sale(
  p_sale_data     JSONB,
  p_items         JSONB,
  p_payment_data  JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_sale_id         BIGINT;
  v_sale_number     TEXT;
  v_now             BIGINT;
  v_item            JSONB;
  v_product         RECORD;
  v_customer        RECORD;
  v_reg             RECORD;
  v_new_qty         DECIMAL(15,3);
  v_customer_id     BIGINT;
  v_total_amount    DECIMAL(15,2);
  v_paid_now        DECIMAL(15,2);
  v_credit_amount   DECIMAL(15,2);
  v_new_balance     DECIMAL(15,2);
  v_payment_method  TEXT;
  v_cash_amount     DECIMAL(15,2);
  v_card_amount     DECIMAL(15,2);
  v_transfer_amount DECIMAL(15,2);
  v_override_reg_id BIGINT;
  v_sale_status     TEXT;
BEGIN
  v_now             := FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000);
  v_customer_id     := (p_sale_data->>'customer_id')::BIGINT;
  v_total_amount    := COALESCE((p_sale_data->>'total_amount')::DECIMAL, 0);
  v_payment_method  := p_payment_data->>'method';
  v_cash_amount     := COALESCE((p_payment_data->>'cashAmount')::DECIMAL, 0);
  v_card_amount     := COALESCE((p_payment_data->>'cardAmount')::DECIMAL, 0);
  v_transfer_amount := COALESCE((p_payment_data->>'transferAmount')::DECIMAL, 0);
  v_credit_amount   := COALESCE((p_payment_data->>'creditAmount')::DECIMAL, 0);
  v_paid_now        := v_cash_amount + v_card_amount + v_transfer_amount;
  v_override_reg_id := NULLIF(p_payment_data->>'overrideRegisterId', '')::BIGINT;

  v_sale_status := CASE
    WHEN v_credit_amount > 0 AND v_paid_now = 0 THEN 'pending'
    WHEN v_credit_amount > 0 THEN 'partial'
    ELSE 'completed'
  END;

  -- Satışı kaydet (sale_number ID alındıktan sonra güncellenir)
  INSERT INTO public.sales (
    sale_number, customer_id, subtotal, total_amount, paid_amount,
    discount_amount, discount_type, discount_value, discount_reason,
    payment_method, split_payments, status, notes, created_at
  ) VALUES (
    'TEMP', v_customer_id,
    COALESCE((p_sale_data->>'subtotal')::DECIMAL, v_total_amount),
    v_total_amount, v_paid_now,
    COALESCE((p_sale_data->>'discount_amount')::DECIMAL, 0),
    p_sale_data->>'discount_type',
    COALESCE((p_sale_data->>'discount_value')::DECIMAL, 0),
    p_sale_data->>'discount_reason',
    v_payment_method,
    CASE WHEN v_payment_method = 'mixed' THEN p_payment_data ELSE NULL END,
    v_sale_status, p_sale_data->>'notes', v_now
  ) RETURNING id INTO v_sale_id;

  -- Fiş numarası ataması: JavaScript'ten gönderildiyse onu kullan, yoksa standart formatı kullan.
  v_sale_number := COALESCE(p_sale_data->>'sale_number', 'SAT-' || SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2) || LPAD(v_sale_id::TEXT, 5, '0'));
  UPDATE public.sales SET sale_number = v_sale_number WHERE id = v_sale_id;

  -- Satış kalemleri ve stok güncelleme
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.sale_items (sale_id, product_id, name, quantity, unit_price, line_total, discount, kdv_amount)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::BIGINT, v_item->>'name',
      (v_item->>'quantity')::DECIMAL, (v_item->>'unit_price')::DECIMAL,
      (v_item->>'line_total')::DECIMAL,
      COALESCE((v_item->>'discount')::DECIMAL, 0),
      COALESCE((v_item->>'kdv_amount')::DECIMAL, 0)
    );

    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;
    IF FOUND THEN
      IF v_product.track_stock IS NOT FALSE THEN
        v_new_qty := ROUND((COALESCE(v_product.stock_quantity, 0) - (v_item->>'quantity')::DECIMAL)::NUMERIC, 3);
        UPDATE public.products SET stock_quantity = v_new_qty WHERE id = v_product.id;
      END IF;
      
      INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_price, item_discount, reference_id, reference, created_at)
      VALUES (v_product.id, 'sale', (v_item->>'quantity')::DECIMAL,
              (v_item->>'unit_price')::DECIMAL,
              COALESCE((v_item->>'discount')::DECIMAL, 0),
              v_sale_id,
              v_sale_number, v_now);
    END IF;
  END LOOP;

  -- Veresiye: müşteri bakiyesini artır
  IF v_credit_amount > 0 AND v_customer_id IS NOT NULL AND v_customer_id <> 1 THEN
    SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id;
    IF FOUND THEN
      v_new_balance := ROUND((COALESCE(v_customer.balance, 0) + v_credit_amount)::NUMERIC, 2);
      UPDATE public.customers SET balance = v_new_balance WHERE id = v_customer_id;
      INSERT INTO public.customer_transactions (customer_id, transaction_type, amount, balance_after, reference_id, sale_number, notes, created_at)
      VALUES (v_customer_id, 'sale', v_credit_amount, v_new_balance, v_sale_id, v_sale_number, 'Veresiye Satış', v_now);
    END IF;
  END IF;

  -- Nakit ödeme → nakit kasaya ekle
  IF v_cash_amount > 0 THEN
    IF v_override_reg_id IS NOT NULL THEN
      SELECT * INTO v_reg FROM public.cash_registers WHERE id = v_override_reg_id AND is_active = true;
    ELSE
      SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = 'cash' AND is_active = true LIMIT 1;
    END IF;
    IF FOUND THEN
      UPDATE public.cash_registers SET current_balance = ROUND((current_balance + v_cash_amount)::NUMERIC, 2) WHERE id = v_reg.id;
      INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
      VALUES (v_sale_id, v_reg.id, 'sale_in', v_cash_amount, 'Nakit Satış: ' || v_sale_number, v_now);
    END IF;
  END IF;

  -- Kredi kartı ödeme → POS hesabına ekle
  IF v_card_amount > 0 THEN
    IF v_override_reg_id IS NOT NULL THEN
      SELECT * INTO v_reg FROM public.cash_registers WHERE id = v_override_reg_id AND is_active = true;
    ELSE
      SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = 'card' AND is_active = true LIMIT 1;
    END IF;
    IF FOUND THEN
      UPDATE public.cash_registers SET current_balance = ROUND((current_balance + v_card_amount)::NUMERIC, 2) WHERE id = v_reg.id;
      INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
      VALUES (v_sale_id, v_reg.id, 'sale_in', v_card_amount, 'Kredi Kartı Satış: ' || v_sale_number, v_now);
    END IF;
  END IF;

  -- Havale/EFT ödeme → banka hesabına ekle
  IF v_transfer_amount > 0 THEN
    SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = 'transfer' AND is_active = true LIMIT 1;
    IF FOUND THEN
      UPDATE public.cash_registers SET current_balance = ROUND((current_balance + v_transfer_amount)::NUMERIC, 2) WHERE id = v_reg.id;
      INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
      VALUES (v_sale_id, v_reg.id, 'sale_in', v_transfer_amount, 'Havale/EFT Satış: ' || v_sale_number, v_now);
    END IF;
  END IF;

  RETURN jsonb_build_object('saleId', v_sale_id, 'saleNumber', v_sale_number, 'status', 'success');
END;
$$;

-- --- 2. IADE OLUSTURMA ---
CREATE OR REPLACE FUNCTION public.create_sale_return(
  p_return_data   JSONB,
  p_items         JSONB,
  p_payment_data  JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_return_id        BIGINT;
  v_return_number    TEXT;
  v_now              BIGINT;
  v_item             JSONB;
  v_product          RECORD;
  v_customer         RECORD;
  v_reg              RECORD;
  v_new_qty          DECIMAL(15,3);
  v_customer_id      BIGINT;
  v_total_amount     DECIMAL(15,2);
  v_payment_method   TEXT;
  v_new_balance      DECIMAL(15,2);
  v_original_sale_id BIGINT;
  v_cash_amount      DECIMAL(15,2);
  v_card_amount      DECIMAL(15,2);
  v_transfer_amount  DECIMAL(15,2);
BEGIN
  v_now              := FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000);
  v_customer_id      := (p_return_data->>'customer_id')::BIGINT;
  v_total_amount     := COALESCE((p_return_data->>'total_amount')::DECIMAL, 0);
  v_payment_method   := p_payment_data->>'method';
  v_original_sale_id := NULLIF(p_return_data->>'original_sale_id', '')::BIGINT;
  v_cash_amount      := COALESCE((p_payment_data->>'cashAmount')::DECIMAL, 0);
  v_card_amount      := COALESCE((p_payment_data->>'cardAmount')::DECIMAL, 0);
  v_transfer_amount  := COALESCE((p_payment_data->>'transferAmount')::DECIMAL, 0);

  -- For single-method returns where no explicit amounts provided, use total
  IF (v_cash_amount + v_card_amount + v_transfer_amount) = 0 THEN
    IF    v_payment_method = 'cash'     THEN v_cash_amount     := v_total_amount;
    ELSIF v_payment_method = 'card'     THEN v_card_amount     := v_total_amount;
    ELSIF v_payment_method = 'transfer' THEN v_transfer_amount := v_total_amount;
    END IF;
  END IF;

  -- Create return sale (IAD- number generated by SQL, never from client)
  INSERT INTO public.sales (
    sale_number, customer_id, total_amount, paid_amount,
    payment_method, status, original_sale_id, created_at
  ) VALUES (
    'TEMP', v_customer_id, v_total_amount, v_total_amount,
    v_payment_method, 'return', v_original_sale_id, v_now
  ) RETURNING id INTO v_return_id;

  v_return_number := 'IAD-' || SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2) || LPAD(v_return_id::TEXT, 5, '0');
  UPDATE public.sales SET sale_number = v_return_number WHERE id = v_return_id;

  -- Mark original sale as returned
  IF v_original_sale_id IS NOT NULL THEN
    UPDATE public.sales SET status = 'returned' WHERE id = v_original_sale_id;
  END IF;

  -- Return items + restock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.sale_items (sale_id, product_id, name, quantity, unit_price, line_total)
    VALUES (
      v_return_id, (v_item->>'product_id')::BIGINT, v_item->>'name',
      (v_item->>'quantity')::DECIMAL, (v_item->>'unit_price')::DECIMAL,
      (v_item->>'line_total')::DECIMAL
    );
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;
    IF FOUND THEN
      IF v_product.track_stock IS NOT FALSE THEN
        v_new_qty := ROUND((COALESCE(v_product.stock_quantity, 0) + (v_item->>'quantity')::DECIMAL)::NUMERIC, 3);
        UPDATE public.products SET stock_quantity = v_new_qty WHERE id = v_product.id;
      END IF;
      INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_price, reference_id, reference, created_at)
      VALUES (v_product.id, 'return_in', (v_item->>'quantity')::DECIMAL,
              (v_item->>'unit_price')::DECIMAL, v_return_id, v_return_number, v_now);
    END IF;
  END LOOP;

  -- Cash refund
  IF v_cash_amount > 0 THEN
    SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = 'cash' AND is_active = true LIMIT 1;
    IF FOUND THEN
      UPDATE public.cash_registers SET current_balance = ROUND((current_balance - v_cash_amount)::NUMERIC, 2) WHERE id = v_reg.id;
      INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
      VALUES (v_return_id, v_reg.id, 'return_out', v_cash_amount, 'Nakit Iade: ' || v_return_number, v_now);
      -- Also link to original sale so it appears in SaleDetailPage payment history
      IF v_original_sale_id IS NOT NULL THEN
        INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
        VALUES (v_original_sale_id, v_reg.id, 'return_out', v_cash_amount, 'Nakit Iade: ' || v_return_number, v_now + 1);
      END IF;
    END IF;
  END IF;

  -- Card refund
  IF v_card_amount > 0 THEN
    SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = 'card' AND is_active = true LIMIT 1;
    IF FOUND THEN
      UPDATE public.cash_registers SET current_balance = ROUND((current_balance - v_card_amount)::NUMERIC, 2) WHERE id = v_reg.id;
      INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
      VALUES (v_return_id, v_reg.id, 'return_out', v_card_amount, 'Kredi Karti Iade: ' || v_return_number, v_now);
      IF v_original_sale_id IS NOT NULL THEN
        INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
        VALUES (v_original_sale_id, v_reg.id, 'return_out', v_card_amount, 'Kredi Karti Iade: ' || v_return_number, v_now + 1);
      END IF;
    END IF;
  END IF;

  -- Transfer refund
  IF v_transfer_amount > 0 THEN
    SELECT * INTO v_reg FROM public.cash_registers WHERE is_default_for = 'transfer' AND is_active = true LIMIT 1;
    IF FOUND THEN
      UPDATE public.cash_registers SET current_balance = ROUND((current_balance - v_transfer_amount)::NUMERIC, 2) WHERE id = v_reg.id;
      INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
      VALUES (v_return_id, v_reg.id, 'return_out', v_transfer_amount, 'Havale/EFT Iade: ' || v_return_number, v_now);
      IF v_original_sale_id IS NOT NULL THEN
        INSERT INTO public.cash_transactions (reference_id, register_id, transaction_type, amount, notes, created_at)
        VALUES (v_original_sale_id, v_reg.id, 'return_out', v_transfer_amount, 'Havale/EFT Iade: ' || v_return_number, v_now + 1);
      END IF;
    END IF;
  END IF;

  -- Credit refund: reduce customer balance
  IF v_payment_method = 'credit' AND v_customer_id IS NOT NULL AND v_customer_id <> 1 THEN
    SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id;
    IF FOUND THEN
      v_new_balance := ROUND((COALESCE(v_customer.balance, 0) - v_total_amount)::NUMERIC, 2);
      UPDATE public.customers SET balance = v_new_balance WHERE id = v_customer_id;
      INSERT INTO public.customer_transactions (customer_id, transaction_type, amount, balance_after, reference_id, sale_number, notes, created_at)
      VALUES (v_customer_id, 'return', v_total_amount, v_new_balance, v_return_id, v_return_number, 'Satis Iadesi', v_now);
    END IF;
  ELSIF v_customer_id IS NOT NULL AND v_customer_id <> 1 THEN
    -- Cash/card/transfer refund: still record in customer history for visibility
    SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id;
    IF FOUND THEN
      INSERT INTO public.customer_transactions (customer_id, transaction_type, amount, balance_after, reference_id, sale_number, notes, created_at)
      VALUES (v_customer_id, 'return', v_total_amount, COALESCE(v_customer.balance, 0),
              v_return_id, v_return_number, 'Pesin Satis Iadesi', v_now);
    END IF;
  END IF;

  RETURN jsonb_build_object('returnId', v_return_id, 'returnNumber', v_return_number, 'status', 'success');
END;
$$;

