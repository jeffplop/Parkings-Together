'use client';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@parkings/supabase-db';
import { api } from '../lib/api';

const LogoSVG = ({ className }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '48px', height: '48px' }}
  >
    <defs>
      <mask id="car-mask">
        <rect width="100" height="100" fill="white" />
        <path
          d="M45,40 L65,40 L70,50 L75,50 C77.76,50 80,52.24 80,55 L80,65 L70,65 C70,67.76 67.76,70 65,70 C62.24,70 60,67.76 60,65 L50,65 C50,67.76 47.76,70 45,70 C42.24,70 40,67.76 40,65 L35,65 L35,55 C35,52.24 37.24,50 40,50 L45,40 Z M45,43 L42,50 L52,50 L52,43 L45,43 Z M65,43 L55,43 L55,50 L68,50 L65,43 Z"
          fill="black"
        />
      </mask>

      <linearGradient
        id="neonGradient"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>

    <path
      d="M25,10 L55,10 C74.33,10 90,25.67 90,45 C90,64.33 74.33,80 55,80 L45,80 L45,95 L25,95 L25,10 Z M45,30 L45,60 L55,60 C63.28,60 70,53.28 70,45 C70,36.72 63.28,30 55,30 L45,30 Z"
      fill="url(#neonGradient)"
      mask="url(#car-mask)"
    />
  </svg>
);

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: 'fa-house' },
  { href: '/mapa', label: 'Buscar Plaza', icon: 'fa-map-location-dot' },
  { href: '/ranking', label: 'Ranking', icon: 'fa-trophy' },
];

const AUTH_NAV_ITEMS = [
  { href: '/dashboard', label: 'Panel', icon: 'fa-gauge-high' },
];

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef(null);

  // ── Auth State ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0] || 'Usuario',
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0] || 'Usuario',
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Favorites count ──
  useEffect(() => {
    if (!user) { setFavCount(0); return; }
    api.favoritos.listar().then(res => {
      if (res.success) setFavCount((res.data || []).length);
    }).catch(() => {});
  }, [user]);

  // ── Realtime pending reservations count ──
  useEffect(() => {
    if (!user) { setPendingCount(0); return; }

    let channel;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const token = session.access_token;

      const loadCount = async () => {
        try {
          const res = await fetch('/api/reservas/manage?scope=arrendador', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            setPendingCount((data.data || []).filter(r => r.estado === 'pendiente').length);
          }
        } catch { /* ignore */ }
      };

      loadCount();
      channel = supabase
        .channel('navbar-reservas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, loadCount)
        .subscribe();
    });

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  // ── Click Outside Dropdown ──
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Logout ──
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    setUser(null);
    setDropdownOpen(false);
    setMenuOpen(false);
    router.push('/');
  }, [router]);

  const isActive = (href) => pathname === href;
  const closeMenus = () => { setMenuOpen(false); setDropdownOpen(false); };

  const allNavItems = [...NAV_ITEMS, ...(user ? AUTH_NAV_ITEMS : [])];

  return (
    <>
      <nav className="glass-panel main-navbar" role="navigation">
        {/* ═══ BRAND ═══ */}
        <Link href="/" onClick={closeMenus} aria-label="Inicio - Parkings Together" className="flex items-center gap-4 cursor-pointer no-underline hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-center justify-center p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <LogoSVG />
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white tracking-tight">Parkings</span>
            <span className="text-2xl font-normal text-slate-300 tracking-tight">Together</span>
          </div>
        </Link>

        {/* ═══ HAMBURGER ═══ */}
        <button
          className={`hamburger-btn ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menú"
        >
          <span className="line"></span>
          <span className="line"></span>
          <span className="line"></span>
        </button>

        {/* ═══ NAV LINKS ═══ */}
        <div className={`nav-menu ${menuOpen ? 'open' : ''}`}>
          <div className="nav-links-container">
            {allNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link-cyber ${isActive(item.href) ? 'active' : ''}`}
                onClick={closeMenus}
              >
                <i className={`fa-solid ${item.icon} nav-icon`}></i>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="nav-divider"></div>

          {/* ═══ PREMIUM CTA ═══ */}
          <Link href="/premium" className={`premium-link ${isActive('/premium') ? 'active' : ''}`} onClick={closeMenus}>
            <i className="fa-solid fa-crown"></i>
            <span>Premium</span>
          </Link>

          {/* ═══ AUTH / USER SECTION ═══ */}
          <div className="auth-container">
            {!user ? (
              <Link href="/auth" className="btn-cyber-primary" onClick={closeMenus}>
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Ingresar</span>
              </Link>
            ) : (
              <div className="user-dropdown-wrapper" ref={dropdownRef}>
                <button
                  className="btn-cyber-secondary user-trigger"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div className="avatar-circle">
                    {user.nombre?.charAt(0).toUpperCase()}
                  </div>
                  <span>Mi Perfil</span>
                  <i className={`fa-solid fa-chevron-down chevron-icon ${dropdownOpen ? 'open' : ''}`}></i>
                </button>

                {dropdownOpen && (
                  <div className="glass-panel dropdown-menu">
                    <div className="dropdown-header">
                      <span className="dropdown-email">{user.email}</span>
                    </div>
                    
                    <div className="dropdown-content">
                      <Link href="/profile" className="nav-link-cyber dropdown-item" onClick={closeMenus}>
                        <i className="fa-solid fa-user-gear dropdown-icon"></i>
                        <span>Mi Perfil</span>
                      </Link>
                      <Link href="/reservas" className="nav-link-cyber dropdown-item" onClick={closeMenus} style={{ position: 'relative' }}>
                        <i className="fa-solid fa-calendar-check dropdown-icon"></i>
                        <span>Mis Reservas</span>
                        {pendingCount > 0 && (
                          <span style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', borderRadius: '10px', fontSize: '0.7rem', padding: '1px 7px', fontWeight: 900 }}>
                            {pendingCount}
                          </span>
                        )}
                      </Link>
                      <Link href="/profile?tab=favoritos" className="nav-link-cyber dropdown-item" onClick={closeMenus} style={{ position: 'relative' }}>
                        <i className="fa-solid fa-star dropdown-icon"></i>
                        <span>Favoritos</span>
                        {favCount > 0 && (
                          <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#020617', borderRadius: '10px', fontSize: '0.7rem', padding: '1px 7px', fontWeight: 900 }}>
                            {favCount}
                          </span>
                        )}
                      </Link>
                      <Link href="/dashboard" className="nav-link-cyber dropdown-item" onClick={closeMenus}>
                        <i className="fa-solid fa-chart-line dropdown-icon"></i>
                        <span>Panel de Control</span>
                      </Link>
                      <Link href="/premium" className="nav-link-cyber dropdown-item" onClick={closeMenus} style={{ color: '#fbbf24' }}>
                        <i className="fa-solid fa-crown dropdown-icon" style={{ color: '#fbbf24' }}></i>
                        <span>Hazte Premium</span>
                      </Link>

                      <div className="dropdown-divider"></div>
                      
                      <button className="nav-link-cyber dropdown-item danger-item" onClick={handleLogout}>
                        <i className="fa-solid fa-arrow-right-from-bracket dropdown-icon"></i>
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <style jsx>{`
        /* 
          ESTILOS ESTRUCTURALES DEL NAVBAR
          (Los colores, glassmorphism y estilos de botones vienen de globals.css)
        */
        
        .main-navbar {
          margin: 20px 5%;
          padding: 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 20px;
          z-index: 9000;
        }

        /* Brand styles removed as per strict implementation requirements. Now using Tailwind. */
        
        .nav-menu {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          justify-content: flex-end;
        }

        .nav-links-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-icon {
          width: 16px;
          text-align: center;
        }

        .nav-link-cyber.active {
          color: white !important;
          background: rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 -2px 0 var(--primary);
        }

        .nav-divider {
          width: 1px;
          height: 30px;
          background: var(--glass-border);
          margin: 0 16px;
        }

        /* ── PREMIUM CTA ── */
        .premium-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          margin-right: 12px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 0.9rem;
          color: #fbbf24;
          text-decoration: none;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          transition: all 0.25s;
          white-space: nowrap;
        }
        .premium-link:hover, .premium-link.active {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          box-shadow: 0 6px 18px rgba(245, 158, 11, 0.4);
          transform: translateY(-1px);
        }

        /* ── USER & DROPDOWN ── */
        .user-dropdown-wrapper {
          position: relative;
        }

        .user-trigger {
          padding: 8px 16px 8px 8px; /* Ajuste para el avatar */
        }

        .avatar-circle {
          width: 28px;
          height: 28px;
          background: var(--primary);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .chevron-icon {
          font-size: 0.8rem;
          transition: transform 0.3s;
        }
        .chevron-icon.open {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 15px);
          right: 0;
          min-width: 260px;
          padding: 0;
          overflow: hidden;
          animation: slideDown 0.2s ease-out;
          border-radius: 16px;
        }

        .dropdown-header {
          padding: 16px;
          border-bottom: 1px solid var(--glass-border);
          background: rgba(0, 0, 0, 0.2);
        }

        .dropdown-email {
          color: var(--text-dim);
          font-size: 0.85rem;
          font-weight: 500;
        }

        .dropdown-content {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dropdown-item {
          width: 100%;
          justify-content: flex-start; /* Alinea a la izquierda dentro del flex */
          border: none;
          background: transparent;
          font-family: inherit;
          font-size: 0.95rem;
          padding: 12px 16px;
        }

        .dropdown-icon {
          width: 20px; /* Tamaño consistente para evitar colisiones */
          text-align: center;
        }

        .dropdown-divider {
          height: 1px;
          background: var(--glass-border);
          margin: 4px 0;
        }

        .danger-item {
          color: var(--danger) !important;
        }
        .danger-item:hover {
          background: rgba(239, 68, 68, 0.1) !important;
          color: var(--danger) !important;
        }

        /* ── HAMBURGER ── */
        .hamburger-btn {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 5px;
        }
        .hamburger-btn .line {
          width: 24px;
          height: 2px;
          background: var(--text-main);
          transition: 0.3s;
          transform-origin: left;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .main-navbar {
            margin: 10px 4%;
            padding: 15px 20px;
          }
          .hamburger-btn {
            display: flex;
          }
          .nav-menu {
            display: none;
            position: absolute;
            top: calc(100% + 15px);
            left: 0;
            right: 0;
            flex-direction: column;
            background: var(--bg-surface);
            padding: 20px;
            border-radius: 16px;
            border: 1px solid var(--glass-border);
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          }
          .nav-menu.open {
            display: flex;
          }
          .nav-links-container {
            flex-direction: column;
            width: 100%;
          }
          .nav-link-cyber {
            width: 100%;
            justify-content: flex-start;
          }
          .nav-divider {
            width: 100%;
            height: 1px;
            margin: 12px 0;
          }
          .auth-container {
            width: 100%;
          }
          .premium-link {
            width: 100%;
            justify-content: center;
            margin-right: 0;
            margin-bottom: 10px;
          }
          .btn-cyber-primary {
            width: 100%;
          }
          .user-dropdown-wrapper {
            width: 100%;
          }
          .dropdown-menu {
            position: static;
            width: 100%;
            margin-top: 10px;
            border: none;
            box-shadow: none;
            background: rgba(0,0,0,0.2);
          }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}