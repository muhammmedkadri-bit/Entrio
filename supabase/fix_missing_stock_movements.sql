-- Eksik olan satış (sale) stok hareketlerini tamamla
INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_price, item_discount, reference_id, reference, created_at)
SELECT 
  si.product_id,
  'sale',
  si.quantity,
  si.unit_price,
  si.discount,
  s.id,
  s.sale_number,
  s.created_at
FROM public.sale_items si
JOIN public.sales s ON si.sale_id = s.id
LEFT JOIN public.stock_movements sm 
  ON sm.reference_id = s.id AND sm.product_id = si.product_id AND sm.movement_type = 'sale'
WHERE sm.id IS NULL AND s.status != 'cancelled';

-- Eksik olan iade (return_in) stok hareketlerini tamamla
INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_price, reference_id, reference, created_at)
SELECT 
  si.product_id,
  'return_in',
  si.quantity,
  si.unit_price,
  s.id,
  s.sale_number,
  s.created_at
FROM public.sale_items si
JOIN public.sales s ON si.sale_id = s.id
LEFT JOIN public.stock_movements sm 
  ON sm.reference_id = s.id AND sm.product_id = si.product_id AND sm.movement_type = 'return_in'
WHERE sm.id IS NULL AND s.status = 'returned';

-- Eksik olan alış (purchase) stok hareketlerini tamamla
INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_price, reference_id, reference, created_at)
SELECT 
  pi.product_id,
  'purchase',
  pi.quantity,
  pi.unit_price,
  p.id,
  p.purchase_number,
  p.created_at
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.stock_movements sm 
  ON sm.reference_id = p.id AND sm.product_id = pi.product_id AND sm.movement_type = 'purchase'
WHERE sm.id IS NULL AND p.status != 'cancelled';
