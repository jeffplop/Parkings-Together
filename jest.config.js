module.exports = {
  testEnvironment: 'node',
  // Polyfill WebSocket before any module loads so @supabase/realtime-js
  // can instantiate without throwing on Node < 22 or in Jest sandboxes.
  setupFiles: ['./jest.setup.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: ['**/tests/**/*.circuitbreaker.test.js', '**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', 'apps/web/tests/api.test.js'],
  // Excluye del Haste module map los worktrees anidados de Claude
  // (.claude/worktrees/*), que son una copia completa del repo y duplican los
  // paquetes del workspace (p.ej. @parkings/supabase-db), provocando una
  // colisión "looked up in the Haste module map" al correr Jest desde la raíz.
  // Es un artefacto del entorno local: en un clon limpio / CI no existe .claude/,
  // por lo que esta regla es inofensiva allí (no coincide con nada).
  modulePathIgnorePatterns: ['<rootDir>/\\.claude/'],
  transformIgnorePatterns: [
    '/node_modules/(?!@parkings)'
  ],
};
