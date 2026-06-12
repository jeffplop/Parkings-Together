# apps/auth — Microservicio de Autenticación

Microservicio Next.js responsable de la autenticación y registro de usuarios. Implementa el patrón arquitectural **MVC + Repository** con tres capas bien definidas: Controller (HTTP), Service (lógica de negocio) y Repository (acceso a Supabase Auth).

---

## Patrón Arquitectural: MVC + Repository

### Capas de la Arquitectura

```
Request HTTP (POST /api/v1/auth/login | /api/v1/auth/register)
          ↓
    route.js (Entry point — delega al Controller)
          ↓
    AuthController (Validación de inputs, manejo de errores HTTP, CORS)
          ↓
    AuthService (Lógica de negocio, formato de respuesta)
          ↓
    AuthRepository (Supabase Auth — signIn / signUp)
          ↓
    Supabase Authentication + tabla perfiles (PostgreSQL)
```

| Capa       | Archivo                                    | Responsabilidad                                    |
|------------|--------------------------------------------|----------------------------------------------------|
| Controller | `src/controllers/auth.controller.js`       | Validar campos requeridos, responder HTTP con CORS |
| Service    | `src/services/auth.service.js`             | Extraer y formatear datos del usuario y token      |
| Repository | `src/repositories/auth.repository.js`      | Llamadas a Supabase Auth (signIn / signUp)         |

---

## Endpoints

### `POST /api/v1/auth/login` — Iniciar sesión

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@ejemplo.com",
    "nombre": "Juan Pérez"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Respuesta de error (401):**
```json
{
  "success": false,
  "error": "Credenciales inválidas. Verifica tu email y contraseña."
}
```

### `POST /api/v1/auth/register` — Registrar usuario

**Body:**
```json
{
  "email": "nuevo@ejemplo.com",
  "password": "contraseña123",
  "nombre": "María González",
  "rol": "cliente"
}
```

**Campos requeridos:** `email`, `password`, `nombre`, `rol`  
**Valores válidos para `rol`:** `"cliente"` | `"arrendador"`

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "Cuenta creada. Revisa tu correo para confirmar.",
  "user": {
    "id": "uuid-del-nuevo-usuario",
    "email": "nuevo@ejemplo.com",
    "rol": "cliente"
  }
}
```

**Respuesta de error (400):**
```json
{
  "success": false,
  "error": "Nombre, email, contraseña y rol son obligatorios."
}
```

---

## Detalles de Implementación

### AuthController — Validación y CORS

```js
// src/controllers/auth.controller.js
export const AuthController = {
  async login(request) {
    const body = await request.json();
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Email y contraseña son obligatorios.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    const result = await AuthService.login(body);
    return NextResponse.json({ success: true, ...result }, { status: 200, headers: CORS_HEADERS });
  }
};
```

### AuthRepository — Supabase Auth

```js
// src/repositories/auth.repository.js
export const AuthRepository = {
  async signUp(email, password, nombre, rol) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, rol } },
    });
    if (error) throw new Error(error.message);
    // Insertar perfil via Service Role si el trigger no lo hace automáticamente
    if (data?.user) {
      const adminDb = getServiceSupabase();
      await adminDb.from('perfiles').insert({ id: data.user.id, nombre, rol });
    }
    return data;
  }
};
```

---

## Instalación y Ejecución

```bash
cd apps/auth
npm install
npm run dev
# → http://localhost:3001
```

### Variables de entorno

Crear `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_WEB_URL=http://localhost:3000
PORT=3001
```

---

## Estructura de Carpetas

```
apps/auth/
├── app/
│   └── api/v1/auth/
│       ├── login/route.js      ← Entry point login
│       └── register/route.js   ← Entry point registro
└── src/
    ├── controllers/
    │   └── auth.controller.js  ← MVC: capa HTTP
    ├── services/
    │   └── auth.service.js     ← Lógica de negocio
    └── repositories/
        └── auth.repository.js  ← Acceso a Supabase Auth
```

---

## Seguridad

- El `access_token` JWT retornado en login debe incluirse en las llamadas a los demás microservicios como `Authorization: Bearer <token>`.
- El `SUPABASE_SERVICE_ROLE_KEY` nunca se expone al cliente: solo se usa en el servidor para insertar el perfil.
- El controller incluye encabezados CORS restrictivos que solo permiten el origen del frontend.
