
export default function Footer() {
  return (
    <footer className="font-roboto flex flex-col gap-10 bg-[#F9F7F5] px-6 py-12 md:py-[72px] lg:px-24">
      <div className="flex flex-col gap-8 md:flex-row md:justify-between">
        <div className="flex flex-col gap-11">
          <div className="space-y-6">
            <a
              href="/"
              className="group flex w-fit items-center gap-3 rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2"
              aria-label="Retour à l'accueil Hall-IA"
            >
              <img
                src={'/assets/svg/new-logo-hallia.svg'}
                width={128}
                height={128}
                alt="Logo Hall-IA"
                className="transition-transform group-hover:scale-105"
                loading="lazy"
                style={{ height: 'auto' }}
              />
            </a>

            <p className="max-w-xs leading-relaxed text-gray-600">
              Libérez la performance de votre entreprise grâce à l'IA.
            </p>

            <address className="space-y-4 not-italic">
              {/* Adresse */}
              <div className="flex gap-3 text-gray-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a5565"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M10 12h4" />
                  <path d="M10 8h4" />
                  <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
                  <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
                  <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                </svg>
                <span className="leading-relaxed">
                  14 avenue Barthélémy Thimonnier
                  <br />
                  69300 CALUIRE ET CUIRE
                </span>
              </div>

              {/* Téléphone */}
              <div className="flex gap-3 text-gray-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a5565"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
                </svg>
                <span className="leading-relaxed">
                  <a
                    href="tel:0451088399"
                    className="rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2"
                  >
                    04 51 08 83 99
                  </a>
                </span>
              </div>

              {/* Email */}
              <div className="flex gap-3 text-gray-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a5565"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                </svg>
                <span className="leading-relaxed">
                  <a
                    href="mailto:contact@hallia.ai"
                    className="rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2"
                  >
                    contact@hallia.ai
                  </a>
                </span>
              </div>
            </address>
          </div>
          <nav aria-label="Réseaux sociaux">
            <ul className="flex gap-4">
              <li>
                {/* Facebook */}
                <a
                  href={'https://www.facebook.com/profile.php?id=61581423711697'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex rounded-full bg-white p-4 shadow-sm transition-all hover:scale-105 hover:bg-linear-to-tl hover:from-[#4D4D4D] hover:to-[#4D4D4D]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:from-[#4D4D4D]/40 active:to-[#4D4D4D]/40"
                  aria-label="Suivez-nous sur Facebook - Ouvre dans un nouvel onglet"
                >
                  <svg
                    className="h-4 w-4 [fill:url(#gradient-fb-default)] transition-all duration-200 group-hover:[fill:url(#gradient-fb-hover)] group-active:[fill:url(#gradient-fb-active)] md:h-6 md:w-6"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <defs>
                      <linearGradient id="gradient-fb-default" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-fb-hover" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-fb-active" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="100%" stopColor="#FFFFFF" />
                      </linearGradient>
                    </defs>
                    <path
                      fillRule="evenodd"
                      d="M13.135 6H15V3h-1.865a4.147 4.147 0 0 0-4.142 4.142V9H7v3h2v9.938h3V12h2.021l.592-3H12V6.591A.6.6 0 0 1 12.592 6h.543Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </li>
              <li>
                {/* Instagram */}
                <a
                  href={'https://www.instagram.com/hallia.ai/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex rounded-full bg-white p-4 shadow-sm transition-all hover:scale-105 hover:bg-linear-to-tl hover:from-[#4D4D4D] hover:to-[#4D4D4D]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:from-[#4D4D4D]/40 active:to-[#4D4D4D]/40"
                  aria-label="Suivez-nous sur Instagram - Ouvre dans un nouvel onglet"
                >
                  <svg
                    className="h-4 w-4 [fill:url(#gradient-ig-default)] transition-all duration-200 group-hover:[fill:url(#gradient-ig-hover)] group-active:[fill:url(#gradient-ig-active)] md:h-6 md:w-6"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <defs>
                      <linearGradient id="gradient-ig-default" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-ig-hover" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-ig-active" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="100%" stopColor="#FFFFFF" />
                      </linearGradient>
                    </defs>
                    <path
                      fillRule="evenodd"
                      d="M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Zm5-3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm7.597 2.214a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2h-.01a1 1 0 0 1-1-1ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </li>
              <li>
                {/* Linkedin */}
                <a
                  href={'https://www.linkedin.com/company/hall-ia/posts/?feedView=all'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex rounded-full bg-white p-4 shadow-sm transition-all hover:scale-105 hover:bg-linear-to-tl hover:from-[#4D4D4D] hover:to-[#4D4D4D]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:from-[#4D4D4D]/40 active:to-[#4D4D4D]/40"
                  aria-label="Suivez-nous sur LinkedIn - Ouvre dans un nouvel onglet"
                >
                  <svg
                    className="h-4 w-4 [fill:url(#gradient-li-default)] transition-all duration-200 group-hover:[fill:url(#gradient-li-hover)] group-active:[fill:url(#gradient-li-active)] md:h-6 md:w-6"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <defs>
                      <linearGradient id="gradient-li-default" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-li-hover" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-li-active" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="100%" stopColor="#FFFFFF" />
                      </linearGradient>
                    </defs>
                    <path
                      fillRule="evenodd"
                      d="M12.51 8.796v1.697a3.738 3.738 0 0 1 3.288-1.684c3.455 0 4.202 2.16 4.202 4.97V19.5h-3.2v-5.072c0-1.21-.244-2.766-2.128-2.766-1.827 0-2.139 1.317-2.139 2.676V19.5h-3.19V8.796h3.168ZM7.2 6.106a1.61 1.61 0 0 1-.988 1.483 1.595 1.595 0 0 1-1.743-.348A1.607 1.607 0 0 1 5.6 4.5a1.601 1.601 0 0 1 1.6 1.606Z"
                      clipRule="evenodd"
                    />
                    <path d="M7.2 8.809H4V19.5h3.2V8.809Z" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href={'tel:0451088399'}
                  className="group flex rounded-full bg-white p-4 shadow-sm transition-all hover:scale-105 hover:bg-linear-to-tl hover:from-[#4D4D4D] hover:to-[#4D4D4D]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:from-[#4D4D4D]/40 active:to-[#4D4D4D]/40"
                  aria-label="Appelez-nous au 04 51 08 83 99"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 [fill:url(#gradient-phone-default)] transition-all duration-200 group-hover:[fill:url(#gradient-phone-hover)] group-active:[fill:url(#gradient-phone-active)] md:h-6 md:w-6"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="gradient-phone-default"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-phone-hover" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient
                        id="gradient-phone-active"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="100%" stopColor="#FFFFFF" />
                      </linearGradient>
                    </defs>
                    <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href={'mailto:contact@hallia.ai'}
                  className="group flex rounded-full bg-white p-4 shadow-sm transition-all hover:scale-105 hover:bg-linear-to-tl hover:from-[#4D4D4D] hover:to-[#4D4D4D]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:from-[#4D4D4D]/40 active:to-[#4D4D4D]/40"
                  aria-label="Contactez-nous par email"
                >
                  <svg
                    className="h-4 w-4 transition-all duration-200 group-hover:[stroke:url(#gradient-mail-hover)] group-active:[stroke:url(#gradient-mail-active)] md:h-6 md:w-6"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="url(#gradient-mail)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <defs>
                      <linearGradient id="gradient-mail" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-mail-hover" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F35F4F" />
                        <stop offset="100%" stopColor="#FFAD5A" />
                      </linearGradient>
                      <linearGradient id="gradient-mail-active" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="100%" stopColor="#FFFFFF" />
                      </linearGradient>
                    </defs>
                    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                  </svg>
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="flex gap-[78px]">
          <nav aria-label="Navigation principale">
            <div className="space-y-4">
              <h2 className="font-semibold">L'entreprise</h2>
              <ul className="space-y-2 font-light">
                <li>
                  <a
                    href={'/#etapes'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Étapes
                  </a>
                </li>
                <li>
                  <a
                    href={'/#avantages'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Avantages
                  </a>
                </li>
                <li>
                  <a
                    href={'/#prix'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Prix
                  </a>
                </li>
              </ul>
            </div>
          </nav>
          <nav aria-label="Informations légales">
            <div className="space-y-4">
              <h2 className="font-semibold">Mentions légales</h2>
              <ul className="space-y-2 font-light">
                <li>
                  <a
                    href={'https://hallia.ai/mentions-legales/politique-de-confidentialite'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Politique de confidentialité
                  </a>
                </li>
                <li>
                  <a
                    href={'https://hallia.ai/mentions-legales/politique-de-cookies'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Politique de cookies
                  </a>
                </li>
                <li>
                  <a
                    href={'https://hallia.ai/mentions-legales'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Mention légales
                  </a>
                </li>
                <li>
                  <a
                    href={'https://hallia.ai/mentions-legales/conditions-utilisation'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Conditions d'utilisation
                  </a>
                </li>
                <li>
                  <a
                    href={'https://hallia.ai/mentions-legales/cgv'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Conditions générales de ventes
                  </a>
                </li>
                <li>
                  <a
                    href={'https://hallia.ai/mentions-legales/charte-sous-traitance'}
                    className="rounded underline underline-offset-[6px] transition-colors hover:text-[#FF9A34] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 active:text-[#FFBE7D]"
                  >
                    Charte de sous-traitance
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
      <hr className="border-t border-[#ABA9A6]" aria-hidden="true" />
      <div className="flex items-center justify-between">
        <p className="text-sm">© {new Date().getFullYear()} HALL-IA. Tous droits réservés.</p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="group flex cursor-pointer items-center gap-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A34] focus-visible:ring-offset-2 md:gap-4"
          aria-label="Retour en haut de la page"
        >
          <span className="transition-opacity group-hover:opacity-80">Retour en haut</span>
          <span className="transition-transform group-hover:scale-105" aria-hidden="true">
            <span className="flex rounded-full border bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] p-2 transition-colors group-hover:from-[#4D4D4D]/75 group-hover:to-[#4D4D4D]/75 group-active:from-[#4D4D4D]/20 group-active:to-[#4D4D4D]/20 md:p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-arrow-up-icon lucide-arrow-up h-4 w-4 stroke-white md:h-6 md:w-6"
                aria-hidden="true"
              >
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            </span>
          </span>
        </button>
      </div>
    </footer>
  );
}
