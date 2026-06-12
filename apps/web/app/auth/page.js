'use client';
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { supabase } from '@parkings/supabase-db';

// ─── Password strength ────────────────────────────────────────────────────────
function pwStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '#334155' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[!@#$%^&*()\-_=+[\]{};':",.<>/?`~\\|]/.test(pw)) s++;
  const labels = ['', 'Muy débil', 'Débil', 'Regular', 'Fuerte', 'Muy fuerte'];
  const colors = ['#334155', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
  return { score: s, label: labels[s], color: colors[s] };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':",.<>/?`~\\|]).{8,}$/;

const VEHICLE_TYPES = [
  { value: 'auto',    icon: 'fa-car',         label: 'Auto' },
  { value: 'moto',    icon: 'fa-motorcycle',  label: 'Moto' },
  { value: 'bicicleta',icon:'fa-bicycle',     label: 'Bicicleta' },
  { value: 'scooter', icon: 'fa-person-biking',label: 'Scooter' },
];

function AuthForm() {
  const [isLogin, setIsLogin]       = useState(true);
  const [step, setStep]             = useState(1); // 1=rol, 2=personal, 3=cuenta
  const [loading, setLoading]       = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);
  const router   = useRouter();
  const searchParams = useSearchParams();

  // Form values
  const [rol,         setRol]         = useState('cliente');
  const [nombre,      setNombre]      = useState('');
  const [apellido,    setApellido]    = useState('');
  const [telefono,    setTelefono]    = useState('');
  const [tipoVeh,     setTipoVeh]     = useState('auto');
  const [patente,     setPatente]     = useState('');
  const [empresa,     setEmpresa]     = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);

  // Errors
  const [errors, setErrors] = useState({});

  const strength = pwStrength(password);

  const getDestino = () => {
    const dest = searchParams.get('redirectTo');
    return dest && dest.startsWith('/') && !dest.startsWith('//') ? dest : '/mapa';
  };

  useEffect(() => {
    const errorMsg = searchParams.get('error');
    if (errorMsg) toast.error(decodeURIComponent(errorMsg));
  }, [searchParams]);

  const resetRegister = () => {
    setStep(1); setRol('cliente'); setNombre(''); setApellido('');
    setTelefono(''); setTipoVeh('auto'); setPatente(''); setEmpresa('');
    setEmail(''); setPassword(''); setErrors({});
  };

  const toggleMode = () => { setIsLogin(!isLogin); resetRegister(); };

  // ── Validation per step ────────────────────────────────────────────────────
  const validateStep2 = () => {
    const e = {};
    if (!nombre.trim() || nombre.trim().length < 2) e.nombre = 'Ingresa tu nombre (mín. 2 caracteres)';
    if (!apellido.trim() || apellido.trim().length < 2) e.apellido = 'Ingresa tu apellido (mín. 2 caracteres)';
    if (rol === 'arrendador' && telefono && !/^\+?[\d\s\-]{7,15}$/.test(telefono))
      e.telefono = 'Teléfono inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e = {};
    if (!EMAIL_RE.test(email)) e.email = 'Correo electrónico inválido';
    if (!PW_RE.test(password))
      e.password = 'Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RE.test(email)) errs.email = 'Correo inválido';
    if (!password) errs.password = 'Ingresa tu contraseña';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (authData?.user) {
        let profile = null;
        try {
          const { data: p } = await supabase.from('perfiles').select('rol').eq('id', authData.user.id).single();
          profile = p;
        } catch { /* ignore */ }
        window.localStorage.setItem('user', JSON.stringify({
          id: authData.user.id, email: authData.user.email,
          nombre: authData.user.user_metadata?.nombre || authData.user.email?.split('@')[0],
          rol: profile?.rol || authData.user.user_metadata?.rol || 'cliente'
        }));
      }
      setSuccessAnim(true);
      toast.success('¡Sesión iniciada!');
      setTimeout(() => router.push(getDestino()), 1500);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
      let msg = err.message || 'Error en la autenticación';
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials'))
        msg = 'Correo o contraseña incorrectos.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre, apellido, rol, telefono, tipo_vehiculo: tipoVeh, patente: patente.trim().toUpperCase() || null, empresa }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear cuenta.');

      if (result.autoLogin && result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      }
      setSuccessAnim(true);
      toast.success('¡Cuenta creada exitosamente!');
      setTimeout(() => router.push(getDestino()), 1500);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
      let msg = err.message || 'Error al crear cuenta';
      if (msg.includes('already registered')) msg = 'Este correo ya tiene una cuenta. Inicia sesión.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (successAnim) {
    return (
      <div className="auth-fullscreen">
        <div className="auth-glass-box success-mode">
          <div className="success-screen">
            <div className="success-circle"><i className="fa-solid fa-check"></i></div>
            <h3>{isLogin ? '¡Sesión iniciada!' : '¡Bienvenido/a!'}</h3>
            <p>Redirigiendo al mapa...</p>
          </div>
        </div>
        <style jsx>{sharedStyles}</style>
      </div>
    );
  }

  return (
    <div className="auth-fullscreen">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #3b82f6' } }} />

      <div className="auth-glass-box">
        {/* ── Brand ── */}
        <div className="brand-logo">
          <i className={isLogin ? 'fa-solid fa-fingerprint' : 'fa-solid fa-user-plus'}></i>
        </div>
        <h2>{isLogin ? 'Iniciar sesión' : 'Crear mi cuenta'}</h2>
        <p className="auth-subtitle">Estacionamientos compartidos · Simple y seguro</p>

        {/* ── Step indicator (register only) ── */}
        {!isLogin && (
          <div className="step-indicator">
            {['Rol', 'Perfil', 'Acceso'].map((s, i) => (
              <div key={i} className={`step-dot ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : ''}`}>
                {step > i + 1 ? <i className="fa-solid fa-check"></i> : i + 1}
                <span className="step-label">{s}</span>
              </div>
            ))}
            <div className="step-line" style={{ '--progress': `${((step - 1) / 2) * 100}%` }}></div>
          </div>
        )}

        {/* ══════════ LOGIN FORM ══════════ */}
        {isLogin && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="input-wrap">
              <i className="fa-solid fa-envelope icon"></i>
              <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              {errors.email && <p className="error-msg">{errors.email}</p>}
            </div>
            <div className="input-wrap">
              <i className="fa-solid fa-lock icon"></i>
              <input type={showPw ? 'text' : 'password'} placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
              {errors.password && <p className="error-msg">{errors.password}</p>}
            </div>
            <button type="submit" className="auth-btn-main" disabled={loading}>
              <span className="btn-content">
                {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Procesando...</> : <><i className="fa-solid fa-right-to-bracket"></i> Ingresar</>}
              </span>
            </button>
          </form>
        )}

        {/* ══════════ REGISTER — STEP 1: ROL ══════════ */}
        {!isLogin && step === 1 && (
          <div className="auth-form">
            <p className="step-title">¿Cómo usarás la plataforma?</p>
            <div className="role-cards">
              <button type="button" className={`role-card ${rol === 'cliente' ? 'active' : ''}`} onClick={() => setRol('cliente')}>
                <div className="role-card-icon"><i className="fa-solid fa-car"></i></div>
                <strong>Conductor</strong>
                <span>Busca y reserva estacionamientos cerca de ti</span>
                {rol === 'cliente' && <div className="role-check"><i className="fa-solid fa-circle-check"></i></div>}
              </button>
              <button type="button" className={`role-card ${rol === 'arrendador' ? 'active' : ''}`} onClick={() => setRol('arrendador')}>
                <div className="role-card-icon arrendador"><i className="fa-solid fa-square-parking"></i></div>
                <strong>Arrendador</strong>
                <span>Publica tu estacionamiento y genera ingresos</span>
                {rol === 'arrendador' && <div className="role-check arrendador"><i className="fa-solid fa-circle-check"></i></div>}
              </button>
            </div>
            <button className="auth-btn-main" onClick={() => setStep(2)}>
              <span className="btn-content"><i className="fa-solid fa-arrow-right"></i> Continuar</span>
            </button>
          </div>
        )}

        {/* ══════════ REGISTER — STEP 2: PERSONAL ══════════ */}
        {!isLogin && step === 2 && (
          <div className="auth-form">
            <p className="step-title">
              {rol === 'cliente' ? '👤 Tus datos personales' : '🏢 Datos del arrendador'}
            </p>
            <div className="name-row">
              <div className="input-field-row">
                <div className="input-wrap">
                  <i className="fa-solid fa-user icon"></i>
                  <input type="text" placeholder="Nombre" value={nombre}
                    autoComplete="given-name"
                    onChange={e => setNombre(e.target.value)}
                    onInput={e => setNombre(e.target.value)} />
                </div>
                {errors.nombre && <p className="error-msg">{errors.nombre}</p>}
              </div>
              <div className="input-field-row">
                <div className="input-wrap">
                  <i className="fa-solid fa-user icon"></i>
                  <input type="text" placeholder="Apellido" value={apellido}
                    autoComplete="family-name"
                    onChange={e => setApellido(e.target.value)}
                    onInput={e => setApellido(e.target.value)} />
                </div>
                {errors.apellido && <p className="error-msg">{errors.apellido}</p>}
              </div>
            </div>
            <div className="input-field-row">
              <div className="input-wrap">
                <i className="fa-solid fa-phone icon"></i>
                <input type="tel" placeholder={rol === 'arrendador' ? 'Teléfono de contacto' : 'Teléfono (opcional)'}
                  value={telefono} autoComplete="tel"
                  onChange={e => setTelefono(e.target.value)}
                  onInput={e => setTelefono(e.target.value)} />
              </div>
              {errors.telefono && <p className="error-msg">{errors.telefono}</p>}
            </div>

            {rol === 'cliente' && (
              <>
                <div className="vehicle-selector">
                  <p className="field-label">¿Cuál es tu vehículo principal?</p>
                  <div className="vehicle-grid">
                    {VEHICLE_TYPES.map(v => (
                      <button key={v.value} type="button"
                        className={`vehicle-option ${tipoVeh === v.value ? 'active' : ''}`}
                        onClick={() => { setTipoVeh(v.value); setPatente(''); }}>
                        <i className={`fa-solid ${v.icon}`}></i>
                        <span>{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="input-wrap">
                  <i className="fa-solid fa-id-card icon"></i>
                  <input
                    type="text"
                    placeholder={
                      tipoVeh === 'auto' ? 'Patente (ej: ABCD12)' :
                      tipoVeh === 'moto' ? 'Patente moto (opcional)' :
                      'Patente / matrícula (opcional)'
                    }
                    value={patente}
                    onChange={e => setPatente(e.target.value.toUpperCase())}
                    maxLength={8}
                    style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}
                  />
                  {tipoVeh !== 'auto' && (
                    <span style={{ position: 'absolute', right: 14, top: 17, fontSize: '0.7rem', color: '#64748b', pointerEvents: 'none' }}>
                      opcional
                    </span>
                  )}
                </div>
              </>
            )}

            {rol === 'arrendador' && (
              <div className="input-wrap">
                <i className="fa-solid fa-building icon"></i>
                <input type="text" placeholder="Empresa o razón social (opcional)" value={empresa} onChange={e => setEmpresa(e.target.value)} />
              </div>
            )}

            <div className="btn-row">
              <button className="auth-btn-back" onClick={() => setStep(1)}>
                <i className="fa-solid fa-arrow-left"></i> Atrás
              </button>
              <button className="auth-btn-main flex-1" onClick={() => { if (validateStep2()) setStep(3); }}>
                <span className="btn-content"><i className="fa-solid fa-arrow-right"></i> Continuar</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════ REGISTER — STEP 3: CUENTA ══════════ */}
        {!isLogin && step === 3 && (
          <div className="auth-form">
            <p className="step-title">🔐 Datos de acceso</p>
            <div className="input-wrap">
              <i className="fa-solid fa-envelope icon"></i>
              <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              {errors.email && <p className="error-msg">{errors.email}</p>}
            </div>
            <div className="input-wrap">
              <i className="fa-solid fa-lock icon"></i>
              <input type={showPw ? 'text' : 'password'} placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
              {errors.password && <p className="error-msg">{errors.password}</p>}
            </div>
            {password && (
              <div className="pw-strength">
                <div className="pw-bar">
                  <div className="pw-fill" style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}></div>
                </div>
                <span style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
            <p className="pw-hint">Mín. 8 chars · mayúscula · minúscula · número · símbolo</p>

            <div className="btn-row">
              <button className="auth-btn-back" onClick={() => setStep(2)}>
                <i className="fa-solid fa-arrow-left"></i> Atrás
              </button>
              <button className="auth-btn-main flex-1" disabled={loading}
                onClick={() => { if (validateStep3()) handleRegister(); }}>
                <span className="btn-content">
                  {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Creando...</> : <><i className="fa-solid fa-user-plus"></i> Crear cuenta</>}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="auth-footer-text">
          {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <span onClick={toggleMode} className="toggle-link">
            {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
          </span>
        </div>
      </div>

      <style jsx>{sharedStyles}</style>
    </div>
  );
}

const sharedStyles = `
  .auth-fullscreen { min-height: 100vh; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle at 30% 50%, #0f1f3d 0%, #020617 60%); padding: 20px; }
  .auth-glass-box { width: 100%; max-width: 480px; padding: 48px 42px; background: rgba(15,23,42,0.7); backdrop-filter: blur(40px); border-radius: 32px; border: 1px solid rgba(255,255,255,0.07); box-shadow: 0 30px 60px -15px rgba(0,0,0,0.9); position: relative; z-index: 2; }
  .success-mode { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); }
  .brand-logo { width: 72px; height: 72px; background: linear-gradient(135deg,rgba(59,130,246,0.2),rgba(37,99,235,0.1)); border: 1px solid rgba(59,130,246,0.4); border-radius: 20px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 2rem; box-shadow: 0 0 30px rgba(59,130,246,0.15); }
  h2 { color: white; font-size: 2rem; font-weight: 900; margin: 0; letter-spacing: -1px; text-align: center; }
  .auth-subtitle { font-size: 0.78rem; color: #64748b; letter-spacing: 1px; margin: 8px 0 28px; font-weight: 500; text-align: center; }

  /* Step indicator */
  .step-indicator { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 28px; position: relative; }
  .step-line { position: absolute; top: 14px; left: 20%; width: 60%; height: 2px; background: #1e293b; z-index: 0; }
  .step-line::after { content:''; display:block; height:100%; width: var(--progress,0%); background: #3b82f6; transition: width 0.4s; }
  .step-dot { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 33%; z-index: 1; position: relative; }
  .step-dot > :first-child { width: 28px; height: 28px; border-radius: 50%; background: #1e293b; border: 2px solid #334155; color: #64748b; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
  .step-dot.active > :first-child { background: #3b82f6; border-color: #3b82f6; color: white; box-shadow: 0 0 12px rgba(59,130,246,0.5); }
  .step-dot.done > :first-child { background: #10b981; border-color: #10b981; color: white; }
  .step-label { font-size: 0.68rem; color: #64748b; font-weight: 600; }
  .step-dot.active .step-label { color: #93c5fd; }
  .step-dot.done .step-label { color: #6ee7b7; }

  /* Step title */
  .step-title { color: #94a3b8; font-size: 0.88rem; font-weight: 600; margin: 0 0 18px; text-align: center; }
  .field-label { color: #64748b; font-size: 0.8rem; font-weight: 600; margin: 0 0 10px; letter-spacing: 0.5px; }

  /* Inputs */
  .auth-form { display: flex; flex-direction: column; gap: 0; }
  .input-wrap { position: relative; margin-bottom: 4px; text-align: left; }
  .input-field-row { margin-bottom: 14px; }
  .input-wrap .icon { position: absolute; left: 18px; top: 17px; color: #64748b; font-size: 1rem; pointer-events: none; z-index: 1; }
  .input-wrap input { width: 100%; box-sizing: border-box; padding: 16px 44px 16px 50px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; color: white; outline: none; transition: 0.3s; font-size: 0.95rem; }
  .input-wrap input::placeholder { color: #475569; }
  .input-wrap input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); background: rgba(0,0,0,0.6); }
  .pw-toggle { position: absolute; right: 16px; top: 17px; background: none; border: none; color: #64748b; cursor: pointer; padding: 4px; font-size: 0.95rem; }
  .pw-toggle:hover { color: #94a3b8; }
  .error-msg { color: #fca5a5; font-size: 0.75rem; margin: 4px 0 0 8px; }

  /* Name row */
  .name-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }

  /* Role cards */
  .role-cards { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
  .role-card { position: relative; padding: 18px 20px; background: rgba(0,0,0,0.35); border: 1.5px solid rgba(255,255,255,0.07); border-radius: 16px; color: #94a3b8; cursor: pointer; transition: all 0.25s; text-align: left; display: flex; flex-direction: column; gap: 4px; }
  .role-card strong { color: #e2e8f0; font-size: 1rem; }
  .role-card span { font-size: 0.8rem; color: #64748b; }
  .role-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(59,130,246,0.3); }
  .role-card.active { background: rgba(59,130,246,0.1); border-color: #3b82f6; box-shadow: 0 0 20px rgba(59,130,246,0.15); }
  .role-card-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(59,130,246,0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 8px; }
  .role-card-icon.arrendador { background: rgba(16,185,129,0.15); color: #34d399; }
  .role-check { position: absolute; top: 16px; right: 16px; color: #3b82f6; font-size: 1.2rem; }
  .role-check.arrendador { color: #10b981; }

  /* Vehicle selector */
  .vehicle-selector { margin-bottom: 16px; }
  .vehicle-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .vehicle-option { padding: 10px 4px; background: rgba(0,0,0,0.35); border: 1.5px solid rgba(255,255,255,0.07); border-radius: 12px; color: #64748b; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; transition: all 0.2s; }
  .vehicle-option i { font-size: 1.2rem; }
  .vehicle-option:hover { background: rgba(255,255,255,0.05); }
  .vehicle-option.active { background: rgba(59,130,246,0.12); border-color: #3b82f6; color: #93c5fd; }

  /* Password strength */
  .pw-strength { display: flex; align-items: center; gap: 10px; margin: -8px 0 12px; }
  .pw-bar { flex: 1; height: 4px; background: #1e293b; border-radius: 99px; overflow: hidden; }
  .pw-fill { height: 100%; border-radius: 99px; transition: all 0.4s; }
  .pw-strength span { font-size: 0.75rem; font-weight: 700; min-width: 80px; text-align: right; }
  .pw-hint { color: #475569; font-size: 0.72rem; margin: 0 0 16px; text-align: center; }

  /* Buttons */
  .auth-btn-main { width: 100%; padding: 17px; background: linear-gradient(135deg,#3b82f6,#2563eb); border: none; border-radius: 14px; color: white; font-weight: 900; font-size: 1rem; cursor: pointer; transition: all 0.3s; letter-spacing: 0.5px; margin-top: 8px; }
  .auth-btn-main:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(37,99,235,0.4); }
  .auth-btn-main:disabled { opacity: 0.6; cursor: not-allowed; }
  .auth-btn-main.flex-1 { flex: 1; margin-top: 0; width: auto; }
  .btn-content { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .btn-row { display: flex; gap: 10px; margin-top: 8px; }
  .auth-btn-back { padding: 17px 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; color: #94a3b8; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
  .auth-btn-back:hover { background: rgba(255,255,255,0.1); color: white; }

  /* Footer */
  .auth-footer-text { margin-top: 28px; font-size: 0.88rem; color: #64748b; text-align: center; }
  .toggle-link { color: #3b82f6; cursor: pointer; font-weight: 900; margin-left: 6px; transition: 0.2s; }
  .toggle-link:hover { text-decoration: underline; }

  /* Success */
  .success-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; animation: fadeIn 0.5s ease; }
  .success-circle { width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg,#10b981,#059669); display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; margin-bottom: 20px; box-shadow: 0 0 40px rgba(16,185,129,0.4); animation: popIn 0.6s cubic-bezier(0.175,0.885,0.32,1.275); }
  .success-screen h3 { color: white; font-size: 1.7rem; margin-bottom: 8px; }
  .success-screen p { color: #10b981; font-weight: 600; font-size: 0.88rem; }

  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes popIn { 0% { transform:scale(0); } 80% { transform:scale(1.1); } 100% { transform:scale(1); } }

  @media (max-width: 500px) {
    .auth-glass-box { padding: 36px 22px; border-radius: 24px; border-left: none; border-right: none; }
    .auth-fullscreen { padding: 10px; align-items: flex-start; padding-top: 60px; }
    h2 { font-size: 1.7rem; }
    .name-row { grid-template-columns: 1fr; }
    .vehicle-grid { grid-template-columns: repeat(2,1fr); }
  }
`;

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#020617' }} />}>
      <AuthForm />
    </Suspense>
  );
}
