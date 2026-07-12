// Tests unitarios para AuthController (apps/auth)
// Verifica validación de campos y mapeo de errores a códigos HTTP

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, opts) => ({ body, status: opts?.status ?? 200 })),
  },
}));

jest.mock('../src/services/auth.service', () => ({
  AuthService: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

import { AuthController } from '../src/controllers/auth.controller';
import { AuthService } from '../src/services/auth.service';

const mockRequest = (body) => ({
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── login ────────────────────────────────────────────────────────────────────
describe('AuthController.login', () => {
  test('retorna 400 si falta email', async () => {
    const res = await AuthController.login(mockRequest({ password: 'abc' }));
    expect(res.status).toBe(400);
    expect(AuthService.login).not.toHaveBeenCalled();
  });

  test('retorna 400 si falta password', async () => {
    const res = await AuthController.login(mockRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(400);
  });

  test('retorna 200 con token en login exitoso', async () => {
    AuthService.login.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', nombre: 'Ana' },
      access_token: 'tok-ok',
    });

    const res = await AuthController.login(mockRequest({ email: 'a@b.com', password: 'Pass1!' }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toBe('tok-ok');
  });

  test('retorna 401 cuando el servicio lanza error de credenciales', async () => {
    AuthService.login.mockRejectedValue(new Error('Credenciales inválidas'));
    const res = await AuthController.login(mockRequest({ email: 'x@y.com', password: 'bad' }));
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('retorna 500 ante un error inesperado del servicio', async () => {
    AuthService.login.mockRejectedValue(new Error('DB connection lost'));
    const res = await AuthController.login(mockRequest({ email: 'x@y.com', password: 'X' }));
    expect(res.status).toBe(500);
  });
});

// ─── register ─────────────────────────────────────────────────────────────────
describe('AuthController.register', () => {
  test('retorna 400 si falta nombre', async () => {
    const res = await AuthController.register(
      mockRequest({ email: 'a@b.com', password: 'X', rol: 'cliente' })
    );
    expect(res.status).toBe(400);
    expect(AuthService.register).not.toHaveBeenCalled();
  });

  test('retorna 400 si falta rol', async () => {
    const res = await AuthController.register(
      mockRequest({ email: 'a@b.com', password: 'X', nombre: 'Juan' })
    );
    expect(res.status).toBe(400);
  });

  test('retorna 201 en registro exitoso', async () => {
    AuthService.register.mockResolvedValue({
      message: 'Cuenta creada.',
      user: { id: 'new-uuid', email: 'n@test.com', rol: 'cliente' },
    });

    const res = await AuthController.register(
      mockRequest({ email: 'n@test.com', password: 'Secure1!', nombre: 'Nuevo', rol: 'cliente' })
    );
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('retorna 400 cuando el servicio lanza un error', async () => {
    AuthService.register.mockRejectedValue(new Error('Email ya en uso'));
    const res = await AuthController.register(
      mockRequest({ email: 'dup@x.com', password: '1', nombre: 'X', rol: 'cliente' })
    );
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
