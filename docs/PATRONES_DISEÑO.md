# Patrones de Diseño — Parkings Together

**Asignatura:** Desarrollo Fullstack III — Parcial N°2  
**Institución:** DuocUC  
**Proyecto:** Parkings Together — Plataforma de Gestión Inteligente de Estacionamientos  
**Fecha:** Junio 2026

---

## 1. Introducción

Los patrones de diseño son soluciones probadas y reutilizables para problemas recurrentes en el desarrollo de software. Su uso sistemático mejora la mantenibilidad, testabilidad y escalabilidad de los sistemas, facilitando además la comunicación entre los miembros del equipo mediante un vocabulario técnico compartido.

**Parkings Together** es una plataforma de movilidad urbana que conecta conductores con propietarios de estacionamientos mediante un modelo Peer-to-Peer. El sistema está construido sobre una arquitectura de microservicios en monorepo (Turborepo), con un frontend Next.js 14 que actúa como BFF (Backend For Frontend), tres microservicios independientes y un paquete compartido de base de datos.

Dada la complejidad del dominio —reservas con transacciones compensatorias, pagos multi-proveedor, tiempo real con WebSockets y autenticación centralizada— el proyecto aplica una amplia variedad de patrones de diseño tanto en el frontend como en el backend.

---

## 2. Patrones de Diseño Implementados

### 2.1 Patrón Repository (Acceso a Datos)

**Categoría:** Arquitectural / Estructural  
**Tipo de problema que resuelve:** Acoplamiento entre la lógica de negocio y la fuente de datos.

#### Descripción

El patrón Repository actúa como una colección en memoria de objetos de dominio, ocultando los detalles de persistencia (Supabase/PostgreSQL en este caso) detrás de una interfaz limpia. La capa de servicio no sabe si los datos vienen de una base de datos, un archivo o una API externa.

#### Implementación en el proyecto

**`apps/auth/src/repositories/auth.repository.js`**
```js
import { supabase } from '@parkings/supabase-db';

export const AuthRepository = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Credenciales inválidas. Verifica tu email y contraseña.');
    return data;
  },

  async signUp(email, password, nombre, rol) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre, rol } },
    });
    if (error) throw new Error(error.message);
    return data;
  }
};
```

**`apps/ms-mapas/src/repositories/map.repository.js`**
```js
export const MapRepository = {
  async getEstacionamientos(userId) {
    let query = supabase.from('estacionamientos').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw new Error(`Error BD: ${error.message}`);
    return data;
  },

  async updateOcupacion(id, occupied_spots) {
    const { data, error } = await supabase
      .from('estacionamientos')
      .update({ occupied_spots })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Error BD al actualizar ocupación: ${error.message}`);
    return data;
  }
};
```

También implementado en `apps/ms-reservas/app/api/v1/reserve/repositories/reserva.repository.js`.

#### Beneficios en este proyecto
- Si se migra de Supabase a otro proveedor, solo se modifica el repositorio, no el servicio.
- Facilita los tests unitarios mediante mocking del repositorio.
- Separa claramente la responsabilidad de persistencia de la lógica de negocio.

---

### 2.2 Patrón Service Layer (Capa de Servicio)

**Categoría:** Arquitectural / Estructural  
**Tipo de problema que resuelve:** Dispersión de la lógica de negocio en controladores o en la capa de datos.

#### Descripción

El patrón Service Layer define la frontera de la aplicación y encapsula todas las operaciones de negocio. Los controladores delegan en los servicios, que a su vez coordinan repositorios y otras dependencias.

#### Implementación en el proyecto

**`apps/auth/src/services/auth.service.js`**
```js
import { AuthRepository } from '../repositories/auth.repository';

export const AuthService = {
  async login(payload) {
    const { email, password } = payload;
    const data = await AuthRepository.signIn(email, password);
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        nombre: data.user.user_metadata?.nombre_completo ?? 'Usuario',
      },
      access_token: data.session.access_token,
    };
  },

  async register(payload) {
    const { email, password, nombre, rol } = payload;
    const data = await AuthRepository.signUp(email, password, nombre, rol || 'cliente');
    return {
      message: 'Cuenta creada. Revisa tu correo para confirmar.',
      user: { id: data.user.id, email: data.user.email, rol: rol || 'cliente' },
    };
  }
};
```

Los mismos patrones se aplican en `apps/ms-mapas/src/services/map.service.js` y `apps/ms-reservas/app/api/v1/reserve/services/reserva.service.js`.

#### Beneficios en este proyecto
- El controlador queda liviano: solo parsea request y retorna response.
- La lógica de negocio puede reutilizarse desde múltiples endpoints.
- Facilita el testing unitario de la lógica de negocio de forma aislada.

---

### 2.3 Patrón Controller (MVC — Model-View-Controller)

**Categoría:** Arquitectural / Estructural  
**Tipo de problema que resuelve:** Mezcla de responsabilidades entre interfaz HTTP, lógica de negocio y acceso a datos.

#### Descripción

El controlador recibe la solicitud HTTP, valida los datos de entrada, delega en el servicio y construye la respuesta. No contiene lógica de negocio propia.

#### Implementación en el proyecto

**`apps/ms-mapas/src/controllers/map.controller.js`**
```js
export const MapController = {
  async create(request) {
    try {
      const body = await request.json();
      if (!body.nombre || !body.lat || !body.lng || !body.userId) {
        return NextResponse.json(
          { success: false, error: 'Faltan campos obligatorios: nombre, lat, lng, userId.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const data = await MapService.createEstacionamiento(body);
      return NextResponse.json({ success: true, data }, { status: 201, headers: CORS_HEADERS });
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
    }
  },
  // ...
};
```

**`apps/auth/src/controllers/auth.controller.js`** implementa el mismo patrón para login y registro.

#### Beneficios en este proyecto
- Clara separación entre el protocolo HTTP y la lógica de dominio.
- El manejo de errores y los encabezados CORS están centralizados en el controlador.
- El equipo puede modificar la validación HTTP sin tocar el servicio.

---

### 2.4 Patrón Saga + CQRS (Transacciones Distribuidas)

**Categoría:** Comportamental / Arquitectural  
**Tipo de problema que resuelve:** Consistencia eventual en sistemas distribuidos donde no hay transacciones ACID globales.

#### Descripción

**CQRS** (Command Query Responsibility Segregation) separa las operaciones de lectura (Query) de las de escritura (Command). **Saga** coordina una secuencia de transacciones locales y, si una falla, ejecuta transacciones compensatorias para revertir el estado.

#### Implementación en el proyecto

**`apps/ms-reservas/app/api/v1/reserve/services/reserva.service.js`**
```js
export const ReserveService = {
  async processSaga(payload) {
    const { parking_id, user_id, start_time } = payload;

    // 1. Query CQRS — Verificar disponibilidad (lectura)
    const parking = await ReserveRepository.getParkingAvailability(parking_id);
    if (parking.occupied_spots >= parking.total_spots) {
      throw new Error('El estacionamiento ya está lleno. Transacción rechazada.');
    }

    // 2. Command — Insertar reserva (escritura)
    const reserva = await ReserveRepository.createReserve({
      estacionamiento_id: parking_id,
      conductor_id: user_id,
      estado: 'activa',
      created_at: start_time || new Date().toISOString()
    });

    // 3. Compensación Saga — Actualizar ocupación; si falla, hace rollback
    try {
      await ReserveRepository.updateParkingOccupancy(parking_id, parking.occupied_spots + 1);
    } catch (error) {
      // Transacción compensatoria: elimina la reserva creada
      await ReserveRepository.deleteReserve(reserva.id);
      throw new Error('Fallo al actualizar ocupación. Reserva revertida (Saga Compensada).');
    }

    return reserva;
  }
};
```

#### Beneficios en este proyecto
- Garantiza consistencia entre la tabla `reservas` y la ocupación del estacionamiento.
- Si falla la actualización de ocupación, la reserva se elimina automáticamente, evitando datos corruptos.
- Escalable a múltiples microservicios sin necesidad de un coordinador de transacciones externo.

---

### 2.5 Patrón Observer (Tiempo Real)

**Categoría:** Comportamental  
**Tipo de problema que resuelve:** Acoplamiento entre un productor de eventos y sus consumidores.

#### Descripción

El patrón Observer define una dependencia uno-a-muchos: cuando el sujeto cambia de estado, todos sus observadores son notificados automáticamente. En este proyecto se implementa mediante las suscripciones Realtime de Supabase (WebSockets sobre PostgreSQL).

#### Implementación en el proyecto

**`apps/web/src/components/Navbar.js`** — Contador de reservas pendientes en tiempo real:
```js
// ── Realtime pending reservations count ──
useEffect(() => {
  if (!user) { setPendingCount(0); return; }

  let channel;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;

    const loadCount = async () => {
      const res = await fetch('/api/reservas/manage?scope=arrendador', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPendingCount((data.data || []).filter(r => r.estado === 'pendiente').length);
      }
    };

    loadCount();
    // Suscripción Realtime: el canal "escucha" cambios en la tabla reservas
    channel = supabase
      .channel('navbar-reservas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, loadCount)
      .subscribe();
  });

  return () => { if (channel) supabase.removeChannel(channel); };
}, [user]);
```

#### Beneficios en este proyecto
- El Navbar actualiza el contador de reservas pendientes sin polling periódico.
- El componente no está acoplado al mecanismo de cambio; solo reacciona a eventos.
- La limpieza del canal se gestiona en el cleanup del `useEffect`, evitando memory leaks.

---

### 2.6 Patrón Strategy (Proveedores de Pago)

**Categoría:** Comportamental  
**Tipo de problema que resuelve:** Selección dinámica de algoritmos o comportamientos intercambiables en tiempo de ejecución.

#### Descripción

El patrón Strategy define una familia de algoritmos intercambiables. El cliente selecciona la estrategia en runtime sin cambiar el código que la usa. Todos los algoritmos implementan la misma interfaz.

#### Implementación en el proyecto

**`apps/web/src/lib/payments.js`** — Tres proveedores de pago con la misma firma de retorno:
```js
// Cada proveedor es una "estrategia" intercambiable
async function chargeMock({ amount }) {
  return { status: 'completed', transactionId: genTransactionId('TXN'), raw: { simulated: true, amount } };
}

async function chargeEfectivo() {
  return { status: 'pending', transactionId: genTransactionId('CASH'), raw: { method: 'efectivo' } };
}

async function chargeWebpay({ amount, buyOrder, sessionId, returnUrl }) {
  if (!isWebpayConfigured()) {
    return { status: 'completed', transactionId: genTransactionId('WP-SIM'), raw: { simulated: true } };
  }
  // Integración real con Transbank SDK...
}

// Punto de entrada único — selecciona la estrategia según el provider
export async function createCharge(provider, params = {}) {
  switch (provider) {
    case 'webpay':   return chargeWebpay(params);
    case 'efectivo': return chargeEfectivo(params);
    case 'mock':
    default:         return chargeMock(params);
  }
}
```

#### Beneficios en este proyecto
- Agregar un nuevo proveedor de pago (ej. Khipu, PayPal) no requiere modificar el endpoint.
- Los tests unitarios pueden ejercitar cada estrategia de forma aislada.
- El endpoint `/api/pagos` solo invoca `createCharge(provider, params)` sin conocer los detalles de cada proveedor.

---

### 2.7 Patrón Singleton (Cliente de Base de Datos)

**Categoría:** Creacional  
**Tipo de problema que resuelve:** Creación de múltiples instancias costosas de un mismo recurso.

#### Descripción

El patrón Singleton garantiza que una clase tenga una única instancia compartida. En este proyecto, el cliente Supabase se instancia una sola vez y se comparte entre todos los módulos que lo importan, gracias al sistema de módulos de Node.js que cachea los exports.

#### Implementación en el proyecto

**`packages/supabase-db/index.js`**
```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Instancia única exportada — el módulo se cachea por Node.js (Singleton implícito)
export const supabase = createClient(supabaseUrl || 'http://mock-supabase.local', anonKey || 'mock-key', {
  auth: {
    autoRefreshToken: isBrowser,
    persistSession: isBrowser,
    detectSessionInUrl: isBrowser
  }
});

// Factory para cliente con privilegios elevados (Service Role)
// Se crea bajo demanda pero con protección explícita contra uso en navegador
export const getServiceSupabase = () => {
  if (typeof window !== 'undefined') {
    throw new Error('CUIDADO: Service Role Client bloqueado en el navegador.');
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false } });
};
```

#### Beneficios en este proyecto
- Una sola conexión pool compartida entre todos los microservicios y el BFF.
- Evita el agotamiento de conexiones a Supabase en entornos serverless.
- El paquete `@parkings/supabase-db` es el único punto de configuración de la conexión.

---

### 2.8 Patrón Facade (API Unificada del Frontend)

**Categoría:** Estructural  
**Tipo de problema que resuelve:** Complejidad de subsistemas con múltiples interfaces que el cliente debe conocer.

#### Descripción

El patrón Facade proporciona una interfaz simplificada a un conjunto de interfaces complejas. Los componentes React no deben conocer las URLs de los endpoints ni la lógica de reintentos: solo usan el objeto `api`.

#### Implementación en el proyecto

**`apps/web/src/lib/api.js`** — Fachada con tres namespaces: `mapas`, `reservas`, `favoritos`:
```js
export const api = {
  mapas: {
    buscar: (filtros = {}) => {
      const qs = new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')
      ).toString();
      return fetchWithTimeout(`${MAPAS_URL}/search?${qs}`);
    },
    crearEstacionamiento: async (data) =>
      fetchWithTimeout(`${MAPAS_URL}/search`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(data),
      }),
    // ...más métodos
  },
  reservas: {
    crearReserva: async (data) =>
      fetchWithTimeout(`${RESERVAS_URL}/reserve`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(data),
      }),
    confirmar: async (reserva_id) =>
      fetchWithTimeout(`${RESERVAS_URL}/manage`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'confirmar', reserva_id }),
      }),
    // ...más métodos
  },
  favoritos: { /* ... */ }
};
```

La fachada también incluye `fetchWithTimeout` con `AbortController` para manejo resiliente de errores y timeouts de 4 segundos.

#### Beneficios en este proyecto
- Los componentes de React solo hacen `api.reservas.crearReserva(data)` sin conocer las URLs.
- El timeout y manejo de errores está centralizado en un solo lugar.
- Si se cambia la estructura de la API, solo se modifica `api.js`.

---

### 2.9 Patrón BFF (Backend For Frontend)

**Categoría:** Arquitectural  
**Tipo de problema que resuelve:** Exposición de microservicios con contratos diferentes directamente al frontend, generando acoplamiento y problemas de CORS.

#### Descripción

El patrón BFF (Backend For Frontend) introduce una capa de orquestación intermedia, optimizada para las necesidades del cliente (en este caso, una PWA Next.js). El BFF agrega, transforma y autoriza las llamadas a los microservicios subyacentes.

#### Implementación en el proyecto

Las API Routes de Next.js en `apps/web/app/api/` actúan como BFF:

```
apps/web/app/api/
├── mapas/
│   ├── search/route.js        ← Proxy + agregación hacia ms-mapas
│   └── locks/route.js
├── reservas/
│   ├── reserve/route.js       ← Proxy + autenticación hacia ms-reservas
│   └── manage/route.js        ← CRUD de reservas con RLS
├── pagos/route.js             ← Orquestación de pagos (Strategy Pattern)
├── favoritos/route.js         ← CRUD de favoritos con auth
└── auth/signup/route.js       ← Registro de usuarios
```

#### Beneficios en este proyecto
- El frontend solo habla con su propio origen (`/api/...`), eliminando problemas de CORS.
- El BFF inyecta el JWT del usuario en las llamadas a microservicios.
- Permite evolucionar los microservicios sin modificar el contrato del frontend.

---

## 3. Patrones Arquitecturales

### 3.1 Microservicios

El proyecto está dividido en servicios independientes con responsabilidades bien delimitadas:

| Microservicio   | Puerto | Responsabilidad                          | Patrón interno      |
|-----------------|--------|------------------------------------------|---------------------|
| `apps/auth`     | 3001   | Autenticación y registro de usuarios     | MVC + Repository    |
| `apps/ms-mapas` | 3002   | Gestión y búsqueda de estacionamientos   | MVC + Repository    |
| `apps/ms-reservas` | 3003 | Creación y gestión de reservas          | DDD + Saga + CQRS   |
| `apps/web`      | 3000   | Frontend PWA + BFF                       | BFF + Observer      |

**Beneficios:**
- Cada servicio puede desplegarse, escalarse y actualizarse de forma independiente.
- Un fallo en `ms-reservas` no afecta la visualización del mapa.
- Equipos distintos pueden trabajar en paralelo sobre cada servicio.

### 3.2 Monorepo con Turborepo

El proyecto usa Turborepo para gestionar un monorepo con múltiples aplicaciones y paquetes compartidos:

```
Parkings-Together/
├── apps/
│   ├── web/          ← Next.js BFF + Frontend
│   ├── ms-mapas/     ← Microservicio de mapas
│   ├── ms-reservas/  ← Microservicio de reservas
│   └── auth/         ← Microservicio de autenticación
└── packages/
    └── supabase-db/  ← Paquete compartido (Singleton)
```

El paquete `@parkings/supabase-db` se comparte entre todos los microservicios, garantizando una única fuente de verdad para la configuración de la base de datos.

### 3.3 Repository Pattern como Patrón Arquitectural

A nivel arquitectural, el Repository Pattern establece una frontera entre el dominio de negocio y la infraestructura. En los tres microservicios, ningún archivo de servicio importa directamente `supabase`: todo acceso a datos pasa por la capa de repositorio. Esto hace que el sistema sea altamente testeable (los repositorios pueden ser mockeados) y fácil de migrar entre proveedores de datos.

---

## 4. Arquetipos de Aplicación

Un **arquetipo** en arquitectura de software es una plantilla estructural recurrente que define cómo organizar las capas de una aplicación. Cada app de este proyecto sigue un arquetipo distinto según su responsabilidad.

### 4.1 Arquetipo Microservicio REST (auth + ms-mapas)

```
Request HTTP
     ↓
route.js (Next.js API Route / Entry point)
     ↓
Controller (Validación de inputs, manejo de errores HTTP)
     ↓
Service (Lógica de negocio, orquestación)
     ↓
Repository (Acceso a datos Supabase)
     ↓
Base de Datos (PostgreSQL / Supabase)
```

**Implementación:**
- `apps/auth`: `app/api/v1/auth/[login|register]/route.js` → `AuthController` → `AuthService` → `AuthRepository`
- `apps/ms-mapas`: `app/api/v1/search/route.js` → `MapController` → `MapService` → `MapRepository`

### 4.2 Arquetipo DDD + Saga (ms-reservas)

```
Request HTTP
     ↓
route.js (Entry point)
     ↓
ReserveService.processSaga()
    ├── [Query CQRS] getParkingAvailability()
    ├── [Command] createReserve()
    └── [Compensación] updateParkingOccupancy() / deleteReserve()
         ↓
ReserveRepository (Acceso a datos)
```

Este arquetipo garantiza la consistencia eventual sin necesidad de transacciones distribuidas XA.

### 4.3 Arquetipo BFF (apps/web)

```
Componente React
     ↓
api.js (Facade)
     ↓
API Route /api/* (BFF — orquestación, autenticación, transformación)
     ↓
Microservicio externo o Supabase directo
```

El BFF es responsable de agregar el JWT del usuario, manejar timeouts y formatear las respuestas para el frontend.

---

## 5. Justificación de los Patrones Elegidos

### ¿Por qué Repository + Service Layer?
La arquitectura de microservicios require que cada servicio sea independientemente testeable. El Repository Pattern es la única forma de aislar la lógica de negocio del acceso a Supabase en un entorno serverless donde las conexiones de base de datos son costosas.

### ¿Por qué Saga + CQRS?
El proceso de reserva involucra dos operaciones atómicas sobre dos entidades distintas (crear reserva + actualizar ocupación). Sin Saga, una falla a mitad del proceso dejaría el sistema en estado inconsistente. CQRS permite que la lectura de disponibilidad y la escritura de reserva sean responsabilidades bien separadas.

### ¿Por qué Strategy para pagos?
Parkings Together debe soportar múltiples métodos de pago (efectivo, Webpay, simulado) sin que el endpoint de pagos cambie. El Strategy Pattern permite que el sistema evolucione hacia nuevos proveedores de pago sin modificar la API.

### ¿Por qué Observer?
La naturaleza del negocio (estacionamientos que cambian de estado en tiempo real) requiere que el frontend reaccione a eventos sin polling. Supabase Realtime implementa el patrón Observer sobre WebSockets de forma nativa, lo que se integra perfectamente con el modelo reactivo de React.

### ¿Por qué BFF?
Next.js y Vercel ejecutan el código en el edge. Las llamadas directas desde el navegador a microservicios externos generan problemas de CORS, latencia y exposición de URLs internas. El BFF centraliza estas preocupaciones en un único punto de control.

### ¿Por qué Singleton para el cliente de base de datos?
En entornos serverless (Vercel Edge Functions), cada función puede crear múltiples instancias del cliente Supabase si no se controla. El Singleton garantiza una única instancia por proceso, optimizando el pool de conexiones y reduciendo la latencia de cold start.

### ¿Por qué Facade?
Con cinco o más endpoints distintos y lógica de autenticación en cada llamada, exponer las URLs directamente a los componentes React generaría código repetitivo y frágil. La Facade `api.js` centraliza toda la lógica de comunicación en un solo módulo de 180 líneas que cubre mapas, reservas y favoritos.

---

## 6. Resumen

| # | Patrón                | Categoría        | Ubicación en el código                                      |
|---|-----------------------|------------------|-------------------------------------------------------------|
| 1 | Repository            | Arquitectural    | `apps/*/repositories/*.repository.js`                       |
| 2 | Service Layer         | Arquitectural    | `apps/*/services/*.service.js`                              |
| 3 | Controller (MVC)      | Arquitectural    | `apps/ms-mapas/src/controllers/`, `apps/auth/src/controllers/` |
| 4 | Saga + CQRS           | Comportamental   | `apps/ms-reservas/.../services/reserva.service.js`          |
| 5 | Observer              | Comportamental   | `apps/web/src/components/Navbar.js` (Supabase Realtime)     |
| 6 | Strategy              | Comportamental   | `apps/web/src/lib/payments.js`                              |
| 7 | Singleton             | Creacional       | `packages/supabase-db/index.js`                             |
| 8 | Facade                | Estructural      | `apps/web/src/lib/api.js`                                   |
| 9 | BFF                   | Arquitectural    | `apps/web/app/api/` (API Routes de Next.js)                 |

El uso combinado de estos patrones asegura que Parkings Together sea mantenible, escalable y testeable, cumpliendo con los estándares de calidad de software esperados en un proyecto de nivel profesional.
