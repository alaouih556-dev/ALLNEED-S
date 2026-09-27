const PRINCIPLES = [
  {
    n: "01",
    title: "Un seul contact",
    text: "Un point d'entrée pour plusieurs besoins professionnels.",
  },
  {
    n: "02",
    title: "Plusieurs besoins",
    text: "Regroupez vos priorités dans une seule démarche.",
  },
  {
    n: "03",
    title: "Un réseau de partenaires",
    text: "Identifiez les acteurs pertinents selon votre situation.",
  },
  {
    n: "04",
    title: "Une démarche simple",
    text: "Présentez votre besoin et poursuivez l'échange simplement.",
  },
];

export function WhyAllNeeds() {
  return (
    <section id="pourquoi-allneeds" className="bg-paper">
      <div className="container-site py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="eyebrow mb-4">Pourquoi ALLNEEDS</p>
            <h2 className="text-section">
              Moins de recherches.
              <br />
              Plus de connexions utiles.
            </h2>
            <p className="mt-6 max-w-xl text-lead text-muted">
              ALLNEEDS simplifie le point de départ, que vous développiez une
              entreprise, que vous la créiez ou que vous souhaitiez vous implanter au
              Maroc. Nous ne remplaçons pas les partenaires : nous vous y emmenons
              avec un besoin mieux cadré.
            </p>
            <p className="mt-8 max-w-md border-l-4 border-electric pl-5 text-xl font-medium leading-snug text-navy">
              Quel que soit mon besoin professionnel, ALLNEEDS est un bon point
              de départ.
            </p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {PRINCIPLES.map((item) => (
              <li key={item.n} className="bg-paper p-6 md:p-8">
                <span className="font-display text-4xl font-bold text-royal/25">
                  {item.n}
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold text-navy">
                  {item.title}
                </h3>
                <p className="mt-3 text-[1.08rem] leading-relaxed text-muted">
                  {item.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
