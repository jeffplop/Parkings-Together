# Entrega Parcial 3 — Parkings Together

Paquete de entregables de documentación. Todos los documentos están disponibles
en formato editable (`.docx`) y en `.pdf` listo para entregar.

| # | Entregable | Archivos |
|---|---|---|
| 1 | **Diagrama de arquitectura** | [`01_Diagrama_Arquitectura.pdf`](./01_Diagrama_Arquitectura.pdf) · [`.docx`](./01_Diagrama_Arquitectura.docx) · [`img/arquitectura.png`](./img/arquitectura.png) |
| 2 | **Descripción de la persistencia** | [`02_Descripcion_Persistencia.pdf`](./02_Descripcion_Persistencia.pdf) · [`.docx`](./02_Descripcion_Persistencia.docx) |
| 3 | **Informe de pruebas unitarias** | [`03_Informe_Pruebas.pdf`](./03_Informe_Pruebas.pdf) · [`.docx`](./03_Informe_Pruebas.docx) |

## Entregables relacionados (fuera de esta carpeta)

| Requisito de la rúbrica | Ubicación |
|---|---|
| API REST (Swagger / OpenAPI + Postman) | [`docs/api/`](../docs/api/) |
| Links de los repositorios | [`repositorios.txt`](../repositorios.txt) |
| Frontend (Next.js + README) | [`apps/web/`](../apps/web/) |
| Microservicios (Controller→Service→Repository) | [`apps/auth/`](../apps/auth/), [`apps/ms-mapas/`](../apps/ms-mapas/), [`apps/ms-reservas/`](../apps/ms-reservas/) |
| Persistencia (Stored Procedures PL/pgSQL) | [`sql/004_security_hardening.sql`](../sql/004_security_hardening.sql), [`supabase_schema.sql`](../supabase_schema.sql) |
| Cobertura (guía + comando) | `03_Informe_Pruebas` (sección 8) y `npx jest --coverage` |

## Notas

- El informe de pruebas refleja **únicamente** las pruebas que existen y pasan en
  el repositorio (10 pruebas, 3 suites, 100 % aprobadas). Es verificable clonando
  el repo y ejecutando los comandos de su sección 8.
- El diagrama de arquitectura se generó como PNG y se incrustó en el PDF.
