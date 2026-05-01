import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import entrioLogo from '../../assets/Entriologop.png';

export const PremiumLoader = ({ isOpen }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute inset-0 z-[9999] bg-white flex flex-col items-center justify-center rounded-none"
        >
          <div className="flex flex-col items-center justify-center gap-8 relative">
            {/* Logo Container with Glow */}
            <div className="relative flex items-center justify-center">
              {/* Logo Glow Layer */}
              <motion.div
                animate={{
                  opacity: [0.2, 0.45, 0.2],
                  scale: [0.9, 1.05, 0.9],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute"
                style={{
                  width: '200px',
                  height: '70px',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(130,224,90,0.35) 0%, rgba(130,224,90,0) 70%)',
                  filter: 'blur(12px)',
                }}
              />

              {/* Logo */}
              <motion.img
                src={entrioLogo}
                alt="Entrio"
                className="w-48 relative z-10"
                animate={{
                  opacity: [0.85, 1, 0.85],
                  scale: [0.98, 1, 0.98]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
            </div>

            {/* Spinner Container */}
            <div className="relative flex items-center justify-center">
              {/* Soft, minimal pulsing glow behind the spinner */}
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-20 h-20 rounded-full blur-xl"
                style={{ backgroundColor: 'rgba(130,224,90,0.15)' }}
              />
              
              {/* Infinity Animated Loader */}
              <div className="relative w-[65px] aspect-square z-10">
                <span className="absolute rounded-[50px] animate-loaderAnim shadow-[inset_0_0_0_3px] shadow-[#82e05a]" />
                <span className="absolute rounded-[50px] animate-loaderAnim animation-delay shadow-[inset_0_0_0_3px] shadow-[#82e05a]" />
                <style>{`
                  @keyframes loaderAnim {
                    0% { inset: 0 35px 35px 0; }
                    12.5% { inset: 0 35px 0 0; }
                    25% { inset: 35px 35px 0 0; }
                    37.5% { inset: 35px 0 0 0; }
                    50% { inset: 35px 0 0 35px; }
                    62.5% { inset: 0 0 0 35px; }
                    75% { inset: 0 0 35px 35px; }
                    87.5% { inset: 0 0 35px 0; }
                    100% { inset: 0 35px 35px 0; }
                  }
                  .animate-loaderAnim {
                    animation: loaderAnim 2.5s infinite;
                  }
                  .animation-delay {
                    animation-delay: -1.25s;
                  }
                `}</style>
              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
