import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui'

export const Route = createFileRoute('/connexion')({
  component: ConnexionPage,
  head: () => ({ meta: [{ title: 'Connexion — ALLNEEDS' }] }),
})

const DEMO_ACCOUNTS = [
  { role: 'Client', email: 'a.bennani@al-amal.ma', target: '/app', label: 'Espace client' },
  { role: 'Admin', email: 'nada@allneeds.ma', target: '/admin', label: 'Dashboard admin' },
] as const

function ConnexionPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('a.bennani@al-amal.ma')
  const [password, setPassword] = useState('demonstration')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Saisissez une adresse e-mail valide.')
      return
    }
    const isAdmin = email.includes('allneeds')
    navigate({ to: isAdmin ? '/admin' : '/app' })
  }

  return (
    <AuthLayout
      title="Connexion à votre espace"
      subtitle="Retrouvez vos besoins, vos prestataires, vos devis et vos livrables."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="font-semibold text-brand-700">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Adresse e-mail" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@etablissement.ma" />
        </Field>

        <Field label="Mot de passe" required>
          <div className="relative">
            <Input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <Checkbox defaultChecked label="Rester connecté" />
          <button type="button" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
            Mot de passe oublié ?
          </button>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Button type="submit" size="lg" fullWidth>
          Se connecter
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-10">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Comptes de démonstration</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            Le mot de passe est ignoré. L’adresse e-mail détermine le rôle : un e-mail en @allneeds.ma ouvre le
            dashboard admin, tout autre ouvre l’espace client.
          </p>
          <div className="mt-4 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email)
                  navigate({ to: account.target })
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-200 px-4 py-2.5 text-left transition hover:border-ink-400 hover:bg-ink-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{account.role}</span>
                  <span className="block text-xs text-ink-500">{account.email}</span>
                </span>
                <span className="text-xs font-semibold text-brand-700">{account.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Select defaultValue="membre">
              <option value="membre">Membre ACCÈS</option>
              <option value="mission">Client en mission</option>
              <option value="nouveau">Nouveau contact</option>
            </Select>
          </div>
        </Card>
      </div>
    </AuthLayout>
  )
}
