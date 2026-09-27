import type { NeedId } from "@/data/services";
import { useAppStore } from "@/lib/store";

const SITUATIONS: { label: string; needs: NeedId[] }[] = [
  { label: "Je cherche une assurance.", needs: ["assurance"] },
  { label: "Je cherche un fournisseur.", needs: ["fournisseurs"] },
  { label: "Je veux améliorer ma visibilité.", needs: ["digital"] },
  { label: "Je dois recruter.", needs: ["recrutement"] },
  { label: "Je souhaite former mon équipe.", needs: ["formation"] },
  {
    label: "Je cherche un accompagnement pour mon projet.",
    needs: ["financement"],
  },
  {
    label: "Je veux structurer ma prospection.",
    needs: ["commercial"],
  },
  {
    label: "Je dois organiser ma comptabilité.",
    needs: ["comptabilite"],
  },
  {
    label: "Je crée mon entreprise.",
    needs: ["financement", "comptabilite", "fournisseurs", "digital"],
  },
  {
    label: "J'ai plusieurs besoins à la fois.",
    needs: [
      "assurance",
      "fournisseurs",
      "digital",
      "formation",
      "recrutement",
      "financement",
      "commercial",
      "comptabilite",
    ],
  },
];

export function BusinessSituations() {
  const goToForm = useAppStore((s) => s.goToForm);

  return (
    <section className="bg-ice">
      <div className="container-site py-16 md:py-20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow mb-3">Cas concrets</p>
            <h2 className="text-section">Vous vous reconnaissez ?</h2>
          </div>
          <p className="max-w-md text-lead text-muted">
            Cliquez une situation : le besoin correspondant est sélectionné, puis
            vous arrivez au formulaire.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SITUATIONS.map((item, i) => (
            <button
              key={item.label}
              type="button"
              onClick={() => goToForm(item.needs)}
              className="min-h-28 rounded-lg border border-line bg-paper px-5 py-5 text-left transition-all duration-200 hover:border-electric hover:shadow-[0_12px_28px_rgba(18,104,232,0.12)]"
            >
              <span className="font-display text-xs font-bold text-royal">
                0{i + 1}
              </span>
              <span className="mt-2 block font-display text-lg font-semibold leading-snug text-navy">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
