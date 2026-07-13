interface DashboardStat {
  label: string;
  value: string;
  icon_name: string;
}

interface DashboardConfig {
  user_name?: string;
  period_label?: string;
  accent_color?: string;
  stats?: DashboardStat[];
}

export function MockupDashboard({ config }: { config: DashboardConfig }) {
  const accent = config.accent_color || '#0f172a';
  const stats = config.stats || [];

  return (
    <div className="w-full relative bg-gray-50">
      <div style={{ width: 393 }}>
        {/* Page container - exact px-4 py-6 space-y-6 */}
        <div className="px-4 py-6 space-y-6">
          {/* Header - exact structure */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <div className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs flex items-center gap-2 font-medium">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
                Ver Minha Vitrine
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Bem-vindo de volta, {config.user_name || 'Usuario'}!
            </p>
          </div>

          {/* Period Filter - exact inline-flex */}
          <div>
            <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-gray-200 bg-white text-sm text-gray-700">
              {config.period_label || 'Ultimos 30 dias'}
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Stats Grid - exact grid gap-4 grid-cols-2 */}
          <div className="grid gap-4 grid-cols-2">
            {stats.slice(0, 4).map((stat, i) => (
              <StatCard key={i} stat={stat} accent={accent} />
            ))}
          </div>

          {/* Chart Card - exact replica */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-6 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Visualizacoes e Leads</h3>
              <p className="text-sm text-gray-500">Ultimos 30 dias</p>
            </div>
            <div className="p-6 pt-2">
              {/* Mini chart SVG - simplified but proportionally correct */}
              <svg className="w-full" viewBox="0 0 340 140" fill="none">
                {/* Grid lines */}
                <line x1="0" y1="28" x2="340" y2="28" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="56" x2="340" y2="56" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="84" x2="340" y2="84" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="112" x2="340" y2="112" stroke="#f1f5f9" strokeWidth="1" />

                {/* Views line (primary) */}
                <polyline
                  points="0,90 40,85 80,70 120,75 160,50 200,40 240,55 280,30 320,25 340,20"
                  stroke={accent}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Leads line (green) */}
                <polyline
                  points="0,110 40,108 80,100 120,105 160,95 200,88 240,92 280,80 320,75 340,70"
                  stroke="#16a34a"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots on views line */}
                <circle cx="80" cy="70" r="3" fill={accent} />
                <circle cx="160" cy="50" r="3" fill={accent} />
                <circle cx="280" cy="30" r="3" fill={accent} />

                {/* Dots on leads line */}
                <circle cx="80" cy="100" r="3" fill="#16a34a" />
                <circle cx="160" cy="95" r="3" fill="#16a34a" />
                <circle cx="280" cy="80" r="3" fill="#16a34a" />

                {/* X-axis labels */}
                <text x="0" y="135" className="text-[9px]" fill="#94a3b8">01</text>
                <text x="65" y="135" className="text-[9px]" fill="#94a3b8">05</text>
                <text x="135" y="135" className="text-[9px]" fill="#94a3b8">10</text>
                <text x="200" y="135" className="text-[9px]" fill="#94a3b8">15</text>
                <text x="270" y="135" className="text-[9px]" fill="#94a3b8">20</text>
                <text x="325" y="135" className="text-[9px]" fill="#94a3b8">25</text>
              </svg>

              {/* Legend - exact from Recharts */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 rounded" style={{ backgroundColor: accent }} />
                  <span className="text-xs text-gray-500">Visualizacoes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 rounded bg-green-600" />
                  <span className="text-xs text-gray-500">Leads</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ stat, accent }: { stat: DashboardStat; accent: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* CardHeader - exact flex flex-row items-center justify-between space-y-0 pb-2 */}
      <div className="flex flex-row items-center justify-between p-6 pb-2">
        <span className="text-sm font-medium text-gray-500">{stat.label}</span>
        <StatIcon name={stat.icon_name} />
      </div>
      {/* CardContent - exact text-2xl font-bold */}
      <div className="px-6 pb-6">
        <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
        <p className="text-xs text-gray-500 mt-0.5">total</p>
      </div>
    </div>
  );
}

function StatIcon({ name }: { name: string }) {
  const cls = "h-4 w-4 text-gray-400";

  switch (name) {
    case 'Package':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
        </svg>
      );
    case 'TrendingUp':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case 'Users':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case 'DollarSign':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      );
    case 'ShoppingBag':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
