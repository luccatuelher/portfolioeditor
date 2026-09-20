/** Bandeiras em SVG (o Windows não renderiza emoji de bandeira). */
export function FlagBR(): React.ReactElement {
  return (
    <svg className="flag" viewBox="0 0 20 14" width="18" height="13" aria-hidden="true">
      <rect width="20" height="14" rx="1.5" fill="#009C3B" />
      <path d="M10 1.8 18.2 7 10 12.2 1.8 7Z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="3.1" fill="#002776" />
      <path d="M7.1 6.3c1.9-.4 4-.1 5.8.9" stroke="#fff" strokeWidth=".6" fill="none" />
    </svg>
  );
}

export function FlagUS(): React.ReactElement {
  const stripes = [0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={(i * 14) / 13} width="20" height={14 / 13} fill="#B22234" />);
  return (
    <svg className="flag" viewBox="0 0 20 14" width="18" height="13" aria-hidden="true">
      <clipPath id="flag-us-clip"><rect width="20" height="14" rx="1.5" /></clipPath>
      <g clipPath="url(#flag-us-clip)">
        <rect width="20" height="14" fill="#fff" />
        {stripes}
        <rect width="8.6" height={(14 / 13) * 7} fill="#3C3B6E" />
      </g>
    </svg>
  );
}

export function LangFlag({ lang }: { lang: 'pt' | 'en' }): React.ReactElement {
  return lang === 'pt' ? <FlagBR /> : <FlagUS />;
}
