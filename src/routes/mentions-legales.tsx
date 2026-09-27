import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/mentions-legales")({
  component: MentionsLegales,
  head: () => ({
    meta: [{ title: "Mentions légales | ALLNEEDS" }],
  }),
});

function MentionsLegales() {
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="container-site flex h-16 items-center justify-between">
          <Link to="/">
            <Logo compact />
          </Link>
          <Link to="/" className="font-display text-sm font-semibold text-royal">
            Retour à l'accueil
          </Link>
        </div>
      </header>
      <main className="container-site max-w-3xl py-16">
        <h1 className="text-section">Mentions légales</h1>
        <div className="mt-8 space-y-6 text-[1.08rem] leading-relaxed text-muted">
          <p>
            Le présent site est édité par ALLNEEDS, projet indépendant d'orientation
            des entreprises vers des solutions, partenaires et dispositifs adaptés
            à leurs besoins.
          </p>
          <p>
            Les informations d'identification de l'éditeur (forme juridique, siège,
            capital, RCS, directeur de la publication, hébergeur) seront
            complétées dès qu'elles seront disponibles. Aucune information
            d'immatriculation n'est inventée ici.
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">Objet du site</h2>
          <p>
            Le site présente l'offre d'orientation ALLNEEDS et permet de
            transmettre une demande via WhatsApp. Il ne constitue pas un acte de
            vente d'assurance, un octroi de financement, une décision
            d'éligibilité ni un engagement des partenaires présentés.
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">
            Propriété intellectuelle
          </h2>
          <p>
            Les éléments de marque ALLNEEDS (nom, logo, signature) sont protégés.
            Les logos des partenaires restent la propriété de leurs titulaires et
            sont utilisés uniquement pour les identifier.
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">
            Responsabilité
          </h2>
          <p>
            Les contenus sont fournis à titre informatif. Les dispositifs, offres
            et conditions des partenaires peuvent évoluer. ALLNEEDS ne garantit ni
            l'accès à un financement, ni une souscription d'assurance, ni une
            décision d'un partenaire.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
