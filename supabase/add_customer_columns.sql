-- Entrio POS: customers tablosuna eksik sütunlar ekleniyor
-- Bu SQL'i Supabase SQL Editor'de çalıştırın.

-- tax_number, city, district, address sütunları ekleniyor
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tax_number TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;
