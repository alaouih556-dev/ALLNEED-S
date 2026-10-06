import { useEffect, useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Building2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, UserRoundCog } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { api, isApiError } from '@/lib/api'
import { syncIdentity } from '@/lib/auth-guard'
import { clearSession, writeSession, login } from '@/lib/session'
import type { Role } from '@/lib/permissions'
import { DEMO_CLIENT_PROFILES, useDemo } from '@/store/store'

export const Route = createFileRoute('/connexion')({
  component: ConnexionPage,
  head: () => ({ meta: [{ title: 'Connexion — ALLNEEDS' }] }),
})

const DEMO_ACCOUNTS: {
  userId: string
  title: string
  email: string
  target: '/app' | '/admin' | '/concierge' | '/expert'
  icon: typeof Building2
  desc: string
}[] = [
  { userId: 'usr-amina', title: 'Dirigeante · Enseignement', email: 'a.bennani@al-amal.ma', target: '/app', icon: Building2, desc: 'École Al Amal · voit son établissement uniquement.' },
  { userId: 'usr-youssef', title: 'Dirigeant · Santé', email: 'direction@clinique-nour.ma', target: '/app', icon: Building2, desc: 'Clinique Nour · diagnostic, priorités et décisions.' },
  { userId: 'usr-salma', title: 'Dirigeante · Tourisme', email: 'salma@riad-lumen.ma', target: '/app', icon: Building2, desc: 'Riad Lumen · voit son établissement uniquement.' },
  { userId: 'mgr-nour', title: 'Responsable · Santé', email: 'responsable@clinique-nour.ma', target: '/app', icon: Building2, desc: 'Clinique Nour · missions et tâches de son périmètre.' },
  { userId: 'col-nour', title: 'Collaborateur · Santé', email: 'accueil@clinique-nour.ma', target: '/app', icon: Building2, desc: 'Clinique Nour · exécution seule, sans scores.' },
  { userId: 'conc-001', title: 'Concierge ALLNEEDS', email: 'concierge.sante@allneeds.ma', target: '/concierge', icon: UserRoundCog, desc: 'Portefeuille : écoles et cliniques qui lui sont attribuées.' },
  { userId: 'admin-nada', title: 'Administrateur', email: 'nada@allneeds.ma', target: '/admin', icon: ShieldCheck, desc: 'Control Tower : comptes, affectations et audit.' },
]

const TARGET_BY_ROLE: Record<Role, '/app' | '/admin' | '/concierge' | '/expert' | null> = {
  client: '/app',
  admin: '/admin',
  concierge: '/concierge',
  expert: '/expert',
  commercial: null,
}

function ConnexionPage() {
  const navigate = useNavigate()
  const { dispatch } = useDemo()
  const [email, setEmail] = useState('a.bennani@al-amal.ma')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [demoEnvironment, setDemoEnvironment] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<{ environment?: string | null }>('/api/health')
      .then((data) => {
        if (!cancelled && data?.environment === 'demo') setDemoEnvironment(true)
      })
      .catch(() => {
        /* l'état de démonstration n'est qu'une information complémentaire */
      })
    return () => {
      cancelled = true
    }
  }, [])

  function selectAccount(userId: string, accountEmail: string) {
    setError('')
    setEmail(accountEmail)
    setPassword('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setError('')
    const normalized = email.trim().toLowerCase()
    if (!normalized.includes('@')) {
      setError('Saisissez une adresse e-mail valide.')
      return
    }
    if (!password) {
      setError('Saisissez votre mot de passe.')
      return
    }

    setPending(true)
    try {
      const session = await login(normalized, password)
      writeSession(session)
      syncIdentity(session)

      const profile = DEMO_CLIENT_PROFILES[session.userId as keyof typeof DEMO_CLIENT_PROFILES]
      if (session.role === 'client' && !profile && !session.orgId) {
        clearSession()
        setError('Votre compte est ouvert mais aucun espace d’entreprise n’est encore rattaché. Contactez votre concierge ALLNEEDS.')
        return
      }
      dispatch({ type: 'SWITCH_USER', userId: session.userId })

      const target = TARGET_BY_ROLE[session.role]
      if (!target) {
        setError('Votre espace CRM n’est pas encore disponible dans cette version de l’interface.')
        return
      }
      navigate({ to: target })
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 401) setError('Adresse e-mail ou mot de passe incorrect.')
        else if (err.status === 429) setError(err.message)
        else setError(err.message)
      } else {
        setError('Connexion impossible pour le moment. Réessayez dans un instant.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Connexion à votre espace ALLNEEDS"
      subtitle="L’identité, le rôle et le périmètre sont vérifiés par le serveur : chaque profil n’accède qu’aux entreprises et aux fonctions qui lui sont attribuées."
      footer={<>Pas encore de compte client ? <Link to="/inscription" className="font-semibold text-brand-700">Faire une demande</Link></>}
    >
      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.userId}
            type="button"
            onClick={() => selectAccount(account.userId, account.email)}
            aria-pressed={email.trim().toLowerCase() === account.email}
            className="rounded-xl border border-ink-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm"
          >
            <account.icon className="h-5 w-5 text-brand-700" />
            <p className="mt-3 text-sm font-bold text-ink-950">{account.title}</p>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-500">{account.desc}</p>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Field label="Adresse e-mail" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.ma" autoComplete="username" />
        </Field>
        <Field label="Mot de passe" required>
          <div className="relative">
            <Input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:bg-ink-100" aria-label="Afficher le mot de passe">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-end">
          <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setError('La réinitialisation automatique par e-mail n’est pas encore activée. Demandez une nouvelle à votre concierge ALLNEEDS ou à l’administrateur de votre espace.')}>
            Mot de passe oublié ?
          </button>
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Connexion en cours…</> : <>Se connecter <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>

      <Card className="mt-8 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 text-brand-700" />
          <p className="text-xs leading-relaxed text-ink-500">
            {demoEnvironment
              ? 'Serveur en environnement de démonstration : les comptes listés ci-dessus partagent le mot de passe « demonstration ». Aucune donnée réelle n’y est attendue.'
              : 'Sélectionnez votre compte, puis saisissez votre mot de passe. Votre session est délivrée par le serveur et expire au bout de 7 jours.'}
          </p>
        </div>
      </Card>
    </AuthLayout>
  )
}
