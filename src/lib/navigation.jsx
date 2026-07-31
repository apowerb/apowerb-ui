"use client";

/**
 * Abstraction de navigation — dernier découplage entre les composants et Next.
 *
 * 46 composants dépendaient, directement ou en cascade, de `next/navigation`,
 * `next/link` ou `next/image`. C'était le dernier obstacle à leur réutilisation
 * hors de l'application.
 *
 * Le contexte transporte des **implémentations de hooks**, pas leurs valeurs.
 * C'est délibéré : `useSearchParams` impose en Next une frontière Suspense, et
 * l'appeler dans un provider racine aurait fait remonter cette contrainte à
 * tout le layout. Ici, le hook de Next reste appelé dans le composant qui en a
 * besoin — exactement là où il l'était déjà.
 *
 * Sans provider, des implémentations navigateur prennent le relais : les
 * composants restent utilisables dans n'importe quelle application React.
 */

import { createContext, useContext } from "react";

const NavigationContext = createContext(null);

function browserPush(href) {
  if (typeof window !== "undefined") window.location.assign(href);
}

function browserReplace(href) {
  if (typeof window !== "undefined") window.location.replace(href);
}

/** Props propres à next/image, à ne pas laisser fuir sur un <img> du DOM. */
const NEXT_IMAGE_PROPS = [
  "fill",
  "priority",
  "quality",
  "sizes",
  "placeholder",
  "blurDataURL",
  "loader",
  "unoptimized",
  "onLoadingComplete",
];

function FallbackImage({ src, alt = "", style, ...rest }) {
  const props = { ...rest };
  const fill = props.fill;
  for (const key of NEXT_IMAGE_PROPS) delete props[key];

  // `fill` en Next = l'image couvre son parent positionné.
  const finalStyle = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }
    : style;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} style={finalStyle} {...props} />;
}

function FallbackLink({ href, children, ...rest }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const browserImplementation = {
  useRouter: () => ({
    push: browserPush,
    replace: browserReplace,
    back: () => typeof window !== "undefined" && window.history.back(),
    forward: () => typeof window !== "undefined" && window.history.forward(),
    refresh: () => typeof window !== "undefined" && window.location.reload(),
    prefetch: () => {},
  }),
  usePathname: () =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  useSearchParams: () =>
    new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ),
  Link: FallbackLink,
  Image: FallbackImage,
};

/**
 * Fournit les implémentations de navigation aux composants descendants.
 *
 * @param {object} props
 * @param {object} props.implementation  Doit exposer `useRouter`,
 *   `usePathname`, `useSearchParams`, `Link` et `Image`. L'objet doit être
 *   stable entre deux rendus (une constante de module, typiquement).
 */
export function NavigationProvider({ implementation, children }) {
  return (
    <NavigationContext.Provider value={implementation ?? browserImplementation}>
      {children}
    </NavigationContext.Provider>
  );
}

function useImplementation() {
  return useContext(NavigationContext) ?? browserImplementation;
}

export function useRouter() {
  return useImplementation().useRouter();
}

export function usePathname() {
  return useImplementation().usePathname();
}

export function useSearchParams() {
  return useImplementation().useSearchParams();
}

export function Link(props) {
  const { Link: Component } = useImplementation();
  return <Component {...props} />;
}

export function Image(props) {
  const { Image: Component } = useImplementation();
  return <Component {...props} />;
}
