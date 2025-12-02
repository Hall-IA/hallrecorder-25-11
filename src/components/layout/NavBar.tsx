import { cn } from '@/lib/utils';
import { ChevronDown, Menu, X } from 'lucide-react';
import { ComponentPropsWithoutRef, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ButtonLinkProps = {
  text: string;
  asChevron?: boolean;
  asDropdown?: boolean;
  isOpen?: boolean;
  className?: string;
  href?: string;
  onClick?: () => void;
} & ComponentPropsWithoutRef<'a'>;

function ButtonLink({
  text,
  href,
  className,
  asChevron,
  asDropdown,
  isOpen,
  onClick,
  ...props
}: ButtonLinkProps) {
  if (!asDropdown) {
    // Link normal
    const handleClick = () => {
      // Si c'est une ancre de navigation (commence par #), s'assurer qu'on reste sur la landing page
      if (href?.startsWith('#')) {
        // Laisser le navigateur gérer le scroll normalement
        if (onClick) {
          onClick();
        }
        return; // Ne pas empêcher le comportement par défaut
      }
      if (onClick) {
        onClick();
      }
    };

    return (
      <a
        href={href!}
        className={cn('group flex items-center gap-0.5 px-3 py-2', className)}
        onClick={handleClick}
        {...props}
      >
        <img
          src="/assets/svg/petal.svg"
          width={19}
          height={16}
          alt=""
          style={{ height: 'auto' }}
          className={cn(
            'translate-x-[-6px] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100',
            isOpen && 'translate-x-0 opacity-100',
          )}
        />
        <span
          className={cn(
            'bg-clip-text font-semibold text-white transition-all duration-300 group-hover:scale-105',
            isOpen && 'bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] text-transparent',
          )}
        >
          {text}
        </span>
        {asChevron && (
          <span className="-mr-3">
            <ChevronDown
              size={16}
              className={cn(
                'transition-transform duration-300 group-hover:rotate-180 group-hover:stroke-orange-400',
                isOpen && 'rotate-180 stroke-orange-400',
              )}
            />
          </span>
        )}
      </a>
    );
  } else {
    // Dropdown → button cliquable mais pas de navigation
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn('group flex cursor-pointer items-center gap-0.5 px-3 py-2', className)}
      >
        <img
          src="/assets/svg/petal.svg"
          width={19}
          height={16}
          alt=""
          style={{ height: 'auto' }}
          className={cn(
            'translate-x-[-6px] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100',
            isOpen && 'translate-x-0 opacity-100',
          )}
        />
        <span
          className={cn(
            'bg-clip-text font-semibold text-white transition-all duration-300 group-hover:scale-105',
          )}
        >
          {text}
        </span>
        {asChevron && (
          <span className="-mr-3">
            <ChevronDown
              size={16}
              className={cn(
                'transition-transform duration-300 group-hover:rotate-180',
                isOpen && 'rotate-180',
              )}
            />
          </span>
        )}
      </button>
    );
  }
}

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Vérifier l'état de l'utilisateur
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    checkUser();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsOpen(false);
    setIsUserMenuOpen(false);
    window.location.href = '/';
  };


  const getInitial = () => {
    if (!user?.email) return '?';
    return user.email.charAt(0).toUpperCase();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      <nav
        className={cn(
          'fixed inset-x-4 z-50 mx-auto mt-4 max-w-7xl rounded-2xl bg-transparent text-white shadow-lg backdrop-blur-md transition-all duration-300',
          isOpen ? 'border border-[#656462] bg-gray-800/60' : 'bg-gray-800/40',
        )}
      >
        {/* Top bar */}
        <div className="grid grid-cols-3 items-center p-3 md:flex md:justify-between">
          {/* Left - Menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-fit rounded-md bg-[#333231]/70 p-2 transition-colors hover:bg-[#333231]/70 md:hidden"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Center - Logo */}
          <a
            href="/"
            className="flex items-center justify-center transition-transform hover:scale-105 md:justify-start"
            onClick={() => setIsOpen(false)}
          >
            <img
              src="/assets/svg/hallia-orange-logo.svg"
              width={40}
              height={40}
              alt="HALL-IA Logo"
              className="drop-shadow-md"
              style={{ height: 'auto' }}
            />
            <img
              src="/assets/svg/hallia-letter-navbar-logo.svg"
              width={120}
              height={24}
              alt="HALL-IA"
              className="opacity-90"
              style={{ height: 'auto' }}
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden justify-center md:flex">
            <ul className="flex gap-2">
              <li>
                <ButtonLink href="#avantages" text="Avantages" onClick={() => setIsOpen(false)} />
              </li>
              <li>
                <ButtonLink href="#etapes" text="Étapes" onClick={() => setIsOpen(false)} />
              </li>


              <li>
                <ButtonLink href="#prix" text="Prix" onClick={() => setIsOpen(false)} />
              </li>
            </ul>
          </div>

          {/* Right - User menu or Login button */}
          <div className="flex items-center justify-end">
            {user ? (
              <div
                className="relative"
                onMouseEnter={() => setIsUserMenuOpen(true)}
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                {/* Avatar avec initiale */}
                <button
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] text-base font-semibold text-white transition-all hover:scale-110 hover:shadow-lg"
                  aria-label="Menu utilisateur"
                >
                  {getInitial()}
                </button>

                {/* Menu dropdown */}
                <div
                  className={cn(
                    'absolute top-12 right-0 max-w-xs min-w-48 overflow-hidden rounded-lg bg-white shadow-xl transition-all duration-200',
                    isUserMenuOpen
                      ? 'visible translate-y-0 opacity-100'
                      : 'invisible -translate-y-2 opacity-0',
                  )}
                >
                  <div className="py-2">
                    <div className="border-b border-gray-100 px-4 py-2 text-sm break-words text-gray-500">
                      {user.email}
                    </div>
                    <a
                      href="/#dashboard"
                      className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                      Dashboard
                    </a>
                    <button
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  // Rediriger vers la page de connexion
                  window.location.href = window.location.origin + '/#record';
                }}
                className="px-1 w-fit cursor-pointer rounded-full bg-white/10 md:px-4 py-1.5 text-sm font-medium text-nowrap transition-colors hover:bg-white hover:text-gray-600 md:text-base"
              >
                Se connecter
              </button>
            )}
          </div>
        </div>

        {/* Dropdown menu */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            isOpen ? 'mt-4 max-h-[800px] opacity-100 lg:mt-0 lg:max-h-0' : 'max-h-0 opacity-0',
          )}
        >
          <div className="grid gap-4 divide-[#656462] max-md:divide-y-1 md:grid-cols-1 md:gap-8">
            {/* Section - Étapes */}
            <div className="space-y-3 px-3 pb-4 md:hidden">
              <h3 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
                Étapes
              </h3>
              <a
                href="#etapes"
                className="group flex items-center gap-3"
                onClick={() => setIsOpen(false)}
              >
                <p className="font-semibold transition-colors group-hover:text-orange-400">
                  Étapes <span className="font-normal text-white">– Comment ça marche</span>
                </p>
              </a>
            </div>

            {/* Section - Avantages */}
            <div className="space-y-3 px-3 pb-4 md:hidden">
              <h3 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
                Avantages
              </h3>
              <a
                href="#avantages"
                className="group flex items-center gap-3"
                onClick={() => setIsOpen(false)}
              >
                <p className="font-semibold transition-colors group-hover:text-orange-400">
                  Avantages <span className="font-normal text-white">– Pourquoi nous choisir</span>
                </p>
              </a>
            </div>

            {/* Section - Prix */}
            <div className="space-y-3 px-3 pb-3 md:hidden">
              <h3 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">Prix</h3>
              <a
                href="#prix"
                className="group flex items-center gap-3"
                onClick={() => setIsOpen(false)}
              >
                <p className="font-semibold transition-colors group-hover:text-orange-400">
                  Prix <span className="font-normal text-white">– Nos offres</span>
                </p>
              </a>
            </div>

            {/* Section - Connexion/Déconnexion (mobile) */}
            <div className="space-y-3 border-t border-[#656462] px-3 pt-4 pb-4 md:hidden">
              {user ? (
                <>
                  <div className="border-b border-[#656462] px-4 py-2 text-sm text-gray-300">
                    {user.email}
                  </div>
                  <a
                    href="/#dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Tableau de bord
                  </a>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Se déconnecter
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Rediriger vers la page de connexion
                    window.location.href = window.location.origin + '/#record';
                  }}
                  className="w-full rounded-full bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] px-4 py-2.5 text-sm font-medium text-white transition-all hover:scale-105"
                >
                  Se connecter
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

    </>
  );
}
