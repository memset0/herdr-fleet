import { act, render, screen } from "@testing-library/react";

import { __resetLocale, setLocale, whenLocaleReady } from "@/lib/i18n";
import { en as collieEn } from "@/lib/i18n/messages/en";
import { ft, ftn, useFleetLocale, whenFleetLocaleReady } from "./index";
import { de } from "./de";
import { en, type FleetDictionary } from "./en";
import { es } from "./es";
import { ja } from "./ja";
import { ko } from "./ko";
import { zh } from "./zh";
import { zhTW } from "./zh-TW";

const TRANSLATED = new Map<string, FleetDictionary>([
  ["de", de],
  ["es", es],
  ["ja", ja],
  ["ko", ko],
  ["zh", zh],
  ["zh-TW", zhTW],
]);

// Fleet's strings follow Collie's locale without living in Collie's dictionaries. Pinned here: the
// split itself, English while a bundle is on its way, a language Fleet does not translate, plurals
// read in the served language, and a component repainting when Fleet's own bundle lands.

beforeEach(() => {
  localStorage.clear();
  __resetLocale();
});

const slots = (value: string) => [...value.matchAll(/\{(\w+)\}/gu)].map((m) => m[1]).toSorted();

describe("the split", () => {
  it("adds no key to Collie's dictionary", () => {
    for (const key of Object.keys(en)) expect(Object.hasOwn(collieEn, key), key).toBe(false);
  });

  it.each([...TRANSLATED.keys()])("%s carries English's keys and English's slots on every key", (code) => {
    const table: Readonly<Record<string, string>> = TRANSLATED.get(code)!;
    expect(Object.keys(table).toSorted()).toEqual(Object.keys(en).toSorted());
    for (const [key, value] of Object.entries(en)) expect(slots(table[key] ?? ""), key).toEqual(slots(value));
  });
});

describe("ft", () => {
  it("serves English and fills slots with Collie's filler", () => {
    expect(ft("settings.display.resize.success", { cols: 120, rows: 40 })).toBe("Resized to 120 columns × 40 rows.");
  });

  it("follows Collie's locale once Fleet's bundle has landed", async () => {
    setLocale("de");
    await whenLocaleReady("de");
    await whenFleetLocaleReady("de");
    expect(ft("fleet.tags.loading")).not.toBe(en["fleet.tags.loading"]);
  });

  it("reads English for a language Fleet does not translate", async () => {
    setLocale("ru");
    await whenLocaleReady("ru");
    await whenFleetLocaleReady("ru");
    expect(ft("fleet.tags.loading")).toBe(en["fleet.tags.loading"]);
  });

  it("picks the plural form by count", () => {
    expect(ftn("fleet.navigation.markAllSeenLabel", 1)).toBe(
      en["fleet.navigation.markAllSeenLabel.one"].replace("{count}", "1"),
    );
    expect(ftn("fleet.navigation.markAllSeenLabel", 3)).toBe(
      en["fleet.navigation.markAllSeenLabel.other"].replace("{count}", "3"),
    );
  });
});

describe("useFleetLocale", () => {
  function Label() {
    useFleetLocale();
    return <span>{ft("fleet.tags.loading")}</span>;
  }

  it("repaints when Fleet's own bundle lands after Collie's", async () => {
    render(<Label />);
    expect(screen.getByText(en["fleet.tags.loading"])).toBeInTheDocument();
    await act(async () => {
      setLocale("ja");
      await whenLocaleReady("ja");
      await whenFleetLocaleReady("ja");
    });
    expect(screen.queryByText(en["fleet.tags.loading"])).toBeNull();
  });
});
