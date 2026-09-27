import { useState, type FormEvent } from "react";
import { ArrowUpRight, Building2, Check, Globe, Rocket } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { NeedSelector } from "@/components/NeedSelector";
import { MAX_NEEDS, SERVICE_BY_ID } from "@/data/services";
import {
  PROFILE_COMPANY_FIELD,
  PROFILES,
  profileLabel,
  profileNeedsCountry,
  type ProfileId,
} from "@/data/profiles";
import { useAppStore } from "@/lib/store";
import { buildWhatsAppUrl } from "@/config/whatsapp";

const PROFILE_IDS = ["existing", "creation", "investor"] as const;

const PROFILE_ICONS = {
  building: Building2,
  rocket: Rocket,
  globe: Globe,
} as const;

const schema = z
  .object({
    profile: z.enum(PROFILE_IDS, {
      error: "Sélectionnez votre situation.",
    }),
    name: z.string().trim().min(2, "Indiquez votre nom et prénom."),
    company: z.string().trim(),
    country: z.string().trim(),
    phone: z.string().trim().min(8, "Indiquez un numéro de téléphone / WhatsApp."),
    email: z.string().trim().email("Indiquez une adresse e-mail valide."),
    city: z.string().trim().min(2, "Indiquez votre ville."),
    sector: z.string().trim().min(2, "Indiquez votre secteur d'activité."),
    role: z.string().trim().optional(),
    message: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const companyField = PROFILE_COMPANY_FIELD[data.profile];
    if (companyField.required && data.company.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["company"],
        message: `Indiquez ${companyField.label.toLowerCase()}.`,
      });
    }
    if (profileNeedsCountry(data.profile) && data.country.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["country"],
        message: "Indiquez votre pays d’origine.",
      });
    }
  });

type FieldErrors = Partial<
  Record<keyof z.infer<typeof schema> | "needs", string>
>;

const CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tanger",
  "Fès",
  "Agadir",
  "Settat",
  "Mohammedia",
  "Kénitra",
  "El Jadida",
  "Oujda",
  "Autre",
];

const SECTORS = [
  "Industrie & production",
  "Commerce & distribution",
  "Services aux entreprises",
  "BTP & immobilier",
  "Tourisme & hôtellerie",
  "Transport & logistique",
  "Santé",
  "Éducation & formation",
  "Agriculture & agroalimentaire",
  "Tech & digital",
  "Autre",
];

const STEPS = [
  { n: "01", t: "Votre situation" },
  { n: "02", t: "Vos besoins" },
  { n: "03", t: "Votre demande" },
  { n: "04", t: "WhatsApp" },
];

export function LeadForm() {
  const selectedNeeds = useAppStore((s) => s.selectedNeeds);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const companyField = profile
    ? PROFILE_COMPANY_FIELD[profile]
    : PROFILE_COMPANY_FIELD.existing;
  const showCountry = profileNeedsCountry(profile);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const data = {
      profile: String(fd.get("profile") ?? ""),
      name: String(fd.get("name") ?? ""),
      company: String(fd.get("company") ?? ""),
      country: String(fd.get("country") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      city: String(fd.get("city") ?? ""),
      sector: String(fd.get("sector") ?? ""),
      role: String(fd.get("role") ?? ""),
      message: String(fd.get("message") ?? ""),
    };

    const parsed = schema.safeParse(data);
    const next: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !next[key as keyof FieldErrors]) {
          next[key as keyof FieldErrors] = issue.message;
        }
      }
    }
    if (selectedNeeds.length === 0) {
      next.needs = "Sélectionnez au moins un besoin.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstKey = (Object.keys(next) as (keyof FieldErrors)[])[0];
      const target =
        firstKey === "needs"
          ? form.querySelector<HTMLElement>("[data-need-selector] button")
          : form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
      target?.focus();
      return;
    }

    const payload = parsed.success ? parsed.data : data;
    const url = buildWhatsAppUrl({
      name: payload.name,
      company: payload.company || "Non précisé",
      profile: profileLabel(payload.profile as ProfileId),
      country: showCountry ? payload.country : undefined,
      role: payload.role,
      phone: payload.phone,
      email: payload.email,
      city: payload.city,
      sector: payload.sector,
      message: payload.message,
      needs: selectedNeeds.map((id) => SERVICE_BY_ID[id].formLabel),
    });
    setSubmitting(true);
    window.open(url, "_blank", "noopener,noreferrer");
    setSubmitting(false);
  }

  return (
    <section id="demande" className="bg-paper">
      <div className="border-b border-line bg-ice">
        <div className="container-site py-12 md:py-16">
          <p className="eyebrow mb-4">Dernière étape</p>
          <h2 className="text-section">
            Votre situation.
            <br />
            Vos besoins.
            <br />
            Une seule demande.
          </h2>
          <p className="mt-5 max-w-2xl text-lead text-muted">
            Quelques informations suffisent pour commencer.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              `1 à ${MAX_NEEDS} besoins`,
              "Transmission via WhatsApp",
              "Une démarche centralisée",
            ].map((item) => (
              <li
                key={item}
                className="rounded-md border border-line bg-paper px-4 py-4 font-display text-base font-semibold text-navy"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container-site py-12 md:py-16">
        <div className="grid overflow-hidden rounded-xl border border-line lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="network-dark relative p-8 text-paper md:p-10">
            <div className="pointer-events-none absolute inset-0 diagonal-slash opacity-30" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight text-paper md:text-4xl">
                Parlons de votre projet.
              </h2>
              <p className="mt-4 text-lead text-paper/78">
                Présentez-nous votre situation — entreprise existante, création
                d’entreprise ou implantation au Maroc — et sélectionnez les besoins
                qui concernent votre activité.
              </p>
              <ol className="mt-10">
                {STEPS.map((step, i) => (
                  <li key={step.n} className="relative flex gap-4 pb-8 last:pb-0">
                    {i < STEPS.length - 1 ? (
                      <span
                        aria-hidden
                        className="absolute top-10 bottom-0 left-5 w-px bg-linear-to-b from-cyan to-cyan/10"
                      />
                    ) : null}
                    <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-md border border-cyan/40 bg-navy-deep font-display text-sm font-bold text-cyan">
                      {step.n}
                    </span>
                    <span className="pt-2 font-display text-lg font-semibold">
                      {step.t}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 font-display text-sm tracking-wide text-paper/50 italic">
                Everything you need, right here.
              </p>
            </div>
          </aside>

          <form className="bg-paper p-6 md:p-10" onSubmit={onSubmit} noValidate>
            <fieldset className="mb-8">
              <legend className="mb-3 font-display text-[0.95rem] font-semibold text-navy">
                Votre situation <span className="text-royal">*</span>
                <span className="ml-2 font-sans text-sm font-normal text-muted">
                  Entreprise, création ou implantation
                </span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {PROFILES.map((item) => {
                  const Icon = PROFILE_ICONS[item.icon];
                  const on = profile === item.id;
                  return (
                    <label key={item.id} className="block">
                      <input
                        type="radio"
                        name="profile"
                        value={item.id}
                        checked={on}
                        onChange={() => setProfile(item.id)}
                        className="peer sr-only"
                      />
                      <span
                        className="flex h-full min-h-44 cursor-pointer flex-col rounded-md border border-line bg-paper p-4 transition-all duration-150 peer-checked:border-electric peer-checked:bg-ice peer-checked:shadow-[0_10px_24px_rgba(18,104,232,0.12)] peer-focus-visible:ring-2 peer-focus-visible:ring-electric peer-focus-visible:ring-offset-2"
                      >
                        <span className="flex items-center justify-between">
                          <span
                            aria-hidden
                            className="flex size-10 items-center justify-center rounded-sm bg-ice text-royal"
                          >
                            <Icon className="size-5" strokeWidth={1.7} />
                          </span>
                          <span
                            aria-hidden
                            className={`flex size-7 items-center justify-center rounded-sm border ${
                              on
                                ? "border-transparent cta-gradient text-paper"
                                : "border-line bg-paper"
                            }`}
                          >
                            {on ? (
                              <Check className="size-4" strokeWidth={2.4} />
                            ) : null}
                          </span>
                        </span>
                        <span className="mt-4 block font-display text-base font-bold leading-snug text-navy">
                          {item.optionLabel}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.profile ? (
                <p className="mt-2 text-sm font-semibold text-destructive" role="alert">
                  {errors.profile}
                </p>
              ) : null}
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Nom et prénom"
                name="name"
                required
                error={errors.name}
                autoComplete="name"
              />
              <Field
                label={companyField.label}
                name="company"
                required={companyField.required}
                error={errors.company}
                placeholder={companyField.placeholder}
                autoComplete="organization"
              />
              {showCountry ? (
                <Field
                  label="Pays d’origine"
                  name="country"
                  required
                  error={errors.country}
                  placeholder="Pays d’origine de votre entreprise ou de votre groupe"
                  autoComplete="country-name"
                  className="sm:col-span-2"
                />
              ) : null}
              <Field
                label="Téléphone / WhatsApp"
                name="phone"
                required
                error={errors.phone}
                type="tel"
                autoComplete="tel"
              />
              <Field
                label="Email"
                name="email"
                required
                error={errors.email}
                type="email"
                autoComplete="email"
              />
              <div>
                <Label htmlFor="city">
                  Ville <span className="text-royal">*</span>
                </Label>
                <select
                  id="city"
                  name="city"
                  required
                  defaultValue=""
                  className="h-12 w-full rounded-md border border-line bg-paper px-4 text-base text-ink outline-none hover:border-royal/40 focus:border-electric focus:ring-2 focus:ring-electric/20"
                >
                  <option value="" disabled>
                    Sélectionnez une ville
                  </option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                {errors.city ? (
                  <p className="mt-1 text-sm font-semibold text-destructive">
                    {errors.city}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="sector">
                  Secteur d'activité <span className="text-royal">*</span>
                </Label>
                <select
                  id="sector"
                  name="sector"
                  required
                  defaultValue=""
                  className="h-12 w-full rounded-md border border-line bg-paper px-4 text-base text-ink outline-none hover:border-royal/40 focus:border-electric focus:ring-2 focus:ring-electric/20"
                >
                  <option value="" disabled>
                    Sélectionnez un secteur
                  </option>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                {errors.sector ? (
                  <p className="mt-1 text-sm font-semibold text-destructive">
                    {errors.sector}
                  </p>
                ) : null}
              </div>
              <Field
                label="Fonction / poste"
                name="role"
                error={errors.role}
                className="sm:col-span-2"
                autoComplete="organization-title"
              />
            </div>

            <div className="mt-8">
              <NeedSelector error={errors.needs} />
            </div>

            <div className="mt-8">
              <Label htmlFor="message">Parlez-nous de votre besoin</Label>
              <Textarea
                id="message"
                name="message"
                rows={5}
                placeholder="Décrivez votre situation, votre objectif ou toute information utile pour mieux comprendre votre demande..."
              />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="h-16 px-8 text-lg sm:w-auto"
              >
                Envoyer ma demande sur WhatsApp
                <ArrowUpRight className="size-5" />
              </Button>
              <p className="text-sm text-muted">
                Vous pourrez vérifier et modifier votre message dans WhatsApp
                avant de l'envoyer.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  required,
  error,
  type = "text",
  className,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  type?: string;
  className?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-royal"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
      />
      {error ? (
        <p className="mt-1 text-sm font-semibold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
