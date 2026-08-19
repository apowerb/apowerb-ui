"use client";

import BrandIcon from "@/components/brand/BrandIcon";

// Clé du provider mutualisé. Dupliquée ici plutôt qu'importée de
// ModelSelector : c'est ce dernier qui importe ProviderIcon, l'importer en
// retour créerait un cycle.
const DEFAULT_LLM_PROVIDER = "thaink2";

// ---------------------------------------------------------------------------
// Provider registry: colour + SVG icon for each known LLM provider
// ---------------------------------------------------------------------------

const PROVIDERS = {
  // Modèle fourni par l'exploitant du serveur. La CLÉ reste `thaink2` --
  // elle est appariée avec le backend et ne s'affiche jamais ; seul le
  // libellé se voit, et il ne doit nommer aucune marque : dans une build
  // auto-hébergée, l'exploitant n'est pas thaink2.
  thaink2:   { name: "Default",   color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  anthropic: { name: "Anthropic", color: "#D4A27F", bg: "rgba(212,162,127,0.15)" },
  openai:    { name: "OpenAI",    color: "#10A37F", bg: "rgba(16,163,127,0.15)" },
  mistral:   { name: "Mistral",   color: "#FF7000", bg: "rgba(255,112,0,0.15)" },
  google:    { name: "Google",    color: "#4285F4", bg: "rgba(66,133,244,0.15)" },
  gemini:    { name: "Gemini",   color: "#4285F4", bg: "rgba(66,133,244,0.15)" },
  ovhcloud:  { name: "OVHcloud",  color: "#000E9C", bg: "rgba(0,14,156,0.25)" },
  deepseek:  { name: "DeepSeek",  color: "#4D6BFE", bg: "rgba(77,107,254,0.15)" },
  meta:      { name: "Meta",      color: "#0668E1", bg: "rgba(6,104,225,0.15)" },
  cohere:    { name: "Cohere",    color: "#39594D", bg: "rgba(57,89,77,0.20)" },
  groq:      { name: "Groq",      color: "#F55036", bg: "rgba(245,80,54,0.15)" },
  together:  { name: "Together",  color: "#6366F1", bg: "rgba(99,102,241,0.15)" },
  azure:     { name: "Azure",     color: "#0078D4", bg: "rgba(0,120,212,0.15)" },
  bedrock:   { name: "Bedrock",   color: "#FF9900", bg: "rgba(255,153,0,0.15)" },
};

// ---------------------------------------------------------------------------
// SVG icons – simplified but recognisable brand marks
// ---------------------------------------------------------------------------

function AnthropicSvg({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.83 3.52h3.6L24 20.48h-3.6L13.83 3.52zM6.57 3.52h3.77l6.57 16.96h-3.68l-1.47-3.97H5.51l-1.46 3.97H.48L6.57 3.52zm1.97 5.14L6.3 14.09h4.48L8.54 8.66z" />
    </svg>
  );
}

function OpenAISvg({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.28 9.82a5.99 5.99 0 00-.52-4.91 6.05 6.05 0 00-6.51-2.9A6.07 6.07 0 004.98 4.18a5.99 5.99 0 00-4 2.9 6.05 6.05 0 00.74 7.1 5.98 5.98 0 00.51 4.91 6.05 6.05 0 006.52 2.9A5.99 5.99 0 0013.26 24a6.06 6.06 0 005.77-4.21 5.99 5.99 0 004-2.9 6.06 6.06 0 00-.75-7.07zM13.26 22.43a4.48 4.48 0 01-2.88-1.04l.14-.08 4.78-2.76a.8.8 0 00.39-.68v-6.74l2.02 1.17a.07.07 0 01.04.05v5.58a4.5 4.5 0 01-4.49 4.5zM3.6 18.3a4.47 4.47 0 01-.54-3.01l.14.08 4.78 2.76a.77.77 0 00.78 0l5.84-3.37v2.33a.08.08 0 01-.03.06l-4.84 2.8A4.5 4.5 0 013.6 18.3zM2.34 7.9a4.49 4.49 0 012.37-1.97V11.6a.77.77 0 00.39.68l5.81 3.35-2.02 1.17a.08.08 0 01-.07 0l-4.83-2.79A4.5 4.5 0 012.34 7.9zm16.6 3.86l-5.84-3.39 2.02-1.16a.08.08 0 01.07 0l4.83 2.79a4.49 4.49 0 01-.68 8.1v-5.68a.79.79 0 00-.4-.66zm2.01-3.02l-.14-.09-4.78-2.78a.78.78 0 00-.78 0l-5.84 3.37V6.9a.07.07 0 01.03-.06l4.83-2.79a4.5 4.5 0 016.68 4.66v.03zM8.31 12.86l-2.02-1.16a.08.08 0 01-.04-.06V6.07a4.5 4.5 0 017.38-3.45l-.14.08-4.78 2.76a.8.8 0 00-.39.68l-.01 6.72zm1.1-2.37l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3z" />
    </svg>
  );
}

function MistralSvg({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" />
      <rect x="17" y="1" width="5.5" height="5.5" />
      <rect x="1" y="9.25" width="5.5" height="5.5" />
      <rect x="9.25" y="9.25" width="5.5" height="5.5" />
      <rect x="17" y="9.25" width="5.5" height="5.5" />
      <rect x="1" y="17.5" width="5.5" height="5.5" />
      <rect x="17" y="17.5" width="5.5" height="5.5" />
    </svg>
  );
}

function GoogleSvg({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09a6.97 6.97 0 010-4.18V7.07H2.18A11.97 11.97 0 001 12c0 1.94.46 3.77 1.18 5.42l3.66-2.84.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const SVG_MAP = {
  anthropic: AnthropicSvg,
  openai: OpenAISvg,
  mistral: MistralSvg,
  google: GoogleSvg,
  gemini: GoogleSvg,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract provider key from a "provider/model-name" string. */
export function extractProvider(model) {
  if (!model) return null;
  const slash = model.indexOf("/");
  if (slash <= 0) return null;
  return model.substring(0, slash).toLowerCase();
}

/** Get provider metadata (name, color, bg). Returns null if unknown. */
export function getProviderInfo(key) {
  if (!key) return null;
  return PROVIDERS[key] || null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shows a small coloured icon badge for a given LLM provider.
 *
 * Usage:
 *   <ProviderIcon model="anthropic/claude-sonnet-4-5-20250929" />
 *   <ProviderIcon provider="mistral" showName />
 */
export default function ProviderIcon({
  model,
  provider: providerProp,
  size = 16,
  showName = false,
  className = "",
}) {
  const providerKey = providerProp || extractProvider(model);
  if (!providerKey) return null;

  const info = getProviderInfo(providerKey);
  const color = info?.color || "#94a3b8";
  const bg = info?.bg || "rgba(148,163,184,0.15)";
  const name = info?.name || providerKey;

  const SvgIcon = SVG_MAP[providerKey];

  // Modèle par défaut : on montre le logo de l'application plutôt qu'un
  // monogramme de fournisseur — c'est bien cette instance qui le sert. Rendu
  // sans la pastille colorée des providers tiers : le logo rond porte déjà son
  // propre fond, et `BrandIcon` bascule entre la version blanche (thème sombre)
  // et la version bleue (thème clair).
  if (providerKey === DEFAULT_LLM_PROVIDER) {
    return (
      <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`} title={name}>
        <BrandIcon
          width={size + 6}
          height={size + 6}
          className="rounded-md object-contain"
        />
        {showName && (
          <span className="text-xs font-medium" style={{ color }}>
            {name}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`} title={name}>
      <span
        className="inline-flex items-center justify-center rounded-md"
        style={{ width: size + 6, height: size + 6, backgroundColor: bg, color }}
      >
        {SvgIcon ? (
          <SvgIcon size={size - 2} />
        ) : (
          <span style={{ fontWeight: 700, fontSize: Math.max(9, size - 4), lineHeight: 1 }}>
            {providerKey.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      {showName && (
        <span className="text-xs font-medium" style={{ color }}>
          {name}
        </span>
      )}
    </span>
  );
}

export { PROVIDERS };
