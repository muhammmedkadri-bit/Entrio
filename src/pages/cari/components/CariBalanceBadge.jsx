import React from 'react';
import { Badge } from '../../../components/ui/Badge';

export const CariBalanceBadge = ({ balance, entityType = 'customer', size = 'md' }) => {
  const val = parseFloat(balance) || 0;
  
  const formatOptions = { style: 'currency', currency: 'TRY' };
  const formatted = new Intl.NumberFormat('tr-TR', formatOptions).format(Math.abs(val));

  if (val === 0) {
    return <Badge variant="default" className={size === 'lg' ? 'text-lg px-4 py-1' : ''}>Bakiye Yok</Badge>;
  }

  // Müşteride: pozitif bakiye = bize borçlu (kırmızı)
  // Tedarikçide: pozitif bakiye = biz ona borçluyuz (kırmızı)
  const isDebt = val > 0;
  
  let text = '';
  if (entityType === 'customer') {
    text = isDebt ? `${formatted} Borçlu` : `${formatted} Alacaklı`;
  } else {
    // Supplier
    text = isDebt ? `${formatted} Alacaklı (Borcumuz)` : `${formatted} Borçlu`;
  }

  // Pozitif (borç) kırmızı, Negatif (alacak) yeşil.
  // Wait, if customer is debt -> red.
  // If supplier is debt to us (negative balance) -> green to us.
  // So basically val > 0 is always RED/Warning, val < 0 is always GREEN.
  const variant = isDebt ? 'danger' : 'success';

  return (
    <Badge variant={variant} className={size === 'lg' ? 'text-lg px-4 py-1.5 font-black' : ''}>
      {text}
    </Badge>
  );
};
