import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/politique-de-confidentialite")({
  component: Privacy,
  head: () => ({
    meta: [{ title: "Politique de confidentialité | ALLNEEDS" }],
  }),
});

function Privacy() {
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
        <h1 className="text-section">Politique de confidentialité</h1>
        <div className="mt-8 space-y-6 text-[1.08rem] leading-relaxed text-muted">
          <p>
            ALLNEEDS traite uniquement les informations que vous choisissez de
            transmettre, principalement via le formulaire de demande puis
            WhatsApp.
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">
            Données concernées
          </h2>
          <p>
            Nom, entreprise, téléphone / WhatsApp, email, ville, secteur,
            fonction, besoins sélectionnés et message libre. Ces données servent
            à comprendre votre demande et à poursuivre l'échange.
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">
            Transmission
          </h2>
          <p>
            Le site ne dispose pas, dans cette version, d'un serveur de collecte :
            le message est généré localement puis ouvert dans WhatsApp pour que
            vous en validiez l'envoi. Aucune base de données n'enregistre le
            formulaire côté site.
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">Droits</h2>
          <p>
            Conformément à la réglementation applicable à la protection des
            données au Maroc, vous pouvez demander l'accès, la rectification ou
            la suppression des informations vous concernant en nous contactant
            via les coordonnées qui seront publiées dès qu'elles seront
            confirmées.
          </p>
          <h2 className="font-display text-2xl font-bold text-navy">Cookies</h2>
          <p>
            Le site n'utilise pas de cookies publicitaires. Des cookies techniques
            liés à l'affichage du site peuvent être déposés par l'hébergeur.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
