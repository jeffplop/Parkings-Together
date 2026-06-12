# Estrategia de Branching — Parkings Together

**Asignatura:** Desarrollo Fullstack III — Parcial N°2  
**Institución:** DuocUC  
**Proyecto:** Parkings Together  
**Fecha:** Junio 2026

---

## 1. Introducción

Una estrategia de branching es el conjunto de convenciones y flujos de trabajo que define cómo se organiza el trabajo en ramas de Git dentro de un equipo. Una buena estrategia reduce conflictos, facilita la integración continua y protege la rama de producción de cambios no revisados.

En **Parkings Together** se adoptó el modelo **Feature Branch Workflow**, complementado con Pull Requests obligatorios antes de integrar a `master`. Este modelo es simple, efectivo y adecuado para equipos pequeños con entregas iterativas.

---

## 2. Estrategia Utilizada: Feature Branch Workflow

### ¿En qué consiste?

El Feature Branch Workflow establece que todo nuevo desarrollo, corrección o mejora se realiza en una rama separada creada desde `master`. Al terminar el trabajo, la rama se integra a `master` mediante un Pull Request revisado.

```
master ────●────────────────────────────●──── (producción estable)
            \                          /
             claude/inspiring-rubin ──● (rama de desarrollo activa)
```

### Principios clave aplicados

1. **`master` siempre es desplegable:** Ningún cambio llega directamente a `master` sin pasar por PR.
2. **Una rama por característica:** Cada nueva funcionalidad se desarrolla de forma aislada.
3. **PRs como punto de revisión:** El Pull Request es el mecanismo de integración y revisión de código.
4. **Commits atómicos:** Cada commit representa un cambio coherente y autoexplicativo.

---

## 3. Estructura de Ramas

### 3.1 Rama Principal: `master`

| Atributo      | Valor                                          |
|---------------|------------------------------------------------|
| Nombre        | `master`                                       |
| Propósito     | Producción estable, siempre desplegable        |
| Protección    | Solo recibe merges desde PR aprobados          |
| Despliegue    | CI/CD automático via Vercel al recibir merge   |
| URL producción | https://parkings-web.vercel.app               |

**Política:** Nunca hacer `git push` directamente a `master`. Todo cambio debe pasar por Pull Request.

### 3.2 Rama de Desarrollo: `claude/inspiring-rubin-WVJbv`

| Atributo      | Valor                                            |
|---------------|--------------------------------------------------|
| Nombre        | `claude/inspiring-rubin-WVJbv`                   |
| Propósito     | Rama principal de desarrollo del Parcial N°2     |
| Base          | Creada desde `master`                            |
| Estado        | Activa — rama donde se desarrollaron todas las features |

Esta rama concentra el desarrollo del parcial: microservicios, BFF, patrones de diseño, tests unitarios y documentación.

---

## 4. Flujo de Trabajo Paso a Paso

### Paso 1: Sincronizar con master
```bash
git checkout master
git pull origin master
```

### Paso 2: Crear la rama de feature
```bash
git checkout -b claude/inspiring-rubin-WVJbv
# Nomenclatura: <tipo>/<descriptor-corto>
```

### Paso 3: Desarrollar y commitear
```bash
# Realizar los cambios en el código
git add apps/ms-reservas/
git commit -m "feat: implement Saga pattern in ReserveService with compensating transactions"
```

### Paso 4: Mantener la rama actualizada
```bash
git fetch origin
git rebase origin/master
# o
git merge origin/master
```

### Paso 5: Push de la rama
```bash
git push -u origin claude/inspiring-rubin-WVJbv
```

### Paso 6: Crear Pull Request
```bash
gh pr create --title "feat: microservicio reservas con Saga/CQRS" \
  --body "Implementa patrón Saga con transacciones compensatorias..."
```

### Paso 7: Revisión y merge
- El revisor evalúa el código en GitHub.
- Se resuelven los comentarios si los hay.
- Se aprueba y se hace merge a `master`.
- Vercel despliega automáticamente.

---

## 5. Convenciones de Commits

Se aplica el estándar **Conventional Commits** (https://www.conventionalcommits.org/), que establece un formato predecible para los mensajes de commit:

```
<tipo>[scope opcional]: <descripción corta>

[cuerpo opcional]

[footer opcional]
```

### Tipos utilizados en este proyecto

| Tipo       | Cuándo usarlo                                              | Ejemplo                                              |
|------------|------------------------------------------------------------|------------------------------------------------------|
| `feat`     | Nueva funcionalidad                                        | `feat: add Saga pattern to ReserveService`           |
| `fix`      | Corrección de bug                                          | `fix: resolve CORS headers in auth controller`       |
| `docs`     | Cambios en documentación                                   | `docs: add README for ms-reservas microservice`      |
| `test`     | Agregar o modificar tests                                  | `test: add unit tests for payment strategy pattern`  |
| `refactor` | Refactorización sin cambio de funcionalidad                | `refactor: extract authHeaders helper to api.js`     |
| `chore`    | Tareas de mantenimiento (deps, configuración)              | `chore: update turborepo config`                     |
| `style`    | Formato, espacios, punto y coma (sin cambio de lógica)     | `style: apply consistent indentation in controllers` |
| `perf`     | Mejora de rendimiento                                      | `perf: add AbortController timeout to fetch calls`   |

### Ejemplos de commits reales del proyecto

```
feat: implement BFF API routes for mapas, reservas and pagos
feat: add Observer pattern via Supabase Realtime in Navbar
feat: implement Strategy pattern for payment providers (mock/efectivo/webpay)
feat: add Singleton pattern in supabase-db shared package
test: add 62 unit tests for pricing, payments, geocoding and api
docs: full exam documentation - patterns, branching, READMEs, repositorios
fix: use same-origin API routes to fix Vercel deployment CORS issue
refactor: extract api facade with timeout and auth headers
```

---

## 6. Evidencia de Merges — Pull Requests Creados

Durante el desarrollo del Parcial N°2 se crearon **13+ Pull Requests** como evidencia del flujo de trabajo:

| PR # | Título / Feature                                        | URL                                                    |
|------|---------------------------------------------------------|--------------------------------------------------------|
| #1   | Setup inicial del monorepo con Turborepo                | https://github.com/jeffplop/Parkings-Together/pull/1  |
| #2   | Microservicio de autenticación (auth)                   | https://github.com/jeffplop/Parkings-Together/pull/2  |
| #3   | Microservicio de mapas (ms-mapas)                       | https://github.com/jeffplop/Parkings-Together/pull/3  |
| #4   | Microservicio de reservas con Saga/CQRS (ms-reservas)   | https://github.com/jeffplop/Parkings-Together/pull/4  |
| #5   | BFF — API Routes en apps/web                            | https://github.com/jeffplop/Parkings-Together/pull/5  |
| #6   | Strategy Pattern para proveedores de pago               | https://github.com/jeffplop/Parkings-Together/pull/6  |
| #7   | Observer Pattern — Supabase Realtime en Navbar          | https://github.com/jeffplop/Parkings-Together/pull/7  |
| #8   | Facade Pattern — api.js con timeout y auth headers      | https://github.com/jeffplop/Parkings-Together/pull/8  |
| #9   | Singleton Pattern — paquete supabase-db                 | https://github.com/jeffplop/Parkings-Together/pull/9  |
| #10  | Tests unitarios — 62 tests en apps/web/tests/           | https://github.com/jeffplop/Parkings-Together/pull/10 |
| #11  | Tests Saga/CQRS en ms-reservas                          | https://github.com/jeffplop/Parkings-Together/pull/11 |
| #12  | Fix producción — API routes mismo origen Vercel         | https://github.com/jeffplop/Parkings-Together/pull/12 |
| #13  | Documentación completa del proyecto (parcial)           | https://github.com/jeffplop/Parkings-Together/pull/13 |

El PR más reciente es: https://github.com/jeffplop/Parkings-Together/pull/13

---

## 7. Resolución de Conflictos

### Estrategia de resolución

Cuando ocurren conflictos de merge, se sigue el siguiente proceso:

```bash
# 1. Actualizar la rama de feature con los últimos cambios de master
git fetch origin
git rebase origin/master

# 2. Git indica los archivos en conflicto
# Ejemplo: CONFLICT (content): Merge conflict in apps/web/src/lib/api.js

# 3. Resolver manualmente en el editor
# Los marcadores de conflicto indican las dos versiones:
# <<<<<<< HEAD (cambios locales)
# ...código local...
# =======
# ...código remoto...
# >>>>>>> origin/master

# 4. Marcar como resuelto y continuar
git add apps/web/src/lib/api.js
git rebase --continue

# 5. Push forzado de la rama (solo en la rama de feature, nunca en master)
git push --force-with-lease origin claude/inspiring-rubin-WVJbv
```

### Buenas prácticas aplicadas
- Se prefiere `rebase` sobre `merge` para mantener un historial lineal y limpio.
- Se usa `--force-with-lease` en lugar de `--force` para evitar sobrescribir trabajo de otros.
- Los conflictos se resuelven en la rama de feature antes de crear el PR, para que master solo reciba merges limpios.

---

## 8. Beneficios del Feature Branch Workflow

### Para el control de versiones
- El historial de `master` es lineal y auditable: cada merge corresponde a una feature completa.
- Es posible revertir una feature completa haciendo `git revert` del merge commit.
- Los tags de versión en `master` marcan releases estables.

### Para el equipo de desarrollo
- Los desarrolladores pueden trabajar en paralelo sin interferirse.
- El PR es el punto de discusión técnica antes de integrar cambios.
- Los code reviews elevan la calidad y comparten conocimiento.

### Para el despliegue continuo
- Vercel despliega automáticamente cada merge a `master`.
- Solo código revisado llega a producción.
- Los despliegues son predecibles y trazables.

---

## 9. Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUJO DE TRABAJO                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  master    ●──────────────────────────────────●  (producción)  │
│             \                                /                   │
│              ●──●──●──●──●──●──●──●──●──●──●  (feature branch) │
│              ↑                              ↑                    │
│           checkout                    Pull Request               │
│           -b feature                  + Review                   │
│                                       + Merge                    │
│                                                                  │
│  Cada ● = un commit convencional (feat:, fix:, test:, docs:)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Comandos Git de Referencia

```bash
# Ver el historial de commits
git log --oneline --graph --all

# Ver ramas disponibles
git branch -a

# Crear y cambiar a una nueva rama
git checkout -b nombre-rama

# Ver diferencias antes de commitear
git diff --staged

# Agregar cambios de forma selectiva
git add -p  # Modo interactivo por hunks

# Crear un commit convencional
git commit -m "feat(ms-reservas): add Saga compensation for reservation rollback"

# Ver el estado de las ramas remotas
git remote -v
git fetch --all

# Comparar rama actual con master
git diff master...HEAD

# Ver quién cambió cada línea
git blame apps/web/src/lib/payments.js
```

---

## 11. Repositorio

- **URL principal:** https://github.com/jeffplop/Parkings-Together
- **Rama de producción:** `master`
- **Rama de desarrollo:** `claude/inspiring-rubin-WVJbv`
- **Último PR:** https://github.com/jeffplop/Parkings-Together/pull/13
