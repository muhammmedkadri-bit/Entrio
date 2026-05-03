import { useEffect } from 'react';
import { dayCloseService } from '../services/dayCloseService';
import { useAuthStore } from '../store/authStore';

export const useDayCloseScheduler = () => {
  const { user } = useAuthStore();

  useEffect(() => {
    // Sadece giriş yapmış kullanıcılar için çalışsın
    if (!user) return;

    let midnightTimer = null;

    const scheduleMidnightClose = () => {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 15, 0); // Gece 00:00:15 — 15 saniye tolerans

      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      midnightTimer = setTimeout(async () => {
        try {
          const needed = await dayCloseService.needsDayClose();
          if (needed) {
            await dayCloseService.performDayClose({
              isAuto: true,
              triggeredBy: 'auto_midnight'
            });
          }
        } catch (err) {
          console.error('Otomatik gün sonu hatası:', err);
        } finally {
          scheduleMidnightClose(); // Ertesi gece için tekrar planla
        }
      }, msUntilMidnight);
    };

    const checkMissedDayClose = async () => {
      try {
        const needed = await dayCloseService.needsDayClose();
        if (needed) {
          const { cashService } = await import('../services/cashService');
          const registers = await cashService.getRegisters();
          const lastClose = registers
            .map(r => r.last_day_close_date)
            .filter(Boolean)
            .sort()
            .pop();

          const today = dayCloseService.getLocalDateStr();
          if (lastClose && lastClose < today) {
            // Dün gece gün sonu yapılmamış — şimdi yap
            await dayCloseService.performDayClose({
              isAuto: true,
              triggeredBy: 'app_open_recovery'
            });
          }
        }
      } catch (err) {
        console.error('Missed day close check error:', err);
      }
    };

    checkMissedDayClose();
    scheduleMidnightClose();

    return () => {
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, [user]); // user değiştiğinde yeniden değerlendir

  return null;
};
