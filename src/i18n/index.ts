/*
 * Traduction FR → EN de l'interface.
 *
 * Le français reste la langue source dans les composants. Quand l'anglais est choisi, le texte
 * affiché (nœuds texte + attributs placeholder/title/aria-label/alt) est remplacé à partir du
 * dictionnaire `en.json` ; les originaux sont conservés pour revenir au français sans recharger.
 * Les chaînes non traduites restent en français (en dev : `window.__i18nMissing`).
 */
import { useSyncExternalStore } from 'react'

export type Lang = 'fr' | 'en'
const STORAGE_KEY = 'allneeds-lang'
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE'])

type Dict = { phrases: Record<string, string>; fragments: [string, string][] }

let lang: Lang = readStoredLang()
let dict: Dict | null = null
let loading: Promise<Dict> | null = null
const listeners = new Set<() => void>()
const textState = new WeakMap<Text, { orig: string; applied: string }>()
const attrState = new WeakMap<Element, Map<string, { orig: string; applied: string }>>()
const cache = new Map<string, string | null>()
const missing = new Set<string>()
let observer: MutationObserver | null = null

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'fr') return v
  } catch {
    /* stockage indisponible */
  }
  return 'fr'
}

export function getLang(): Lang {
  return lang
}

export function useLang(): Lang {
  return useSyncExternalStore((cb) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, getLang, getLang)
}

function loadDict(): Promise<Dict> {
  if (dict) return Promise.resolve(dict)
  loading ??= import('./en.json').then((m) => {
    const raw = (m.default ?? m) as { phrases: Record<string, string>; fragments: Record<string, string> }
    dict = {
      phrases: raw.phrases,
      // les fragments les plus longs d'abord pour éviter les remplacements partiels
      fragments: Object.entries(raw.fragments).sort((a, b) => b[0].length - a[0].length),
    }
    return dict
  })
  return loading
}

export async function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* stockage indisponible */
  }
  document.documentElement.lang = next
  if (next === 'en') {
    await loadDict()
    if (lang !== 'en') return
    translateTree(document.documentElement)
    startObserver()
  } else {
    stopObserver()
    restoreTree(document.documentElement)
  }
  listeners.forEach((cb) => cb())
}

/* ------------------------------------------------------------------ */

const LONG_DATES: [string, string][] = [
  ['janvier', 'January'], ['février', 'February'], ['mars', 'March'], ['avril', 'April'], ['juin', 'June'],
  ['juillet', 'July'], ['août', 'August'], ['septembre', 'September'], ['octobre', 'October'], ['novembre', 'November'], ['décembre', 'December'],
  ['lundi', 'Monday'], ['mardi', 'Tuesday'], ['mercredi', 'Wednesday'], ['jeudi', 'Thursday'], ['vendredi', 'Friday'], ['samedi', 'Saturday'], ['dimanche', 'Sunday'],
]
// Abréviations (« 02 oct. ») et « mai » : seulement après un nombre, pour ne pas toucher « sept » ou « mai » ailleurs.
const SHORT_DATES: [string, string][] = [
  ['mai', 'May'], ['janv\\.?', 'Jan'], ['févr\\.?', 'Feb'], ['mars', 'Mar'], ['avr\\.?', 'Apr'], ['juil\\.?', 'Jul'], ['sept\\.?', 'Sep'],
  ['oct\\.?', 'Oct'], ['nov\\.?', 'Nov'], ['déc\\.?', 'Dec'],
]
const DATES: [RegExp, string][] = [
  ...LONG_DATES.map(([fr, en]): [RegExp, string] => [new RegExp(`(?<![\\p{L}])${fr}(?![\\p{L}])`, 'giu'), en]),
  ...SHORT_DATES.map(([fr, en]): [RegExp, string] => [new RegExp(`(?<=\\d\\s?)${fr}(?![\\p{L}])`, 'giu'), en]),
]

/** Cherche une phrase connue, en tolérant une différence de majuscule initiale. */
function lookup(source: string): string | null {
  const phrases = dict!.phrases
  if (source in phrases) return phrases[source]
  const upper = source.charAt(0).toUpperCase() + source.slice(1)
  if (upper !== source && upper in phrases) return phrases[upper].charAt(0).toLowerCase() + phrases[upper].slice(1)
  const lower = source.charAt(0).toLowerCase() + source.slice(1)
  if (lower !== source && lower in phrases) return phrases[lower].charAt(0).toUpperCase() + phrases[lower].slice(1)
  return null
}

/** Formes dynamiques courantes : « 3 terminées », « Comptes actifs : 2 », « 1 sur 8 ». */
function translatePattern(source: string): string | null {
  const part = (s: string) => lookup(s) ?? translatePattern(s)
  let m = source.match(/^([+\-−]?[\d\s.,%]+)\s+(\S.*)$/u)
  if (m) {
    const rest = part(m[2])
    if (rest) return `${m[1]} ${rest}`
  }
  m = source.match(/^[«“"]\s*(.+?)\s*[»”"]$/u)
  if (m) {
    const inner = part(m[1])
    if (inner) return `“${inner}”`
  }
  m = source.match(/^(\d+) sur (\d+)$/u)
  if (m) return `${m[1]} of ${m[2]}`
  m = source.match(/^sur (\d+)(?:\s+(.+))?$/u)
  if (m) return `out of ${m[1]}${m[2] ? ` ${part(m[2]) ?? m[2]}` : ''}`
  m = source.match(/^(.+?)\s?:\s+(.+)$/u)
  if (m) {
    const label = part(m[1])
    const value = part(m[2])
    if (label || value) return `${label ?? m[1]}: ${value ?? m[2]}`
  }
  return null
}

/** Traduit une chaîne (texte normalisé). Renvoie null si rien à traduire. */
export function translate(source: string): string | null {
  if (!dict) return null
  const hit = cache.get(source)
  if (hit !== undefined) return hit
  let out: string | null = lookup(source)
  if (out === null && /\p{L}/u.test(source)) out = translatePattern(source)
  if (out === null && /\p{L}/u.test(source)) {
    let s = source
    for (const [fr, en] of dict.fragments) if (s.includes(fr)) s = s.split(fr).join(en)
    for (const [re, en] of DATES) s = s.replace(re, en)
    if (s !== source) out = s
    else if (import.meta.env.DEV && /[a-zà-ÿ]{3}/i.test(source)) missing.add(source)
  }
  cache.set(source, out)
  return out
}

/** Pour le code qui affiche du texte hors DOM (confirm, document.title…). */
export function t(source: string): string {
  if (lang !== 'en') return source
  return translate(source.replace(/\s+/g, ' ').trim()) ?? source
}

function translateString(value: string): string | null {
  const key = value.replace(/\s+/g, ' ').trim()
  if (!key) return null
  const en = translate(key)
  if (en === null) return null
  const lead = value.match(/^\s*/)![0]
  const trail = value.match(/\s*$/)![0]
  return lead + en + trail
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.hasAttribute('data-no-translate') || (e as HTMLElement).isContentEditable) return true
  }
  return false
}

function translateText(node: Text) {
  const state = textState.get(node)
  const current = node.data
  if (state && current === state.applied) return
  const orig = current
  const en = translateString(orig)
  if (en === null || en === orig) {
    textState.delete(node)
    return
  }
  textState.set(node, { orig, applied: en })
  node.data = en
}

function translateAttrs(el: Element) {
  for (const name of ATTRS) {
    const value = el.getAttribute(name)
    if (value === null) continue
    let states = attrState.get(el)
    const st = states?.get(name)
    if (st && value === st.applied) continue
    const en = translateString(value)
    if (en === null || en === value) {
      states?.delete(name)
      continue
    }
    if (!states) attrState.set(el, (states = new Map()))
    states.set(name, { orig: value, applied: en })
    el.setAttribute(name, en)
  }
  if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button') && el.value) {
    const en = translateString(el.value)
    if (en) el.value = en
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!skipped(root.parentElement)) translateText(root as Text)
    return
  }
  if (!(root instanceof Element) || skipped(root)) return
  translateAttrs(root)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element
        if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-no-translate') || (el as HTMLElement).isContentEditable) return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text)
    else translateAttrs(n as Element)
  }
}

function restoreTree(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let n: Node | null = root; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const st = textState.get(n as Text)
      if (st && (n as Text).data === st.applied) (n as Text).data = st.orig
      textState.delete(n as Text)
    } else {
      const states = attrState.get(n as Element)
      states?.forEach((st, name) => {
        if ((n as Element).getAttribute(name) === st.applied) (n as Element).setAttribute(name, st.orig)
      })
      attrState.delete(n as Element)
    }
  }
}

function startObserver() {
  if (observer) return
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') {
        if (!skipped(r.target.parentElement)) translateText(r.target as Text)
      } else if (r.type === 'attributes') {
        if (!skipped(r.target as Element)) translateAttrs(r.target as Element)
      } else {
        r.addedNodes.forEach((n) => translateTree(n))
      }
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
}

function stopObserver() {
  observer?.disconnect()
  observer = null
}

/** À appeler une fois au démarrage, avant le premier rendu. */
export function initI18n() {
  document.documentElement.lang = lang
  const nativeConfirm = window.confirm.bind(window)
  const nativeAlert = window.alert.bind(window)
  window.confirm = (message?: string) => nativeConfirm(message === undefined ? message : t(String(message)))
  window.alert = (message?: string) => nativeAlert(message === undefined ? message : t(String(message)))
  if (import.meta.env.DEV) (window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = missing
  if (lang !== 'en') return
  // Évite l'affichage furtif du français pendant le chargement du dictionnaire.
  document.documentElement.classList.add('i18n-pending')
  const reveal = () => document.documentElement.classList.remove('i18n-pending')
  const timer = setTimeout(reveal, 1500)
  void loadDict().then(() => {
    translateTree(document.documentElement)
    startObserver()
    clearTimeout(timer)
    requestAnimationFrame(reveal)
  }, reveal)
}
