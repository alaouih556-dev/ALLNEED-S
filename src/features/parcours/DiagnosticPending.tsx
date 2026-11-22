import { Link } from '@tanstack/react-router'
import { ArrowLeft, Hourglass } from 'lucide-react'
import { Button, Card } from '@/components/ui'

/** Secteur ouvert à l'inscription, mais dont le questionnaire n'est pas encore disponible. */
export function DiagnosticPending() {
  return (
    <div className="mx-auto max-w-xl py-8">
      <Card className="p-7 text-center sm:p-9">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Hourglass className="h-6 w-6" /></span>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink-950">Votre questionnaire est en préparation</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          Nous finalisons le diagnostic adapté à votre secteur. Votre Account Manager vous contacte pour préparer votre premier échange.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/app"><Button variant="outline"><ArrowLeft className="h-4 w-4" />Retour à l’accueil</Button></Link>
        </div>
      </Card>
    </div>
  )
}
