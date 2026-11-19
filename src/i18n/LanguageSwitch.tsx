import { cn } from '@/lib/utils'
import { setLang, useLang, type Lang } from './index'

const OPTIONS: { value: Lang; label: string; name: string }[] = [
  { value: 'fr', label: 'FR', name: 'Français' },
  { value: 'en', label: 'EN', name: 'English' },
]

/** Sélecteur FR / EN. Les libellés ne sont jamais traduits (data-no-translate). */
export function LanguageSwitch({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const lang = useLang()
  return (
    <div className={cn('lang-switch', tone === 'dark' && 'lang-switch-dark', className)} role="group" aria-label="Language / Langue" data-no-translate>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          aria-pressed={lang === o.value}
          title={o.name}
          onClick={() => void setLang(o.value)}
          className={cn('lang-switch-btn', lang === o.value && 'is-active')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
