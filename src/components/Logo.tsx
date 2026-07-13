import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { shouldUseLightLogo } from '@/utils/colorUtils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  backgroundColor?: string;
  noLink?: boolean;
}

export default function Logo({ className, size = 'md', showText = true, backgroundColor, noLink }: LogoProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (backgroundColor) return;

    const checkTheme = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [backgroundColor]);

  const useLightVersion = backgroundColor ? shouldUseLightLogo(backgroundColor) : isDark;

  const logoUrl = useLightVersion
    ? '/logos/vitrinelogo-white.png'
    : '/logos/vitrinelogo-black.png';

  // Increased sizes by 20%
  const logoSizes = {
    sm: 'h-10', // Was h-8
    md: 'h-12', // Was h-10
    lg: 'h-14', // Was h-12
  };

  const imgElement = (
    <img
      src={logoUrl}
      alt="VitrineTurbo"
      className={cn(logoSizes[size], 'w-auto')}
      onError={(e) => {
        const fallbackUrl = useLightVersion
          ? 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/vitrinelogo-white.png.png'
          : 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/vitrinelogo-black.png.png';
        e.currentTarget.src = fallbackUrl;
      }}
    />
  );

  if (noLink) {
    return <span className={cn('flex items-center', className)}>{imgElement}</span>;
  }

  return (
    <Link to="/" className={cn('flex items-center', className)}>
      {imgElement}
    </Link>
  );
}