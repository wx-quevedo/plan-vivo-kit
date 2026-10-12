import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import es from './es.json'
import en from './en.json'
import type { PlanIssue } from '../plan/schema'

export type Lang = 'es' | 'en'
export type Vars = Record<string, string | number>
export type Translate = (key: string, vars?: Vars) => string

const dictionaries: Record<Lang, unknown> = { es, en }
const STORAGE_KEY = 'plan-vivo.lang'

function lookup(dict: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part]
    return undefined
  }, dict)
  return typeof value === 'string' ? value : undefined
}

// Traductor puro: busca la clave en el idioma pedido, luego en español, y como último recurso devuelve la clave.
export function makeT(lang: Lang): Translate {
  return (key, vars) => {
    const template = lookup(dictionaries[lang], key) ?? lookup(dictionaries.es, key) ?? key
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (vars && name in vars ? String(vars[name]) : match))
  }
}

export function formatIssue(issue: PlanIssue, t: Translate): string {
  return t(`error.${issue.kind}`, {
    path: issue.path || t('error.root'),
    where: issue.where ? t('error.where', { where: issue.where }) : '',
    received: issue.received ?? '',
    allowed: (issue.allowed ?? []).join(', '),
    keys: (issue.keys ?? []).join(', '),
  })
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
}

const I18nContext = createContext<I18nValue | null>(null)

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // Sin acceso a localStorage: se usa el idioma por defecto.
  }
  return 'es'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: makeT(lang),
      setLang: (next) => {
        setLangState(next)
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // Preferencia no guardada; no afecta al visor.
        }
      },
    }),
    [lang],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n requiere I18nProvider')
  return value
}
