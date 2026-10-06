import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'

const transpile = (path) =>
  ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText

const asModule = (code) => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')

const dataUrl = asModule(transpile('src/features/health360/diagnosticData.ts'))
const scoringSource = transpile('src/features/health360/scoring.ts').replace("'./diagnosticData'", `'${dataUrl}'`)
const {
  questionsForFormat,
  buildStats,
  buildConsent,
  needsComment,
  isTouched,
  GRID_VERSION,
} = await import(asModule(scoringSource))

const complet = questionsForFormat('Complet')
const express = questionsForFormat('Express ★')

assert.equal(complet.length, 40, 'format Complet = 40 questions')
assert.ok(express.length > 0 && express.length < 40, 'format Express = sous-ensemble des questions ★')
assert.ok(express.every((q) => q.starred), 'le périmètre Express ne contient que des questions ★')
assert.equal(complet.filter((q) => Number(q.id[0]) === 1 && q.internal).length, 7, 'Complet : 7 internes par volet')
assert.equal(complet.filter((q) => Number(q.id[0]) === 1 && !q.internal).length, 3, 'Complet : 3 externes par volet')

const answered = (questions, score, comment) =>
  Object.fromEntries(questions.map((q) => [q.id, { score, comment, set: true }]))

const base = answered(complet, 4, 'exemple chiffré')
const clean = buildStats('Complet', base)
assert.equal(clean.combined.total, 40)
assert.equal(clean.combined.noted, 40)
assert.equal(clean.combined.index, 80, 'indice = notes ÷ (5 × notés) × 100')
assert.equal(clean.touched, 40)
assert.equal(clean.ready, true, 'toutes les questions traitées et commentées')
assert.deepEqual(clean.missingComments, [])
assert.ok(clean.byVolet.every((v) => v.conclusive), 'aucun volet à 0 → tous conclusifs')
assert.equal(clean.byVolet[0].internal.total, 7)
assert.equal(clean.byVolet[0].external.total, 3)

const withoutComments = answered(complet, 4, '')
const unready = buildStats('Complet', withoutComments)
assert.equal(unready.ready, false, 'une note évaluée sans commentaire bloque la synthèse')
assert.equal(unready.missingComments.length, 40)
assert.equal(needsComment({ score: 4, comment: '' }), true)
assert.equal(needsComment({ score: 0, comment: '' }), false, 'la note 0 reste non évaluée')

const zeroed = { ...base }
zeroed[complet[0].id] = { score: 0, comment: '', set: true }
const afterZero = buildStats('Complet', zeroed)
assert.equal(afterZero.combined.noted, 39, 'le 0 n’est pas une note évaluée')
assert.equal(Math.round(afterZero.combined.index), 80, 'le 0 est exclu de l’indice')
assert.equal(afterZero.combined.zeros, 1)
assert.equal(afterZero.ready, true, 'un 0 explicite ne bloque pas la synthèse')
assert.equal(afterZero.touched, 40)

const volet1Internal = complet.filter((q) => Number(q.id[0]) === 1 && q.internal)
const threeZeros = { ...base }
volet1Internal.slice(0, 3).forEach((q) => {
  threeZeros[q.id] = { score: 0, comment: '', set: true }
})
const nonConclusif = buildStats('Complet', threeZeros)
const volet1 = nonConclusif.byVolet.find((v) => v.id === 1)
assert.equal(volet1.internal.zeros, 3)
assert.equal(volet1.conclusive, false, 'plus de 2 questions internes à 0 → volet non conclusif')
assert.equal(volet1.internal.noted, 4)
assert.equal(volet1.internal.avg, 4, 'moyenne calculée hors 0')
assert.ok(
  nonConclusif.priorities.every((item) => Number(item.q.id[0]) !== 1),
  'un volet non conclusif est exclu du classement des priorités',
)
assert.ok(
  nonConclusif.forces.every((item) => Number(item.q.id[0]) !== 1),
  'un volet non conclusif est exclu des forces',
)
assert.ok(nonConclusif.priorities.length > 0, 'les autres volets restent classés')

const expressBase = answered(express, 3, 'exemple chiffré')
const expressClean = buildStats('Express ★', expressBase)
assert.equal(expressClean.combined.total, express.length, 'Express : total limité aux questions ★')
assert.equal(expressClean.ready, true, 'Express : synthèse ouverte sur le seul périmètre ★')
assert.ok(expressClean.scope.every((q) => q.starred))

const expressInternal1 = express.filter((q) => Number(q.id[0]) === 1 && q.internal)
const expressZeros = { ...expressBase }
expressInternal1.forEach((q) => {
  expressZeros[q.id] = { score: 0, comment: '', set: true }
})
const expressStats = buildStats('Express ★', expressZeros)
const expressVolet = expressStats.byVolet.find((v) => v.id === 1)
assert.equal(
  expressVolet.internal.total,
  expressInternal1.length,
  'Express : couverture et conclusivité calculées sur les seules questions ★ du volet',
)
assert.equal(expressVolet.conclusive, expressInternal1.length <= 2, 'Express : règle des 2 zéros sur le périmètre ★')

const untouched = buildStats('Complet', {})
assert.equal(untouched.ready, false, 'aucune réponse → synthèse fermée')
assert.equal(untouched.combined.noted, 0)
assert.equal(isTouched(undefined), false)
assert.equal(isTouched({ score: 0, comment: '' }), false, 'score 0 sans interaction = non traité')
assert.equal(isTouched({ score: 0, comment: '', set: true }), true, 'score 0 choisi explicitement = traité')

assert.equal(buildConsent(''), null, 'consentement sans identité refusé')
const consent = buildConsent('  Dr Youssef Idrissi  ', '2026-10-06T10:00:00.000Z')
assert.equal(consent.by, 'Dr Youssef Idrissi')
assert.equal(consent.version, GRID_VERSION)
assert.equal(consent.acceptedAt, '2026-10-06T10:00:00.000Z')

console.log(
  `OK — Diagnostic 360 v5.1 : ${complet.length} questions Complet, ${express.length} questions Express, 0 exclu des moyennes, conclusivité par volet, commentaires obligatoires, consentement horodaté.`,
)
