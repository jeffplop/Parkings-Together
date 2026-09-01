// Configuración del basemap de Leaflet, centralizada para Map.js y MiniMap.js.
//
// Por qué existe este archivo:
//   Hasta ahora ambos componentes usaban los tiles de CARTO
//   (`basemaps.cartocdn.com/dark_all`). Desde 2025 CARTO exige una API key para
//   esos basemaps y, sin ella, devuelve los tiles con una marca de agua
//   "API KEY REQUIRED" incrustada — que es lo que se veía sobre todo el mapa.
//
// Solución:
//   Se usa por defecto **Esri World Dark Gray Base**, que mantiene el aspecto
//   oscuro del sitio, no requiere API key y no lleva marca de agua. Se puede
//   sobreescribir con variables de entorno si algún día se quiere volver a CARTO
//   (con key) u otro proveedor:
//     NEXT_PUBLIC_MAP_TILES_URL
//     NEXT_PUBLIC_MAP_TILES_ATTRIBUTION

export const MAP_TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ||
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

export const MAP_TILES_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILES_ATTRIBUTION ||
  'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ';

// Opciones comunes del TileLayer. `subdomains` es inofensivo si la URL no usa
// el marcador `{s}` (Leaflet simplemente lo ignora), así que sirve tanto para
// Esri (sin subdominios) como para un CARTO con `{s}` si se configura por env.
export const MAP_TILES_OPTIONS = {
  maxZoom: 20,
  attribution: MAP_TILES_ATTRIBUTION,
  subdomains: 'abcd',
};
