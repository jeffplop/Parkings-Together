// Configuración ESLint (flat config) compartida por todo el monorepo.
// Cada app la hereda vía `apps/*/eslint.config.mjs`, que solo la reexporta.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/dist/**',
      '**/build/**',
      'ENTREGA_PARCIAL3/**',
      '.claude/**',
    ],
  },

  // Reglas oficiales de Next.js: Core Web Vitals + errores comunes de React/hooks.
  ...(Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]),

  {
    rules: {
      // ── Correctitud (error: bloquea el CI) ──
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      eqeqeq: ['error', 'smart'],

      // ── Higiene (warning: visible, no bloquea) ──
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
    },
  },

  // Los tests corren en Node con los globals de Jest.
  {
    files: ['**/tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly',
        beforeAll: 'readonly', afterAll: 'readonly', jest: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },

  // Scripts y configuración de Node en la raíz.
  {
    files: ['*.js', '*.mjs', 'seed.mjs', 'jest.setup.js'],
    rules: { 'no-console': 'off' },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Reglas del React Compiler (eslint-plugin-react-hooks v6) degradadas a aviso.
  //
  // Marcan patrones que FUNCIONAN correctamente pero que impedirían al React
  // Compiler memoizar de forma óptima. Refactorizar ~21 hooks de una aplicación
  // ya en producción y con 167 pruebas en verde, solo para satisfacer una regla
  // de rendimiento, introduce más riesgo de regresión del que elimina.
  //
  // Se dejan como AVISO (no se desactivan) para que sigan siendo visibles como
  // deuda técnica priorizable. Ver docs/adr/0002-politica-de-lint.md.
  // ───────────────────────────────────────────────────────────────────────────
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];

export default config;
