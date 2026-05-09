import React from 'react';
import logo from '../../assets/PsychPlatform.png';

export default function PlatformLogo({ size = 36, className = '', alt = 'PsychPlatform' }) {
  return (
    <img
      src={logo}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className={['shrink-0 rounded-xl object-contain', className].filter(Boolean).join(' ')}
    />
  );
}

