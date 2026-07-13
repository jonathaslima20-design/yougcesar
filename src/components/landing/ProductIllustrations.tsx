type IllustrationProps = {
  className?: string;
};

const baseProps = {
  viewBox: '0 0 200 200',
  xmlns: 'http://www.w3.org/2000/svg',
  preserveAspectRatio: 'xMidYMid meet',
  fill: 'none',
};

export function TshirtIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseProps} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tshirtFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FAFAFA" />
          <stop offset="100%" stopColor="#E9E9EC" />
        </linearGradient>
      </defs>
      <path
        d="M62 52 L82 42 Q100 56 118 42 L138 52 L162 68 L150 90 L130 82 L130 158 Q130 164 124 164 L76 164 Q70 164 70 158 L70 82 L50 90 L38 68 Z"
        fill="url(#tshirtFill)"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M82 42 Q100 56 118 42"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="78" y1="128" x2="122" y2="128" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <line x1="78" y1="136" x2="110" y2="136" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function SneakerIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseProps} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sneakerBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#D4D4D8" />
        </linearGradient>
        <linearGradient id="sneakerToe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FAFAFA" />
          <stop offset="100%" stopColor="#C7C7CC" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="168" rx="72" ry="6" fill="#0A0A0A" opacity="0.12" />
      <path
        d="M22 142 L22 128 Q22 118 34 114 L60 106 Q74 102 82 94 L100 74 Q108 66 118 70 L138 78 Q148 82 150 92 L154 110 L172 118 Q184 124 184 138 L184 144 Z"
        fill="url(#sneakerBody)"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M100 74 Q108 66 118 70 L138 78 Q148 82 150 92 L154 110 L138 110 Q126 110 118 102 L100 82 Q94 78 100 74 Z"
        fill="url(#sneakerToe)"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M70 110 Q82 86 118 80"
        stroke="#0A0A0A"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M60 122 L140 112"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M88 108 L94 94 M98 112 L106 96 M110 114 L120 100"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M22 142 L184 144 L184 152 Q184 160 176 160 L30 160 Q22 160 22 152 Z"
        fill="#0A0A0A"
      />
      <path
        d="M30 160 L176 160"
        stroke="#FAFAFA"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <circle cx="46" cy="134" r="2.5" fill="#0A0A0A" />
      <circle cx="62" cy="128" r="2.5" fill="#0A0A0A" />
      <circle cx="78" cy="122" r="2.5" fill="#0A0A0A" />
      <path
        d="M44 134 Q54 126 64 128 M60 128 Q70 120 80 122 M76 122 Q86 114 96 116"
        stroke="#0A0A0A"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export function BallIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseProps} className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ballFill" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F4F4F5" />
          <stop offset="100%" stopColor="#A1A1AA" />
        </radialGradient>
        <radialGradient id="ballShine" cx="0.3" cy="0.25" r="0.4">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="176" rx="62" ry="6" fill="#0A0A0A" opacity="0.15" />
      <circle cx="100" cy="100" r="72" fill="url(#ballFill)" stroke="#0A0A0A" strokeWidth="2.5" />
      <polygon
        points="100,74 122,88 114,114 86,114 78,88"
        fill="#0A0A0A"
      />
      <polygon
        points="100,74 78,88 62,72 80,54 100,58"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon
        points="100,74 122,88 138,72 120,54 100,58"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon
        points="78,88 86,114 68,128 50,112 62,88"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon
        points="122,88 114,114 132,128 150,112 138,88"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon
        points="86,114 114,114 118,140 100,150 82,140"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M62 72 L44 60 M138 72 L156 60 M50 112 L34 122 M150 112 L166 122 M82 140 L74 160 M118 140 L126 160 M80 54 L74 38 M120 54 L126 38"
        stroke="#0A0A0A"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="100" cy="100" r="72" fill="url(#ballShine)" pointerEvents="none" />
    </svg>
  );
}

export function RacketIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseProps} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="racketFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FAFAFA" />
          <stop offset="100%" stopColor="#E4E4E7" />
        </linearGradient>
      </defs>
      <ellipse
        cx="104"
        cy="78"
        rx="52"
        ry="58"
        fill="url(#racketFill)"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        transform="rotate(-18 104 78)"
      />
      <g transform="rotate(-18 104 78)" opacity="0.55">
        <line x1="64" y1="78" x2="144" y2="78" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="68" y1="62" x2="140" y2="62" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="68" y1="94" x2="140" y2="94" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="72" y1="46" x2="136" y2="46" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="72" y1="110" x2="136" y2="110" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="104" y1="22" x2="104" y2="134" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="88" y1="24" x2="88" y2="132" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="120" y1="24" x2="120" y2="132" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="72" y1="32" x2="72" y2="124" stroke="#0A0A0A" strokeWidth="1.2" />
        <line x1="136" y1="32" x2="136" y2="124" stroke="#0A0A0A" strokeWidth="1.2" />
      </g>
      <rect
        x="128"
        y="118"
        width="14"
        height="56"
        rx="4"
        fill="#0A0A0A"
        transform="rotate(-18 135 146)"
      />
      <rect
        x="126"
        y="160"
        width="18"
        height="22"
        rx="5"
        fill="#0A0A0A"
        transform="rotate(-18 135 171)"
      />
    </svg>
  );
}

export function MouseIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseProps} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mouseFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FAFAFA" />
          <stop offset="100%" stopColor="#D4D4D8" />
        </linearGradient>
      </defs>
      <path
        d="M70 42 Q100 36 130 42 Q152 50 152 86 L152 148 Q152 170 130 174 Q100 178 70 174 Q48 170 48 148 L48 86 Q48 50 70 42 Z"
        fill="url(#mouseFill)"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line x1="100" y1="42" x2="100" y2="96" stroke="#0A0A0A" strokeWidth="2" opacity="0.6" />
      <rect x="94" y="68" width="12" height="22" rx="6" fill="#0A0A0A" />
      <line x1="100" y1="72" x2="100" y2="86" stroke="#FAFAFA" strokeWidth="1.5" opacity="0.6" />
      <path d="M100 36 L100 24" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function CupcakeIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseProps} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cupWrap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4F4F5" />
          <stop offset="100%" stopColor="#D4D4D8" />
        </linearGradient>
        <linearGradient id="cupFrost" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FAFAFA" />
          <stop offset="100%" stopColor="#E4E4E7" />
        </linearGradient>
      </defs>
      <path
        d="M60 110 L76 176 Q78 182 84 182 L116 182 Q122 182 124 176 L140 110 Z"
        fill="url(#cupWrap)"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line x1="78" y1="116" x2="86" y2="178" stroke="#0A0A0A" strokeWidth="1.5" opacity="0.4" />
      <line x1="92" y1="114" x2="96" y2="180" stroke="#0A0A0A" strokeWidth="1.5" opacity="0.4" />
      <line x1="108" y1="114" x2="104" y2="180" stroke="#0A0A0A" strokeWidth="1.5" opacity="0.4" />
      <line x1="122" y1="116" x2="114" y2="178" stroke="#0A0A0A" strokeWidth="1.5" opacity="0.4" />
      <path
        d="M54 110 Q54 90 72 82 Q78 62 100 62 Q122 62 128 82 Q146 90 146 110 Z"
        fill="url(#cupFrost)"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M66 104 Q74 92 86 94 Q92 82 104 86 Q114 78 124 90 Q134 94 138 104"
        stroke="#0A0A0A"
        strokeWidth="1.8"
        fill="none"
        opacity="0.45"
        strokeLinecap="round"
      />
      <circle cx="100" cy="54" r="8" fill="#0A0A0A" />
      <path d="M100 46 Q104 40 110 40" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function FlipFlopIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseProps} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="flipFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FAFAFA" />
          <stop offset="100%" stopColor="#D4D4D8" />
        </linearGradient>
      </defs>
      <ellipse
        cx="100"
        cy="104"
        rx="42"
        ry="72"
        fill="url(#flipFill)"
        stroke="#0A0A0A"
        strokeWidth="2.5"
      />
      <ellipse
        cx="100"
        cy="104"
        rx="34"
        ry="62"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <path
        d="M100 46 Q76 70 84 100 Q90 120 100 128 Q110 120 116 100 Q124 70 100 46 Z"
        fill="#0A0A0A"
      />
      <circle cx="100" cy="48" r="5" fill="#0A0A0A" stroke="#FAFAFA" strokeWidth="1.5" />
    </svg>
  );
}

export const productIllustrations = {
  tshirt: TshirtIllustration,
  sneaker: SneakerIllustration,
  ball: BallIllustration,
  racket: RacketIllustration,
  mouse: MouseIllustration,
  cupcake: CupcakeIllustration,
  flipflop: FlipFlopIllustration,
};
