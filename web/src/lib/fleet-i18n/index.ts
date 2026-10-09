import { useSyncExternalStore } from "react";

import { useLocale } from "@/hooks/use-locale";
import { getLocaleSnapshot, subscribeLocale, type Locale } from "@/lib/i18n";
import { interpolate, type TemplateVars } from "@/lib/i18n/template";
import { en, type FleetDictionary, type FleetMessageKey } from "./en";

// HERDR FLEET'S OWN STRINGS, BESIDE COLLIE'S RATHER THAN INSIDE THEM.
//
// Collie translates through one typed dictionary per language (`@/lib/i18n`, ADR 0030). Fleet's
// labels used to be keys in those files, which made every upstream dictionary a fork path and every
// language upstream added a fork obligation. They live here instead, and Collie's dictionaries are
// upstream's text.
//
// What is shared is the LOCALE, never the strings: `ft()` reads the language Collie's store says is
// active, so the operator chooses once, in Collie's own setting. English is in the main chunk and is
// the fallback; each other language is a separate chunk, fetched when that locale is active, exactly
// as Collie fetches its own. A language Collie offers and Fleet does not translate reads English.
//
// `useFleetLocale()` is what a component calling `ft()` subscribes with. It covers Collie's locale
// AND this module's own bundle arriving, which Collie's store cannot see.

export type { FleetMessageKey } from "./en";

/** Every translated language. One row per file beside this one; English is `en` itself. */
const LOADERS = new Map<Locale, () => Promise<FleetDictionary>>([
  ["de", async () => (await import("./de")).de],
  ["es", async () => (await import("./es")).es],
  ["ja", async () => (await import("./ja")).ja],
  ["ko", async () => (await import("./ko")).ko],
  ["zh", async () => (await import("./zh")).zh],
  ["zh-TW", async () => (await import("./zh-TW")).zhTW],
]);

const loaded = new Map<Locale, FleetDictionary>();
const loading = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();
let revision = 0;

async function load(locale: Locale, loader: () => Promise<FleetDictionary>): Promise<void> {
  try {
    loaded.set(locale, await loader());
    revision += 1;
    for (const listener of listeners) listener();
  } catch {
    // English keeps answering, as Collie's own failed chunk leaves English answering.
  } finally {
    loading.delete(locale);
  }
}

function ensureLoaded(locale: Locale): Promise<void> {
  const loader = LOADERS.get(locale);
  if (loader === undefined || loaded.has(locale)) return Promise.resolve();
  const inFlight = loading.get(locale);
  if (inFlight !== undefined) return inFlight;
  const started = load(locale, loader);
  loading.set(locale, started);
  return started;
}

// Follow Collie's choice from the moment this module loads, and on every change after it.
void ensureLoaded(getLocaleSnapshot().locale);
subscribeLocale(() => void ensureLoaded(getLocaleSnapshot().locale));

/** The dictionary for the active locale once it has landed, English otherwise. */
function active(): { dictionary: FleetDictionary; locale: Locale } {
  const locale = getLocaleSnapshot().locale;
  const dictionary = loaded.get(locale);
  return dictionary === undefined ? { dictionary: en, locale: "en" } : { dictionary, locale };
}

/** One Fleet string in the active language, its `{slot}`s filled by Collie's own filler. */
export function ft(key: FleetMessageKey, vars?: TemplateVars): string {
  return interpolate(active().dictionary[key], vars);
}

/** The bases of Fleet's `.one`/`.other` pairs, the only keys `ftn()` accepts. */
type PluralBaseOf<K> = K extends `${infer Base}.one`
  ? `${Base}.other` extends FleetMessageKey
    ? Base
    : never
  : never;
type FleetPluralBase = PluralBaseOf<FleetMessageKey>;

/** A counted Fleet string: the plural category of the language being served, `.other` otherwise. */
export function ftn(base: FleetPluralBase, count: number, vars?: TemplateVars): string {
  const { dictionary, locale } = active();
  const table: Readonly<Record<string, string | undefined>> = dictionary;
  const category = new Intl.PluralRules(locale).select(count);
  const template = table[`${base}.${category}`] ?? table[`${base}.other`];
  // `.other` exists for every base in every dictionary (the type sees to it), so this only fires if
  // that contract is broken.
  if (template === undefined) throw new Error(`ftn: no plural form for ${base}`);
  return interpolate(template, { ...vars, count });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): number {
  return revision;
}

/** Re-render on a locale change, Collie's bundle arriving, or Fleet's own bundle arriving. */
export function useFleetLocale(): void {
  useLocale();
  useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Resolves once the given locale's Fleet bundle has landed or failed. A test seam. */
export function whenFleetLocaleReady(locale: Locale = getLocaleSnapshot().locale): Promise<void> {
  return ensureLoaded(locale);
}
