import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SECTOR_PAGES } from '@/data/sector-pages'
import { SECTORS_CONFIG, getSector } from '@/lib/sectors'
import { FaqList, CtaBand, PageHero } from '@/components/marketing'
import { useSelectedSector } from '@/lib/sector-filter'

export const Route = createFileRoute('/_public/faq')({
  component: FaqPage,
  head: () => ({
    meta: [
      { title: 'Questions fréquentes — ALLNEEDS' },
      {
        name: 'description',
        content:
          'Le diagnostic, les secteurs accompagnés, les modalités de travail et la protection des données.',
      },
    ],
  }),
})

const GENERALES = [
  {
    q: 'À qui s’adresse ALLNEEDS ?',
    a: 'Aux dirigeants d’entreprises et d’établissements de nos 7 secteurs qui veulent mieux organiser leurs priorités et décider de la suite à partir de leur quotidien.',
  },
  {
    q: 'Que se passe-t-il pendant le premier échange ?',
    a: 'Nous parlons de votre situation pendant 2h15. Vous repartez avec un état des lieux synthétique, les principaux points à clarifier et trois priorités recommandées.',
  },
  {
    q: 'Le diagnostic m’engage-t-il à acheter une prestation ?',
    a: 'Non. Le diagnostic est offert pendant l’offre de lancement et ne vous oblige pas à poursuivre avec ALLNEEDS.',
  },
  {
    q: 'Comment connaître le prix et le contenu d’un accompagnement ?',
    a: 'Après le diagnostic, les offres complètes sont visibles dans votre espace après connexion. Le périmètre, les livrables, le prix et les limites figurent aussi sur un devis avant votre accord.',
  },
  {
    q: 'ALLNEEDS garantit-elle un résultat chiffré ?',
    a: 'Non. Nous partons des faits observés dans votre établissement. Les opportunités sont évaluées après analyse, sans promesse de résultat avant d’avoir les éléments nécessaires.',
  },
  {
    q: 'Comment protégez-vous les informations sensibles ?',
    a: 'Le diagnostic porte sur votre organisation. Il ne nécessite pas de partager les données nominatives de patients ou d’élèves. Toute utilisation d’image de mineur requiert l’autorisation écrite des représentants légaux.',
  },
]

const RESUME = [
  { n: '01', t: 'Un état des lieux', d: 'Les forces et les points de blocage de votre situation.' },
  { n: '02', t: 'Trois priorités', d: 'Des sujets concrets pour orienter vos décisions.' },
  { n: '03', t: 'Une suite lisible', d: 'Périmètre et prix détaillés dans votre espace après connexion.' },
  { n: '04', t: 'Votre liberté', d: 'Vous choisissez de poursuivre ou non après le diagnostic.' },
]

function slug(group: string) {
  return 'faq-' + group.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function FaqPage() {
  const [query, setQuery] = useState('')
  const selectedSector = useSelectedSector()

  const filtered = useMemo(() => {
    const all = [
      { group: 'Général', items: GENERALES },
      ...(selectedSector ? [getSector(selectedSector)!] : SECTORS_CONFIG).map((sector) => ({ group: sector.label.fr, items: SECTOR_PAGES[sector.slug].faq })),
    ]
    if (!query.trim()) return all
    const q = query.toLowerCase()
    return all
      .map((block) => ({
        group: block.group,
        items: block.items.filter(
          (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
        ),
      }))
      .filter((block) => block.items.length > 0)
  }, [query, selectedSector])

  const searching = query.trim().length > 0

  return (
    <div className="mk">
      <PageHero
        eyebrow="Avant de décider"
        title="Les réponses claires,"
        highlight="avant de vous engager."
        lead="Découvrez ce que le diagnostic apporte, comment nous protégeons vos informations et ce qui se passe après."
      >
        <div className="mk-search" role="search">
          <Search />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une question…"
            aria-label="Rechercher une question"
          />
        </div>
      </PageHero>

      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap mk-faq-layout">
          <nav className="mk-faq-nav" aria-label="Rubriques">
            <p>Rubriques</p>
            {filtered.map((block) => (
              <a key={block.group} href={`#${slug(block.group)}`}>
                {block.group}
                <span>{block.items.length}</span>
              </a>
            ))}
            <Link to="/contact" className="mk-link">
              Poser une question <ArrowRight />
            </Link>
          </nav>

          <div>
            {filtered.length === 0 ? (
              <div className="mk-empty">
                <h2 className="mk-h3">Aucune réponse pour « {query} »</h2>
                <p className="mk-body">Écrivez-nous, nous répondons sous 24 h ouvrées.</p>
                <Link to="/contact" className="mk-btn mk-btn-dark mk-btn-sm" style={{ marginTop: 8 }}>
                  Nous écrire <ArrowRight />
                </Link>
              </div>
            ) : null}

            {filtered.map((block, i) => (
              <div key={block.group} id={slug(block.group)} className="mk-faq-group">
                <h2 className="mk-h3">{block.group}</h2>
                {/* Open the first answer of the first group only; while searching, open the first match of each group. */}
                <FaqList key={`${block.group}-${query}`} items={block.items} defaultOpen={i === 0 || searching ? 0 : null} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec-sm mk-bg-cool">
        <div className="mk-wrap">
          <div className="mk-head">
            <p className="mk-eyebrow">En résumé</p>
            <h2 className="mk-h2">Ce que vous obtenez avant de décider.</h2>
          </div>
          <div className="mk-stats" style={{ marginTop: 40 }}>
            {RESUME.map((item) => (
              <div key={item.t} className="mk-stat">
                <strong>{item.n}</strong>
                <span className="mk-h4">{item.t}</span>
                <p className="mk-small">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Une question sans réponse ici ?"
        description="Parlez-nous de votre quotidien. Nous vous aiderons à voir si le diagnostic ALLNEEDS peut vous être utile."
        secondary={{ label: 'Nous contacter', to: '/contact' }}
      />
    </div>
  )
}
