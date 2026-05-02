import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      // --- MEVCUT DURUMLAR (STATES) ---
      items: [], // { product, quantity, lineTotal }
      selectedCustomer: null,
      selectedSupplier: null,
      paymentMethod: 'cash',
      activeRegisterId: 1,

      posMode: 'sale', // 'sale' | 'return' | 'purchase'
      returnSaleId: null, // If returning, the ID of the sale being returned

      // Discount states
      discountType: 'percent', // 'percent' | 'amount'
      discountValue: 0,
      discountEnabled: false,
      discountReason: '',

      // --- YENİ EKLENEN DURUMLAR (Faz 2 / Adım 4 için Altyapı) ---
      // Kısmi ödeme sırasında girilen tutarların sayfa yenilenmesinden korunması için
      pendingCash: 0,
      pendingCard: 0,
      pendingTransfer: 0,

      // --- EYLEMLER (ACTIONS) ---
      addItem: (product, qty = 1) => {
        set((state) => {
          const existingItem = state.items.find(item => item.product.id === product.id);
          if (existingItem) {
            return {
              items: state.items.map(item =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + qty, lineTotal: (item.quantity + qty) * item.product.sale_price }
                  : item
              )
            };
          } else {
            return {
              items: [...state.items, { product, quantity: qty, lineTotal: qty * product.sale_price }]
            };
          }
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter(item => item.product.id !== productId)
        }));
      },

      updateQty: (productId, qty) => {
        set((state) => ({
          items: state.items.map(item =>
            item.product.id === productId
              ? { ...item, quantity: qty, lineTotal: qty * item.product.sale_price }
              : item
          )
        }));
      },

      updateItemPrice: (productId, newPrice) => {
        set((state) => ({
          items: state.items.map(item =>
            item.product.id === productId
              ? { ...item, product: { ...item.product, sale_price: newPrice }, lineTotal: item.quantity * newPrice }
              : item
          )
        }));
      },

      // Discount Actions
      setDiscountType: (type) => set({ discountType: type }),
      setDiscountValue: (value) => set({ discountValue: value }),
      toggleDiscount: () => set(state => ({ discountEnabled: !state.discountEnabled, discountValue: 0 })),
      setDiscountReason: (reason) => set({ discountReason: reason }),

      // YENİ EKLENEN EYLEM: Parçalı ödeme tutarlarını güncelle
      setPendingAmounts: (cash, card, transfer) => set({
        pendingCash: cash,
        pendingCard: card,
        pendingTransfer: transfer
      }),

      // clearCart güncellendi: pending tutarları da sıfırlaması için
      clearCart: (preserveEntities = false) => set((state) => ({
        items: [],
        selectedCustomer: preserveEntities ? state.selectedCustomer : null,
        selectedSupplier: preserveEntities ? state.selectedSupplier : null,
        paymentMethod: 'cash',
        discountType: 'percent',
        discountValue: 0,
        discountEnabled: false,
        discountReason: '',
        returnSaleId: null,
        pendingCash: 0,     // EKLENDİ
        pendingCard: 0,     // EKLENDİ
        pendingTransfer: 0  // EKLENDİ
      })),

      setPosMode: (mode) => set({ posMode: mode }),
      setReturnSaleId: (id) => set({ returnSaleId: id }),
      setSupplier: (supplier) => set({ selectedSupplier: supplier }),

      setCustomer: (customer) => {
        const state = get();
        const isRetail = !customer || customer.customer_type === 'retail';

        if (isRetail && state.paymentMethod === 'credit') {
          set({ selectedCustomer: customer, paymentMethod: 'cash' });
        } else {
          set({ selectedCustomer: customer });
        }
      },

      setPaymentMethod: (method) => set({ paymentMethod: method }),

      calculateTotals: () => {
        const { items, discountType, discountValue, discountEnabled } = get();

        // 1. Calculate raw subtotal (includes VAT in item prices implicitly based on current system)
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

        // 2. Calculate discount amount
        let discountAmount = 0;
        if (discountEnabled && discountValue > 0) {
          if (discountType === 'percent') {
            discountAmount = Math.round((subtotal * (discountValue / 100)) * 100) / 100;
            // Cap percent discount at subtotal (shouldn't happen unless > 100%)
            discountAmount = Math.min(discountAmount, subtotal);
          } else if (discountType === 'amount') {
            discountAmount = Math.min(discountValue, subtotal);
          }
        }

        // 3. Discounted subtotal
        const discountedSubtotal = subtotal - discountAmount;

        // 4. Because Tanotom uses VAT-inclusive prices inside products naturally,
        // total is just discountedSubtotal.
        const total = Math.round(discountedSubtotal * 100) / 100;

        return {
          subtotal,
          discountAmount,
          total
        };
      }
    }),
    {
      name: 'entrio-pos-cart', // sessionStorage'da görünecek anahtar kelime
      storage: createJSONStorage(() => sessionStorage), // Veriyi sessionStorage'a kaydet (Sekme kapanınca silinir)
    }
  )
);