import { EYANO_LOGO_ALT, EYANO_LOGO_LIGHT_SRC, EYANO_LOGO_SRC } from "../lib/brand";
import { isDarkTheme } from "../modules/theme/theme";
import { useTheme } from "../modules/theme/ThemeProvider";

type EyanoLogoProps = {
  compact?: boolean;
  className?: string;
  /** Conservé pour compatibilité API (charte sur fond clair). */
  onLight?: boolean;
  tone?: "auto" | "onDark";
};

export function EyanoLogo({ compact = false, className = "", tone = "auto" }: EyanoLogoProps) {
  const { themeId } = useTheme();
  const dark = tone === "onDark" || (tone === "auto" && isDarkTheme(themeId));

  return (
    <div className={`flex min-w-0 items-center ${className}`}>
      <img
        src={dark ? EYANO_LOGO_LIGHT_SRC : EYANO_LOGO_SRC}
        alt={EYANO_LOGO_ALT}
        width={compact ? 112 : 280}
        height={compact ? 40 : 72}
        decoding="async"
        className={
          compact
            ? "h-8 w-auto max-w-[8.5rem] shrink-0 object-contain object-left"
            : "h-auto w-full max-w-[13.5rem] shrink-0 object-contain object-left"
        }
      />
    </div>
  );
}