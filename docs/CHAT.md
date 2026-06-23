# Chat conductor ↔ arrendador (mensajería en tiempo real)

Mensajería 1:1 entre el conductor y el arrendador de un estacionamiento, con
actualización en vivo (Supabase Realtime) y no-leídos.

## Flujo

```
Mapa → panel del estacionamiento → "Contactar arrendador"
   → POST /api/chat/conversaciones  (RPC iniciar_conversacion: get-or-create)
   → redirige a /mensajes?c=<id>
   → escribir → POST /api/chat/mensajes (RPC enviar_mensaje)
   → el otro usuario lo recibe al instante vía Realtime (tabla `mensajes`)
```

## Archivos

| Archivo | Rol |
|---|---|
| `app/mensajes/page.js` | UI del chat (lista de conversaciones + hilo, responsive, Realtime). |
| `app/api/chat/conversaciones/route.js` | GET lista · POST inicia conversación. |
| `app/api/chat/mensajes/route.js` | GET mensajes (+marca leída) · POST envía. |
| `src/lib/api.js` → `api.chat` | Cliente BFF. |
| `app/mapa/page.js` | Botón "Contactar arrendador" en el panel. |
| `src/components/Navbar.js` | Enlace "Mensajes" + badge de no-leídos en vivo. |

## Esquema (aplicado en Supabase)

Tablas `conversaciones` y `mensajes` con **RLS por participante** (solo el
conductor y el arrendador ven sus filas). Las escrituras pasan **solo** por RPCs
`SECURITY DEFINER` (validan participación y actualizan contadores), ejecutables
solo por el rol `authenticated`. Ambas tablas están en la publicación
`supabase_realtime`.

```sql
create table public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  estacionamiento_id integer references public.estacionamientos(id) on delete set null,
  conductor_id  uuid not null references auth.users(id) on delete cascade,
  arrendador_id uuid not null references auth.users(id) on delete cascade,
  conductor_nombre text, arrendador_nombre text, estacionamiento_nombre text,
  last_message text, last_message_at timestamptz default now(),
  conductor_unread integer not null default 0,
  arrendador_unread integer not null default 0,
  created_at timestamptz default now(),
  unique (estacionamiento_id, conductor_id, arrendador_id)
);

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz default now()
);
```

RPCs: `iniciar_conversacion(p_estacionamiento_id int)`,
`enviar_mensaje(p_conversacion_id uuid, p_body text)`,
`marcar_leida(p_conversacion_id uuid)`.

## Seguridad

- RLS activo en ambas tablas; un usuario solo lee conversaciones donde es
  conductor o arrendador.
- Sin políticas de INSERT/UPDATE directas: todo escribe vía RPC `SECURITY
  DEFINER` que verifica `auth.uid()` y la participación.
- `EXECUTE` de las RPCs revocado a `anon`/`public`; solo `authenticated`.
- El botón "Contactar" no aparece en tu propio estacionamiento (no puedes
  chatear contigo mismo; la RPC también lo rechaza).
