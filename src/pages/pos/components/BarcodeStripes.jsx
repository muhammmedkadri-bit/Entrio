import React from 'react';

/**
 * Deterministik görsel barkod çizgileri.
 * Aynı string → her zaman aynı çizgi deseni.
 */
export const BarcodeStripes = ({ value = '', color = '#000000' }) => {
  // Seed from barcode chars
  const seed = Array.from(value).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const totalWidth = 60;
  const svgHeight = 12; // Slightly shorter for pill fit
  const guardHeight = 12;
  const dataHeight = 10;
  const numBars = 30;

  // Deterministik genişlik dizisi; 4 seçenek
  const widths = [0.8, 1.1, 1.6, 2.0];
  const bars = [];
  let x = 1;
  const pseudo = (i) => ((seed * 31 + i * 17 + i * i * 7) % 100) / 100;

  for (let i = 0; i < numBars; i++) {
    const isGuard = i === 0 || i === numBars - 1 || i === Math.floor(numBars / 2);
    const wIdx = Math.floor(pseudo(i) * widths.length);
    const w = isGuard ? 2.2 : widths[wIdx];
    const h = isGuard ? guardHeight : dataHeight;
    const y = isGuard ? 0 : (guardHeight - dataHeight) / 2;

    bars.push({ x: Math.min(x, totalWidth - 2), w, h, y });
    const gap = widths[Math.floor(pseudo(i + 50) * widths.length)];
    x += w + gap;
    if (x >= totalWidth - 2) break;
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${totalWidth} ${svgHeight}`}
        width={totalWidth}
        height={svgHeight}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            fill={color}
          />
        ))}
      </svg>
      <span 
        className="font-mono text-[7px] tracking-[0.15em] mt-0.5 leading-none font-bold"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
};
