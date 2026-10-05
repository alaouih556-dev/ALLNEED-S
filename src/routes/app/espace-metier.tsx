import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, HeartPulse } from 'lucide-react'

export const Route = createFileRoute('/app/espace-metier')({ component: Metier })

function Metier() {
  const url = (import.meta as ImportMeta & { env: { VITE_HEALTH_URL?: string } }).env.VITE_HEALTH_URL
  return (
    <section className="container-page py-10">
      <div className="health-external-card">
        <div className="health-external-icon"><HeartPulse size={28}/></div>
        <div>
          <span className="eyebrow">ALLNEEDS SANTÃ‰ Â· ESPACE SÃ‰PARÃ‰</span>
          <h1>La gestion SantÃ© vit dans sa propre plateforme.</h1>
          <p>Le portail principal conserve votre parcours ALLNEEDS. Lâ€™espace opÃ©rationnel SantÃ© est maintenant sÃ©parÃ© pour garder une expÃ©rience plus simple et plus claire.</p>
        </div>
        {url ? <a href={url} target="_blank" rel="noreferrer" className="health-external-action">Ouvrir ALLNEEDS SantÃ© <ExternalLink size={16}/></a> : <div className="health-external-action disabled">Lien disponible aprÃ¨s publication</div>}
      </div>
    </section>
  )
}

