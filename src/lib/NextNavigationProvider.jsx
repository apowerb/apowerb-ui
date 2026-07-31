"use client";

/**
 * Branche les implémentations natives de Next sur l'abstraction de navigation.
 *
 * C'est le seul endroit de l'application qui importe `next/navigation`,
 * `next/link` et `next/image` pour le compte des composants. Monté une fois
 * dans le layout racine, il rend le comportement rigoureusement identique à
 * avant — mais les composants, eux, ne connaissent plus Next.
 */

import NextImage from "next/image";
import NextLink from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { NavigationProvider } from "@/lib/navigation";

// Constante de module : la valeur du contexte doit être stable entre deux
// rendus, sinon tous les consommateurs se re-rendent inutilement.
const nextImplementation = {
  useRouter,
  usePathname,
  useSearchParams,
  Link: NextLink,
  Image: NextImage,
};

export function NextNavigationProvider({ children }) {
  return (
    <NavigationProvider implementation={nextImplementation}>
      {children}
    </NavigationProvider>
  );
}
