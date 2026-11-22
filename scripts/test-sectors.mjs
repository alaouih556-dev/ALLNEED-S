// Vérifie la configuration des 7 secteurs : alignement API, traductions, pages et données de l'univers.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { SECTOR_CATALOG } from '../backend/sectors.mjs'
import { SECTORS_CONFIG, SECTOR_SLUGS, getSector, isDiagnosticPending } from '../src/lib/sectors.ts'
import { SECTOR_PAGES, SECTOR_PAGE_TRANSLATIONS } from '../src/data/sector-pages.ts'
import { UNIVERS_COMPANIES } from '../src/data/univers.ts'

const { phrases } = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8'))

assert.equal(SECTORS_CONFIG.length, 7)
assert.deepEqual(SECTOR_CATALOG.map(({ slug, key, label }) => ({ slug, key, label })), SECTORS_CONFIG.map((s) => ({ slug: s.slug, key: s.key, label: s.label.fr })), 'API et frontend doivent déclarer les mêmes secteurs')
assert.equal(getSector('tourisme')?.slug, 'tourisme-hotellerie-restauration')
assert.equal(getSector('enseignement')?.slug, 'enseignement-prive')
assert.equal(getSector('inconnu'), null)
assert.equal(isDiagnosticPending('sante'), false)
assert.equal(isDiagnosticPending('btp-immobilier'), true)

const pairs = []
const collect = (value) => {
  if (!value || typeof value !== 'object') return
  if (typeof value.fr === 'string' && typeof value.en === 'string') { pairs.push([value.fr, value.en]); return }
  for (const item of Object.values(value)) if (typeof item === 'object') collect(item)
}
for (const sector of SECTORS_CONFIG) {
  assert.equal(sector.establishmentTypes.length, 3, sector.slug)
  assert.equal(new Set(sector.establishmentTypes.map((t) => t.value)).size, 3, sector.slug)
  const { icon: _icon, ...text } = sector
  collect(text)
  const page = SECTOR_PAGES[sector.slug]
  assert.ok(page?.headline && page.symptoms.length >= 3 && page.faq.length >= 2, `page ${sector.slug}`)
}
for (const [fr, en] of [...pairs, ...SECTOR_PAGE_TRANSLATIONS]) assert.equal(phrases[fr], en, `traduction manquante : ${fr}`)
for (const page of Object.values(SECTOR_PAGES)) {
  for (const text of [page.subtitle, page.question, page.signal, page.headline, page.tension, page.guardrail, ...page.symptoms, ...page.faq.flatMap((f) => [f.q, f.a])]) {
    assert.ok(phrases[text], `traduction manquante : ${text.slice(0, 60)}`)
  }
}

assert.equal(new Set(UNIVERS_COMPANIES.map((c) => c.id)).size, UNIVERS_COMPANIES.length)
for (const company of UNIVERS_COMPANIES) {
  assert.ok(SECTOR_SLUGS.includes(company.sector), company.id)
  assert.ok(company.description_fr && company.description_en, company.id)
  assert.ok(existsSync(new URL(`../public${company.logo}`, import.meta.url)), `logo manquant : ${company.logo}`)
}

console.log('OK secteurs: 7 secteurs · API alignée · pages · traductions · univers')
