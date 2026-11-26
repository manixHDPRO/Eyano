type ProductPhotoProps = {
  url: string | null;
  name: string;
  className?: string;
};

export function ProductPhoto({ url, name, className = "" }: ProductPhotoProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`grid h-full w-full place-items-center bg-gradient-to-br from-white to-[var(--color-eyano-ink)] ${className}`}>
      <span className="flex flex-col items-center gap-2 text-slate-600/70">
        <PackageIcon />
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Sans visuel</span>
      </span>
    </div>
  );
}

function PackageIcon() {
  return (
    <svg className="size-10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 8.5 12 4l7.5 4.5v9L12 22l-7.5-4.5v-9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 4v18M4.5 8.5 12 13l7.5-4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
