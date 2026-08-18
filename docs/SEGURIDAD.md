# Seguridad — estado y endurecimiento pendiente

Resumen del estado de seguridad del proyecto y los dos ajustes de configuración
que quedan por aplicar **desde el panel de Supabase** (no son cambios de código).

## ✅ Lo que ya está correcto

- **RLS activo** en las tablas de negocio (`reservas`, `payments`, `favoritos`,
  `conversaciones`, `mensajes`, …): cada usuario solo ve sus propias filas.
- **Escrituras vía RPC `SECURITY DEFINER`** con `search_path` fijo y `EXECUTE`
  revocado a `anon`/`public` (solo `authenticated`). Aplica al chat
  (`iniciar_conversacion`, `enviar_mensaje`, `marcar_leida`) y a las reservas.
- **Pagos validados en el servidor**: el monto se contrasta contra
  `reservas.precio_total` y la propiedad de la reserva (anti-manipulación). Los
  datos de tarjeta **nunca** tocan el servidor (los captura Transbank).
- **Claves sensibles** (service role, API keys) solo en variables de entorno de
  Vercel, fuera del repositorio.
- Sin errores en runtime; sin errores en consola del cliente (auditado).

## ⚠️ Pendiente de endurecer (2 ajustes en el panel de Supabase)

> Son configuración de infraestructura, no código. Requieren tu mano en el panel.

### 1. Buckets públicos permiten *listar* archivos

Los buckets `avatars`, `parking-photos` y `review-photos` tienen una política
`SELECT` amplia que permite a un cliente **enumerar todos los archivos**. La app
**no** usa esa capacidad (solo `upload()` + `getPublicUrl()`), así que quitarla
es seguro: las fotos se siguen viendo por URL pública (los buckets son públicos).

**Supabase → SQL Editor:**
```sql
drop policy if exists "avatars_select_public"     on storage.objects;
drop policy if exists "parking_photos_select_own" on storage.objects;
drop policy if exists "review_photos_select_own"  on storage.objects;
```
Después, abre la ficha de un estacionamiento y confirma que su foto se ve (debe
verse, porque el bucket es público y el acceso por URL no depende de esa política).

Ref: <https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing>

### 2. Protección de contraseñas filtradas

Supabase Auth puede rechazar contraseñas comprometidas (comparándolas contra
HaveIBeenPwned). Hoy está desactivado.

**Supabase → Authentication → Providers/Settings → activar "Leaked password
protection"** (un toggle).

Ref: <https://supabase.com/docs/guides/auth/password-security>

## Notas (avisos de bajo riesgo, informativos)

- `spatial_ref_sys` sin RLS y `postgis`/`pg_trgm` en el esquema `public`: son
  tablas/extensiones del sistema de PostGIS; comportamiento estándar, riesgo bajo.
- Varias funciones aparecen como `SECURITY DEFINER` ejecutables por
  `authenticated`: es intencional (son las RPCs de la app).
