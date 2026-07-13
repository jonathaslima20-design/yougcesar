interface CustomConfig {
  image_url?: string;
}

export function MockupCustom({ config }: { config: CustomConfig }) {
  return (
    <div className="w-full h-full bg-slate-100">
      {config.image_url ? (
        <img src={config.image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <svg className="w-6 h-6 mx-auto text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p className="text-[6px] text-gray-400 mt-1">Imagem nao configurada</p>
          </div>
        </div>
      )}
    </div>
  );
}
