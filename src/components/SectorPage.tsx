import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, ClipboardList, FileCheck2, Info, LockKeyhole, Timer } from 'lucide-react'
import { LAUNCH_OFFER, PLANS, SECTORS } from '@/data/catalog'
import { money } from '@/lib/format'
import {
  ComparisonTable,
  CtaBand,
  FaqList,
  HighlightGrid,
  LeverGrid,
  MissionTabs,
  OneLiners,
  ReasonCards,
  SectorTabs,
  StepBlocks,
} from '@/components/marketing'
import { Alert, Badge, Button, Card, SectionHeading } from '@/components/ui'
import type { Sector } from '@/types'


const HEALTH_LEVERS = [
  { title: 'Patients & développement', items: ['Capacité maximale de l’agenda et volume de consultations', 'Taux de remplissage et créneaux vides récurrents', 'Rendez-vous non honorés, annulations et rappels', 'Canaux de prise de rendez-vous et délai de réponse', 'Origine des nouveaux patients et suivi', 'Relances, contrôles et retours', 'Potentiel de développement : prestations, horaires, praticiens'] },
  { title: 'Visibilité & confiance', items: ['Fiche Google : revendiquée, complète, avis', 'Site ou page d’information à jour', 'Collecte et traitement des avis, y compris négatifs', 'Informations pratiques : tarifs, préparation, accès, horaires', 'Cohérence signalétique, documents et présence en ligne', 'Canaux de communication respectant les règles de la profession', 'Retours patients sur l’accueil et l’attente'] },
  { title: 'Équipe & organisation', items: ['Répartition praticiens, accueil et assistants', 'Fiches de poste existantes et à jour', 'Gestion des pics d’appels, arrivées et demandes administratives', 'Circulation interne de l’information', 'Protocoles accueil, facturation et absences', 'Rotation, absences ou tensions dans l’équipe', 'Principaux blocages exprimés par le responsable'] },
  { title: 'Charges & équipements', items: ['5 plus grosses charges récurrentes hors salaires', 'Contrats de maintenance : coût et échéances', 'Assurances et dernière mise en concurrence', 'Fournisseurs de consommables et conditions', 'Logiciels : coûts, usages réels et doublons', 'Télécom et internet : contrat, coût et qualité', 'Investissements ou renouvellements prévus à 12 mois'] },
]

function HealthDiagnosticDetail() {
  return (
    <section className="border-b border-ink-100 bg-white py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="Santé · diagnostic STARTER"
          title="Le parcours Santé est construit autour d’un diagnostic de 90 minutes"
          description="Avant toute mission, l’interface Santé doit guider le rendez-vous, structurer les réponses, calculer les scores et faire ressortir trois priorités concrètes."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            [Timer, '0–10 min', 'Cadrage', 'Expliquer le format et ce que le diagnostic ne fait pas.'],
            [ClipboardList, '10–70 min', '4 leviers', '15 minutes par levier, réponses factuelles et score de 1 à 5.'],
            [FileCheck2, '70–80 min', 'Synthèse à chaud', 'Forces, difficultés et opportunités détectées.'],
            [CheckCircle2, '80–90 min', 'Restitution', 'Valider 3 priorités et annoncer le compte-rendu sous 48 h.'],
          ].map(([Icon, time, title, text]) => (
            <Card key={String(title)} className="p-5">
              <Icon className="h-5 w-5 text-brand-700" />
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-700">{String(time)}</p>
              <p className="mt-1 font-semibold text-ink-950">{String(title)}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{String(text)}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {HEALTH_LEVERS.map((lever, index) => (
            <Card key={lever.title} className="p-6">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span><h3 className="font-display text-2xl text-ink-950">{lever.title}</h3></div>
              <ul className="mt-5 space-y-2.5">{lever.items.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-ink-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>
              <div className="mt-5 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">Score du levier : 7 questions × 5 points = 35 points maximum.</div>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <h3 className="font-semibold text-ink-950">Documents à demander avant le rendez-vous</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['Dernières factures télécom et internet', 'Polices RC professionnelle et multirisque', 'Contrats de maintenance du matériel', 'Liste des abonnements logiciels', '2 à 3 factures de consommables', 'Capture de l’agenda de la semaine sans nom de patient'].map((item) => <div key={item} className="flex gap-2 rounded-lg border border-ink-100 p-3 text-xs text-ink-600"><FileCheck2 className="h-4 w-4 shrink-0 text-brand-700" />{item}</div>)}
            </div>
          </Card>
          <Card className="border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-amber-700" /><h3 className="font-semibold text-amber-950">Garde-fous Santé</h3></div>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-900"><li>• Aucun avis médical, clinique ou réglementaire.</li><li>• Aucune donnée nominative de patient : les noms doivent être masqués dans les captures.</li><li>• Aucun résultat chiffré promis avant analyse.</li></ul>
          </Card>
        </div>
      </div>
    </section>
  )
}



const TOURISM_LEVERS = [
  { title: 'Réservations & développement', items: ['Capacité (chambres, couverts) et taux d’occupation par mois', 'Répartition des réservations directes / plateformes et commissions payées sur 12 mois', 'Prix moyen par nuit ou ticket moyen et évolution sur 2 ans', 'Traitement des demandes directes : délai, réponse et relance', 'Suivi et relance des clients fidèles ou récurrents', 'Saisonnalité : mois creux et actions menées', 'Potentiel de développement : offres, packages, séjours, groupes et événements'] },
  { title: 'Image & visibilité', items: ['Positionnement en une phrase et clientèle cible', 'Site : existence, réservation directe possible et version mobile', 'Instagram, Google et autres réseaux : fréquence, visuels et audience', 'Avis Google et plateformes : note, volume et réponses', 'Qualité et date des photos', 'Cohérence entre image en ligne et expérience réelle', 'Partenariats de visibilité : agences, conciergeries et influence'] },
  { title: 'Équipe & exploitation', items: ['Organisation réception, service, entretien et direction : rôles clairs', 'Fiches de poste existantes', 'Procédures d’arrivée, de départ et de gestion des demandes clients', 'Gestion des plannings et des pics saisonniers', 'Rotation du personnel et formation de l’équipe', 'Gestion des réclamations et retours clients', 'Principaux points de blocage exprimés par le gérant'] },
  { title: 'Charges & fournisseurs', items: ['5 plus grosses charges hors salaires', 'Blanchisserie et linge : prestataire, coût et qualité', 'Fournisseurs F&B : nombre, conditions et pertes', 'Énergie, télécom et internet : contrats et coûts', 'Logiciels réservation, channel manager et caisse : coûts, usages et doublons', 'Assurances : RC, multirisque et perte d’exploitation', 'Investissements et renouvellements prévus avant la haute saison'] },
]

function TourismDiagnosticDetail() {
  const recurring = ['Blanchisserie et linge', 'Fournisseurs F&B', 'Énergie', 'Télécom et internet', 'Logiciels et plateformes', 'Assurances', 'Maintenance']
  return (
    <section className="border-b border-ink-100 bg-white py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="Tourisme · diagnostic STARTER"
          title="Le parcours Tourisme est guidé par un diagnostic opérationnel de 90 minutes"
          description="L’interface structure le rendez-vous autour des réservations, de la visibilité, de l’exploitation et des charges, puis fait ressortir trois priorités concrètes sans promettre un niveau de réservation avant analyse."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            [Timer, '0–10 min', 'Cadrage', 'Expliquer le format, le périmètre et ce que le diagnostic ne fait pas.'],
            [ClipboardList, '10–70 min', '4 leviers', '15 minutes par levier, faits observés et score de 1 à 5.'],
            [FileCheck2, '70–80 min', 'Synthèse à chaud', 'Forces, difficultés et opportunités détectées.'],
            [CheckCircle2, '80–90 min', 'Restitution', 'Valider les 3 priorités et annoncer le compte-rendu sous 48 h.'],
          ].map(([Icon, time, title, text]) => (
            <Card key={String(title)} className="p-5">
              <Icon className="h-5 w-5 text-brand-700" />
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-700">{String(time)}</p>
              <p className="mt-1 font-semibold text-ink-950">{String(title)}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{String(text)}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {TOURISM_LEVERS.map((lever, index) => (
            <Card key={lever.title} className="p-6">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span><h3 className="font-display text-2xl text-ink-950">{lever.title}</h3></div>
              <ul className="mt-5 space-y-2.5">{lever.items.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-ink-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>
              <div className="mt-5 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">Score du levier : 7 questions × 5 points = 35 points maximum.</div>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <h3 className="font-semibold text-ink-950">Documents à demander avant le rendez-vous</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['Dernières factures télécom, internet et énergie', 'Polices d’assurance', 'Contrats de blanchisserie et de fournisseurs', 'Abonnements logiciels et plateformes + commissions sur 12 mois', 'Taux d’occupation mensuel des 12 derniers mois', 'Liens du site et des pages en ligne'].map((item) => <div key={item} className="flex gap-2 rounded-lg border border-ink-100 p-3 text-xs text-ink-600"><FileCheck2 className="h-4 w-4 shrink-0 text-brand-700" />{item}</div>)}
            </div>
          </Card>
          <Card className="border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-amber-700" /><h3 className="font-semibold text-amber-950">Garde-fous Tourisme</h3></div>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-900"><li>• Ne demander aucune donnée confidentielle de clients ou d’invités.</li><li>• Ne pas se prononcer sur le classement ou la conformité réglementaire de l’établissement.</li><li>• Ne promettre aucun niveau de réservations avant analyse.</li></ul>
          </Card>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <h3 className="font-semibold text-ink-950">Charges récurrentes à relever</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">Chaque échéance de renouvellement peut devenir un besoin à traiter dans ALLNEEDS Accès.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{recurring.map(item => <div key={item} className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-ink-700">{item}</div>)}</div>
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold text-ink-950">Sortie du diagnostic</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['3 forces', '3 difficultés prioritaires', '3 opportunités détectées', '3 priorités recommandées', 'Besoins détectés pour ALLNEEDS Accès', 'Décisions et suites convenues'].map(item => <div key={item} className="flex items-start gap-2 rounded-lg border border-ink-100 p-3 text-xs text-ink-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</div>)}
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}

export function SectorPage({ sector }: { sector: Sector }) {
  const content = SECTORS[sector]
  const plans = PLANS[sector]

  return (
    <>
      <section className="border-b border-ink-100 bg-ink-50">
        <div className="container-page py-12">
          <div className="mb-8">
            <SectorTabs active={sector} />
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="eyebrow">{content.name}</p>
              <h1 className="display-1 mt-4">{content.tagline}</h1>
              <p className="lede mt-5 max-w-xl">{content.promise}</p>
              <p className="mt-4 text-sm font-medium text-ink-500">Pour qui : {content.audience}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/diagnostic">
                  <Button size="lg">
                    Diagnostic STARTER offert
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/missions" search={{ secteur: sector }}>
                  <Button size="lg" variant="outline">
                    Comparer les formules
                  </Button>
                </Link>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-ink-100">
                {plans.map((plan) => (
                  <div key={plan.code} className="flex items-start gap-4 px-6 py-5">
                    <span className="mt-0.5 font-display text-2xl text-sand-400">{plan.step}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink-950">{plan.name}</p>
                        <Badge tone="brand">{plan.verb}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">{plan.delay}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-xl text-ink-950">
                        {plan.priceLaunch === null ? 'Offert' : money(plan.priceLaunch)}
                      </p>
                      <p className="text-[0.65rem] text-ink-400">
                        {plan.priceLaunch === null ? plan.payment : `${plan.payment} · HT`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {sector === 'sante' ? <HealthDiagnosticDetail /> : null}
      {sector === 'tourisme' ? <TourismDiagnosticDetail /> : null}

      <section className="container-page py-20">
        <SectionHeading eyebrow="Comment ça marche" title="Comprendre · Structurer · Agir" />
        <div className="mt-14">
          <StepBlocks steps={content.steps} />
        </div>
        <div className="mt-12">
          <MissionTabs />
        </div>
      </section>

      <section className="border-y border-ink-100 bg-ink-50 py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Les leviers" title={`Les ${content.levers.length} leviers que nous travaillons`} />
          <div className="mt-14">
            <LeverGrid levers={content.levers} />
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <SectionHeading eyebrow="Pourquoi ALLNEEDS" title="Votre établissement d’abord" align="center" />
        <div className="mt-14">
          <ReasonCards reasons={content.reasons} />
        </div>
        <div className="mt-16">
          <HighlightGrid items={content.highlights} />
        </div>
      </section>

      <section className="container-page pb-20">
        <SectionHeading
          eyebrow="Formules"
          title="Trois formules, un périmètre écrit"
          description={`Offre de lancement jusqu’au ${LAUNCH_OFFER.deadline} ${LAUNCH_OFFER.condition}.`}
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.code} className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">{plan.step}</p>
                <Badge tone="brand">{plan.verb}</Badge>
              </div>
              <h3 className="mt-3 font-display text-2xl tracking-tight text-ink-950">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="font-display text-3xl leading-none tracking-tight text-ink-950">
                  {plan.priceLaunch === null ? 'Offert' : money(plan.priceLaunch)}
                </p>
                {plan.priceLaunch !== null ? (
                  <span className="text-xs text-ink-400 line-through">{money(plan.priceNormal)}</span>
                ) : null}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-600">{plan.tagline}</p>
              <ul className="mt-5 space-y-2">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                to="/missions/$code"
                params={{ code: plan.code.toLowerCase() }}
                search={{ secteur: sector }}
                className="mt-6"
              >
                <Button size="sm" fullWidth variant={plan.code === 'PRO' ? 'primary' : 'outline'}>
                  Voir la fiche {plan.name}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-ink-100 bg-ink-50 py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Comparatif" title="Formule par formule, ligne par ligne" />
          <div className="mt-12">
            <ComparisonTable rows={content.comparison} />
          </div>
        </div>
      </section>

      {content.awarenessNote ? (
        <section className="container-page py-16">
          <Alert tone="warning" title="À savoir" icon={<Info className="h-4 w-4" />}>
            {content.awarenessNote}
          </Alert>
        </section>
      ) : null}

      {content.extraNotes.length > 0 ? (
        <section className="container-page pb-16">
          <div className="grid gap-5 md:grid-cols-3">
            {content.extraNotes.map((note) => (
              <Card key={note.title} className="p-5">
                <p className="text-sm font-semibold text-ink-950">{note.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{note.detail}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container-page py-20">
        <SectionHeading eyebrow="La différence" title="Une phrase par formule" align="center" />
        <div className="mt-14">
          <OneLiners
            lines={content.oneLiner}
            links={{ STARTER: 'Voir STARTER', PRO: 'Voir PRO', PERFORMANCE: 'Voir PERFORMANCE' }}
          />
        </div>
      </section>

      <section className="container-page pb-20">
        <SectionHeading eyebrow="FAQ" title={`Questions fréquentes ${sector === 'enseignement' ? 'ENSEIGNEMENT' : sector === 'sante' ? 'SANTÉ' : 'TOURISME'}`} />
        <div className="mt-12">
          <FaqList items={content.faq} />
        </div>
      </section>

      <CtaBand
        title="Commencez par le diagnostic OFFERT"
        description="1h30 pour identifier vos 3 priorités, sans engagement. Vous repartez avec un livrable écrit, même si vous ne travaillez pas avec nous ensuite."
      />
    </>
  )
}
