import React, { useState, useEffect, useRef } from 'react';
import { useForm as useHookForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye as EyeIcon, EyeOff, Mail, Lock, LogIn, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import EntrioLogoPng from '../../assets/Entriologop.png';

/* ─── Unified Eye Component (DRY & Perf Optimized) ────────── */
// globalMouse prop is passed down to prevent 8 different event listeners
function Eye({ size = 48, pupilSize = 16, maxDistance = 10, eyeColor = 'white', pupilColor = 'black', isBlinking = false, forceLookX, forceLookY, globalMouse, showWhite = true }) {
  const ref = useRef(null);

  const getPos = () => {
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = globalMouse.x - cx, dy = globalMouse.y - cy;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  };

  const pos = getPos();

  return (
    <div ref={ref} style={{
      width: size,
      height: isBlinking ? 2 : size,
      backgroundColor: showWhite ? eyeColor : pupilColor,
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', transition: 'height 0.1s',
      transform: showWhite ? 'none' : `translate(${pos.x}px, ${pos.y}px)`, // Move whole element if no white
    }}>
      {!isBlinking && showWhite && (
        <div style={{
          width: pupilSize, height: pupilSize, backgroundColor: pupilColor,
          borderRadius: '50%', transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: 'transform 0.1s ease-out'
        }} />
      )}
    </div>
  );
}

/* ─── Secure Forgot Password Modal ────────────────────────── */
function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, searching, found, notfound

  const handleSearch = async () => {
    if (!email.trim()) return;
    setStatus('searching');
    try {
      const { db } = await import('../../db');
      // Optimizasyon: Sadece aranan maile uyan tek bir kaydı getirir.
      const match = await db.users.where('email').equalsIgnoreCase(email.trim()).first();
      
      if (match) {
        setStatus('found');
      } else {
        setStatus('notfound');
      }
    } catch (error) {
      console.error("Şifre sıfırlama hatası:", error);
      setStatus('notfound');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(126,217,87,0.15)' }}>
            <Lock className="w-5 h-5" style={{ color: '#5da83f' }} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Şifremi Unuttum</h3>
            <p className="text-xs text-slate-500">Hesabınıza ait e-posta adresini girin.</p>
          </div>
        </div>

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="email" placeholder="kayitli@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setStatus('idle'); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm border-2 border-slate-200 focus:border-[#7ed957] outline-none transition-all bg-slate-50 focus:bg-white"
          />
        </div>

        {/* Security Update: Never show plaintext password. */}
        {status === 'found' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">Talebiniz Alındı</p>
              <p className="text-xs text-green-700 mt-0.5">Şifre sıfırlama talimatları (eğer sistem aktifse) e-posta adresinize gönderilecektir. Sorun yaşarsanız yöneticinizle iletişime geçin.</p>
            </div>
          </div>
        )}
        
        {status === 'notfound' && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 font-medium">
            Sistemde bu e-posta adresiyle eşleşen bir hesap bulunamadı.
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Kapat</button>
          <button onClick={handleSearch} disabled={status === 'searching'} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-70" style={{ background: 'linear-gradient(135deg,#7ed957,#5da83f)' }}>
            {status === 'searching' ? 'Sorgulanıyor...' : 'Sorgula'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Login ──────────────────────────────────────────── */
export const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading: isAuthLoading } = useAuthStore();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useHookForm();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  
  // Character states
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  
  // Centralized Mouse State (Performance Fix)
  const [globalMouse, setGlobalMouse] = useState({ x: 0, y: 0 });

  const purpleRef = useRef(null);
  const blackRef = useRef(null);
  const yellowRef = useRef(null);
  const orangeRef = useRef(null);

  const passwordValue = watch('password', '');

  // 1 Event Listener for entire screen
  useEffect(() => {
    let ticking = false;
    const handleGlobalMouseMove = (e) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setGlobalMouse({ x: e.clientX, y: e.clientY });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  // Blink Schedulers
  useEffect(() => {
    let t;
    const schedule = () => {
      t = setTimeout(() => { setIsPurpleBlinking(true); setTimeout(() => setIsPurpleBlinking(false), 150); schedule(); }, Math.random() * 4000 + 3000);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let t;
    const schedule = () => {
      t = setTimeout(() => { setIsBlackBlinking(true); setTimeout(() => setIsBlackBlinking(false), 150); schedule(); }, Math.random() * 4000 + 3000);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  // Look at each other when typing
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const t = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => clearTimeout(t);
    } else {
      setIsLookingAtEachOther(false);
    }
  }, [isTyping]);

  // Purple peeking
  useEffect(() => {
    if (passwordValue && passwordValue.length > 0 && showPassword) {
      let t;
      const schedule = () => {
        t = setTimeout(() => { setIsPurplePeeking(true); setTimeout(() => setIsPurplePeeking(false), 800); }, Math.random() * 3000 + 2000);
      };
      schedule();
      return () => clearTimeout(t);
    } else {
      setIsPurplePeeking(false);
    }
  }, [passwordValue, showPassword, isPurplePeeking]);

  const calcPos = (ref) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 3;
    const dx = globalMouse.x - cx, dy = globalMouse.y - cy;
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const pp = calcPos(purpleRef);
  const bp = calcPos(blackRef);
  const yp = calcPos(yellowRef);
  const op = calcPos(orangeRef);

  const isPasswordHidden = (passwordValue && passwordValue.length > 0 && !showPassword);
  const isPasswordVisible = (passwordValue && passwordValue.length > 0 && showPassword);

  const onSubmit = async (data) => {
    const res = await login(data.email, data.password);
    if (res.success) {
      toast.success('Giriş başarılı, yönlendiriliyorsunuz...');
      navigate('/dashboard');
    } else {
      toast.error(res.error || 'Giriş başarısız.');
    }
  };

  const isLoading = isSubmitting || isAuthLoading;

  return (
    <>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

      <div className="min-h-screen grid lg:grid-cols-2">

        {/* ── Left Brand Panel ── */}
        <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden"
          style={{ background: 'linear-gradient(to left, #7ed957 0%, #b6eca0 35%, #e4f7da 65%, #ffffff 100%)' }}>

          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.18]"
            style={{ backgroundImage: 'linear-gradient(rgba(45,110,26,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(45,110,26,0.25) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          {/* Glow circles */}
          <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #7ed957, transparent)' }} />
          <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #b6eca0, transparent)' }} />

          {/* Slogan + Characters — full width centered column */}
          <div className="relative z-20 flex flex-col items-center w-full">
            {/* Logo centered */}
            <img src={EntrioLogoPng} alt="Entrio" className="h-32 w-auto mb-6" style={{ filter: 'none' }} />
            
            {/* Slogan (Responsive Typography applied) */}
            <div className="text-center mb-16 px-6 w-full max-w-2xl">
              <h2 className="text-2xl lg:text-[28px] font-extrabold tracking-tight leading-snug" style={{ color: '#1a4d0a' }}>
                Perakende yönetiminde
                <span className="relative inline-block ml-1.5" style={{ color: '#ffffff', textShadow: '0 0 12px rgba(255,255,255,0.9), 0 0 24px rgba(255,255,255,0.6)' }}>
                  yeni nesil
                  {/* Chalk-style underline */}
                  <svg className="absolute -bottom-1 left-0 w-full h-3" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M2,8 C25,3 75,2 98,6" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />
                  </svg>
                </span> deneyim
              </h2>
              <p className="mt-2 text-sm lg:text-base font-medium" style={{ color: 'rgba(20,60,5,0.7)' }}>
                Satış · Stok · Kasa · Raporlama hepsi tek platformda.
              </p>
            </div>

            {/* Characters Container */}
            <div className="relative z-20 flex items-end justify-center w-full" style={{ height: 380 }}>
              <div className="relative" style={{ width: 480, height: 360 }}>

                {/* Purple tall character */}
                <div ref={purpleRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
                  style={{
                    left: 70, width: 180, height: (isTyping || isPasswordHidden) ? 440 : 400,
                    backgroundColor: '#6C3FF5', borderRadius: '10px 10px 0 0', zIndex: 1,
                    transform: isPasswordVisible ? 'skewX(0deg)' : (isTyping || isPasswordHidden) ? `skewX(${pp.bodySkew - 12}deg) translateX(40px)` : `skewX(${pp.bodySkew}deg)`,
                    transformOrigin: 'bottom center',
                  }}>
                  <div className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                    style={{ left: isPasswordVisible ? 20 : isLookingAtEachOther ? 55 : 45 + pp.faceX, top: isPasswordVisible ? 35 : isLookingAtEachOther ? 65 : 40 + pp.faceY }}>
                    <Eye globalMouse={globalMouse} size={18} pupilSize={7} maxDistance={5} isBlinking={isPurpleBlinking}
                      forceLookX={isPasswordVisible ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined} forceLookY={isPasswordVisible ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
                    <Eye globalMouse={globalMouse} size={18} pupilSize={7} maxDistance={5} isBlinking={isPurpleBlinking}
                      forceLookX={isPasswordVisible ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined} forceLookY={isPasswordVisible ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
                  </div>
                </div>

                {/* Black tall character */}
                <div ref={blackRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
                  style={{
                    left: 240, width: 120, height: 310, backgroundColor: '#2D2D2D', borderRadius: '8px 8px 0 0', zIndex: 2,
                    transform: isPasswordVisible ? 'skewX(0deg)' : isLookingAtEachOther ? `skewX(${bp.bodySkew * 1.5 + 10}deg) translateX(20px)` : (isTyping || isPasswordHidden) ? `skewX(${bp.bodySkew * 1.5}deg)` : `skewX(${bp.bodySkew}deg)`,
                    transformOrigin: 'bottom center',
                  }}>
                  <div className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                    style={{ left: isPasswordVisible ? 10 : isLookingAtEachOther ? 32 : 26 + bp.faceX, top: isPasswordVisible ? 28 : isLookingAtEachOther ? 12 : 32 + bp.faceY }}>
                    <Eye globalMouse={globalMouse} size={16} pupilSize={6} maxDistance={4} isBlinking={isBlackBlinking}
                      forceLookX={isPasswordVisible ? -4 : isLookingAtEachOther ? 0 : undefined} forceLookY={isPasswordVisible ? -4 : isLookingAtEachOther ? -4 : undefined} />
                    <Eye globalMouse={globalMouse} size={16} pupilSize={6} maxDistance={4} isBlinking={isBlackBlinking}
                      forceLookX={isPasswordVisible ? -4 : isLookingAtEachOther ? 0 : undefined} forceLookY={isPasswordVisible ? -4 : isLookingAtEachOther ? -4 : undefined} />
                  </div>
                </div>

                {/* Orange semi-circle character */}
                <div ref={orangeRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
                  style={{
                    left: 0, width: 240, height: 200, backgroundColor: '#FF9B6B', borderRadius: '120px 120px 0 0', zIndex: 3,
                    transform: isPasswordVisible ? 'skewX(0deg)' : `skewX(${op.bodySkew}deg)`, transformOrigin: 'bottom center',
                  }}>
                  <div className="absolute flex gap-8 transition-all duration-200 ease-out"
                    style={{ left: isPasswordVisible ? 50 : 82 + op.faceX, top: isPasswordVisible ? 85 : 90 + op.faceY }}>
                    <Eye globalMouse={globalMouse} showWhite={false} size={12} pupilColor="#2D2D2D" forceLookX={isPasswordVisible ? -5 : undefined} forceLookY={isPasswordVisible ? -4 : undefined} />
                    <Eye globalMouse={globalMouse} showWhite={false} size={12} pupilColor="#2D2D2D" forceLookX={isPasswordVisible ? -5 : undefined} forceLookY={isPasswordVisible ? -4 : undefined} />
                  </div>
                </div>

                {/* Yellow rounded character */}
                <div ref={yellowRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
                  style={{
                    left: 310, width: 140, height: 230, backgroundColor: '#E8D754', borderRadius: '70px 70px 0 0', zIndex: 4,
                    transform: isPasswordVisible ? 'skewX(0deg)' : `skewX(${yp.bodySkew}deg)`, transformOrigin: 'bottom center',
                  }}>
                  <div className="absolute flex gap-6 transition-all duration-200 ease-out"
                    style={{ left: isPasswordVisible ? 20 : 52 + yp.faceX, top: isPasswordVisible ? 35 : 40 + yp.faceY }}>
                    <Eye globalMouse={globalMouse} showWhite={false} size={12} pupilColor="#2D2D2D" forceLookX={isPasswordVisible ? -5 : undefined} forceLookY={isPasswordVisible ? -4 : undefined} />
                    <Eye globalMouse={globalMouse} showWhite={false} size={12} pupilColor="#2D2D2D" forceLookX={isPasswordVisible ? -5 : undefined} forceLookY={isPasswordVisible ? -4 : undefined} />
                  </div>
                  <div className="absolute rounded-full transition-all duration-200 ease-out"
                    style={{ width: 80, height: 4, backgroundColor: '#2D2D2D', left: isPasswordVisible ? 10 : 40 + yp.faceX, top: isPasswordVisible ? 88 : 88 + yp.faceY }} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer links */}
          <div className="relative z-20 flex items-center gap-8 text-sm mt-4" style={{ color: 'rgba(30,80,10,0.5)' }}>
            <span className="cursor-pointer transition-colors hover:opacity-80">Gizlilik Politikası</span>
            <span className="cursor-pointer transition-colors hover:opacity-80">Kullanım Koşulları</span>
            <span>© 2025 Entrio</span>
          </div>
        </div>

        {/* ── Right Form Panel ── */}
        <div className="flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-[420px]">

            {/* Mobile logo */}
            <div className="lg:hidden flex justify-center mb-10">
              <img src={EntrioLogoPng} alt="Entrio" className="h-10 w-auto" />
            </div>

            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Hoş Geldiniz!</h1>
              <p className="text-sm text-slate-500">Devam etmek için bilgilerinizi giriniz.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">E-posta</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input type="email" placeholder="ornek@sirket.com" autoComplete="email"
                    {...register('email', {
                      required: 'E-posta zorunludur.',
                      pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Geçerli bir e-posta giriniz.' }
                    })}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    className={`w-full h-12 pl-11 pr-4 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all border-2 ${errors.email ? 'bg-rose-50 border-rose-400' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-[#7ed957]'}`}
                  />
                </div>
                {errors.email && <p className="text-xs font-medium text-rose-500">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                    {...register('password', { required: 'Şifre zorunludur.' })}
                    className={`w-full h-12 pl-11 pr-12 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all border-2 ${errors.password ? 'bg-rose-50 border-rose-400' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-[#7ed957]'}`}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs font-medium text-rose-500">{errors.password.message}</p>}
              </div>

              {/* Forgot */}
              <div className="flex items-center justify-between">
                <span />
                <button type="button" onClick={() => setShowForgot(true)}
                  className="flex items-center gap-1 text-xs font-semibold transition-colors hover:underline" style={{ color: '#5da83f' }}>
                  Şifremi unuttum <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Submit */}
              <button type="submit" disabled={isLoading}
                className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl text-white text-sm font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg"
                style={{ background: 'linear-gradient(135deg,#7ed957,#5da83f)', boxShadow: '0 4px 20px rgba(126,217,87,0.4)' }}>
                {isLoading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Giriş yapılıyor...</>
                ) : (
                  <><LogIn className="w-4 h-4" />Giriş Yap</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
