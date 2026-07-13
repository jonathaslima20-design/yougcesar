import { useState, useEffect } from 'react';

interface OfferCountdownProps {
  dataFim: string;
  corDestaque?: string;
  compact?: boolean;
  onExpired?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function OfferCountdown({ dataFim, corDestaque = '#10b981', compact = false, onExpired }: OfferCountdownProps) {
  const targetDate = new Date(dataFim);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft(targetDate));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const tl = getTimeLeft(targetDate);
      setTimeLeft(tl);

      if (tl.days === 0 && tl.hours === 0 && tl.minutes === 0 && tl.seconds === 0) {
        setExpired(true);
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [dataFim]);

  if (expired) {
    return (
      <div className="text-xs font-medium opacity-70">Oferta expirada</div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: corDestaque }}>
        <span>Termina em</span>
        {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
        <span>{pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <TimeBlock value={timeLeft.days} label="dias" color={corDestaque} />
      <Separator />
      <TimeBlock value={timeLeft.hours} label="hrs" color={corDestaque} />
      <Separator />
      <TimeBlock value={timeLeft.minutes} label="min" color={corDestaque} />
      <Separator />
      <TimeBlock value={timeLeft.seconds} label="seg" color={corDestaque} />
    </div>
  );
}

function TimeBlock({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm"
        style={{ backgroundColor: color }}
      >
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-[10px] mt-0.5 opacity-60 uppercase">{label}</span>
    </div>
  );
}

function Separator() {
  return <span className="text-lg font-bold opacity-30 self-start mt-2">:</span>;
}
