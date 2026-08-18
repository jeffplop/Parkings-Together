// Tests unitarios para AuthService (apps/auth)
// Patrón: mock del repositorio para aislar la capa de servicio

jest.mock('../src/repositories/auth.repository', () => ({
  AuthRepository: {
    signIn: jest.fn(),
    signUp: jest.fn(),
  },
}));

import { AuthService } from '../src/services/auth.service';
import { AuthRepository } from '../src/repositories/auth.repository';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── login ────────────────────────────────────────────────────────────────────
describe('AuthService.login', () => {
  test('extrae correctamente id, email y nombre del resultado del repositorio', async () => {
    AuthRepository.signIn.mockResolvedValue({
      user: {
        id: 'user-uuid-1',
        email: 'test@example.com',
        user_metadata: { nombre_completo: 'Juan Pérez' },
      },
      session: { access_token: 'tok-xyz' },
    });

    const result = await AuthService.login({ email: 'test@example.com', password: 'Pass1234!' });

    expect(result.user.id).toBe('user-uuid-1');
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.nombre).toBe('Juan Pérez');
    expect(result.access_token).toBe('tok-xyz');
  });

  test('usa full_name como fallback si nombre_completo no existe', async () => {
    AuthRepository.signIn.mockResolvedValue({
      user: {
        id: 'user-uuid-2',
        email: 'a@b.com',
        user_metadata: { full_name: 'María González' },
      },
      session: { access_token: 'tok-aaa' },
    });

    const result = await AuthService.login({ email: 'a@b.com', password: 'X' });
    expect(result.user.nombre).toBe('María González');
  });

  test('usa "Usuario" como fallback cuando no hay metadata de nombre', async () => {
    AuthRepository.signIn.mockResolvedValue({
      user: { id: 'u3', email: 'c@d.com', user_metadata: {} },
      session: { access_token: 'tok-bbb' },
    });

    const result = await AuthService.login({ email: 'c@d.com', password: 'X' });
    expect(result.user.nombre).toBe('Usuario');
  });

  test('propaga errores del repositorio', async () => {
    AuthRepository.signIn.mockRejectedValue(new Error('Credenciales inválidas'));
    await expect(AuthService.login({ email: 'x@y.com', password: 'bad' }))
      .rejects.toThrow('Credenciales inválidas');
  });
});

// ─── register ─────────────────────────────────────────────────────────────────
describe('AuthService.register', () => {
  test('retorna mensaje de confirmación e id del usuario', async () => {
    AuthRepository.signUp.mockResolvedValue({
      user: { id: 'new-uuid', email: 'nuevo@test.com' },
    });

    const result = await AuthService.register({
      email: 'nuevo@test.com',
      password: 'Secure123!',
      nombre: 'Carlos',
      rol: 'arrendador',
    });

    expect(result.message).toMatch(/Cuenta creada/);
    expect(result.user.id).toBe('new-uuid');
    expect(result.user.rol).toBe('arrendador');
  });

  test('usa "cliente" como rol por defecto cuando no se provee', async () => {
    AuthRepository.signUp.mockResolvedValue({
      user: { id: 'uuid-def', email: 'sin-rol@test.com' },
    });

    const result = await AuthService.register({
      email: 'sin-rol@test.com',
      password: 'Abc123!',
      nombre: 'Ana',
    });

    expect(result.user.rol).toBe('cliente');
    expect(AuthRepository.signUp).toHaveBeenCalledWith(
      'sin-rol@test.com', 'Abc123!', 'Ana', 'cliente'
    );
  });

  test('propaga errores del repositorio al registrar', async () => {
    AuthRepository.signUp.mockRejectedValue(new Error('Email ya registrado'));
    await expect(AuthService.register({ email: 'dup@x.com', password: '1', nombre: 'X' }))
      .rejects.toThrow('Email ya registrado');
  });
});
