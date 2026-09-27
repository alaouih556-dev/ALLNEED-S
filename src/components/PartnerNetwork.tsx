import { ArrowDown } from "lucide-react";

export function PartnerNetwork() {
  return (
    <div className="mb-12 overflow-hidden rounded-xl border border-line bg-navy-deep text-paper">
      <div className="grid gap-0 md:grid-cols-3">
        <div className="border-b border-paper/10 p-6 md:border-r md:border-b-0">
          <p className="font-display text-xs font-bold tracking-[0.16em] text-cyan uppercase">
            01 — Besoin
          </p>
          <p className="mt-3 font-display text-2xl font-bold">
            Votre besoin métier
          </p>
          <p className="mt-3 text-[1.05rem] text-paper/75">
            Assurance, fournisseurs, digital, formation, recrutement, financement,
            commercial ou comptabilité — un sujet ou plusieurs.
          </p>
        </div>
        <div className="relative border-b border-paper/10 bg-navy p-6 md:border-r md:border-b-0">
          <div className="absolute top-0 right-0 h-16 w-32 rotate-[-32deg] bg-linear-to-r from-transparent to-electric/30" />
          <p className="font-display text-xs font-bold tracking-[0.16em] text-cyan uppercase">
            02 — ALLNEEDS
          </p>
          <p className="mt-3 font-display text-2xl font-bold">
            Le point de connexion
          </p>
          <p className="mt-3 text-[1.05rem] text-paper/75">
            Nous centralisons la demande et identifions les interlocuteurs
            pertinents — sans nous substituer à eux.
          </p>
        </div>
        <div className="p-6">
          <p className="font-display text-xs font-bold tracking-[0.16em] text-cyan uppercase">
            03 — Réseau
          </p>
          <p className="mt-3 font-display text-2xl font-bold">
            Partenaire / solution
          </p>
          <p className="mt-3 text-[1.05rem] text-paper/75">
            Institution, assureur, opérateur, banque, école ou réseau
            professionnel — selon votre situation.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-paper/10 py-3 text-sm font-semibold tracking-wide text-cyan">
        <ArrowDown className="size-4" />
        ALLNEEDS reste au centre. Les logos ne sont pas un annuaire.
      </div>
    </div>
  );
}
