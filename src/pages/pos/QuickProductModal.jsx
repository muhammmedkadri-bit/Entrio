import React from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../components/ui/CustomToast';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { productService } from '../../services/productService';

export const QuickProductModal = ({ isOpen, onClose, initialBarcode, onProductAdded }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  // Reset form when modal opens with new barcode
  React.useEffect(() => {
    if (isOpen) {
      reset({
        barcode: initialBarcode || '',
        name: '',
        sale_price: '',
        stock_quantity: 0
      });
    }
  }, [isOpen, initialBarcode, reset]);

  const onSubmit = async (data) => {
    try {
      const newProduct = {
        barcode: data.barcode,
        name: data.name,
        category_id: 1, // Default category
        supplier_id: 1,
        sale_price: parseFloat(data.sale_price) || 0,
        purchase_price: 0,
        stock_quantity: parseInt(data.stock_quantity) || 0,
        min_stock_level: 5,
        tax_rate: 20,
        unit: 'Adet',
        is_active: true
      };

      const added = await productService.create(newProduct);
      toast.success('Ürün başarıyla eklendi.');
      onProductAdded(added);
      onClose();
    } catch (error) {
      console.error('[QuickProduct] Ürün eklenemedi:', error);
      toast.error(error?.message || 'Ürün eklenirken beklenmeyen bir hata oluştu.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hızlı Ürün Ekleme"
      size="sm"
    >
      <form id="quick-product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Barkod"
          {...register('barcode', { required: 'Barkod zorunlu' })}
          error={errors.barcode?.message}
        />
        <Input
          label="Ürün Adı"
          autoFocus
          {...register('name', { required: 'Ürün adı zorunlu' })}
          error={errors.name?.message}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Satış Fiyatı (₺)"
            type="number"
            step="0.01"
            min="0"
            {...register('sale_price', { required: 'Zorunlu' })}
            error={errors.sale_price?.message}
          />
          <Input
            label="Stok Miktarı"
            type="number"
            min="0"
            {...register('stock_quantity', { required: 'Zorunlu' })}
            error={errors.stock_quantity?.message}
          />
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <Button variant="ghost" onClick={onClose} type="button">İptal</Button>
          <Button type="submit" isLoading={isSubmitting}>Kaydet ve Ekle</Button>
        </div>
      </form>
    </Modal>
  );
};
