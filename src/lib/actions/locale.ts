"use server";

import { setLocale, type Locale } from "@/lib/i18n/locale";

export async function setLocaleAction(locale: Locale): Promise<void> {
  await setLocale(locale);
}
