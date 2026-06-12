// Regiones y comunas de Chile para el selector de filtro de búsqueda.
// Las coordenadas aproximadas sirven para auto-detectar la región desde GPS.

export const REGIONES = [
  {
    id: 'rm',
    nombre: 'Región Metropolitana',
    latMin: -33.9, latMax: -33.0, lngMin: -71.2, lngMax: -70.2,
    comunas: [
      'Santiago','Providencia','Las Condes','Ñuñoa','Vitacura','La Reina',
      'Maipú','Pudahuel','Quilicura','Huechuraba','Recoleta','Independencia',
      'Cerro Navia','Lo Prado','Pudahuel','Renca','Conchalí','Quinta Normal',
      'Estación Central','Cerrillos','Maipú','Padre Hurtado','Peñaflor',
      'Talagante','El Monte','Isla de Maipo','Buin','Paine','San Bernardo',
      'El Bosque','La Pintana','San Ramón','La Granja','Lo Espejo','Pedro Aguirre Cerda',
      'Lo Barnechea','Peñalolén','La Florida','San Miguel','San Joaquín','La Cisterna',
      'El Bosque','Puente Alto','La Pintana','Pirque','San José de Maipo',
    ],
  },
  {
    id: 'valpo',
    nombre: 'Valparaíso',
    latMin: -33.8, latMax: -32.0, lngMin: -71.8, lngMax: -70.4,
    comunas: [
      'Valparaíso','Viña del Mar','Quilpué','Villa Alemana','Concón',
      'San Antonio','Cartagena','El Tabo','El Quisco','Algarrobo',
      'Casablanca','San Felipe','Los Andes','Quillota','La Calera',
      'Limache','Olmué','La Cruz','Llaillay','Putaendo','Santa María',
    ],
  },
  {
    id: 'ohiggins',
    nombre: "O'Higgins",
    latMin: -35.0, latMax: -33.8, lngMin: -71.8, lngMax: -70.0,
    comunas: [
      'Rancagua','Machalí','Graneros','Codegua','Mostazal','San Fernando',
      'Santa Cruz','Pichilemu','Peumo','Las Cabras','San Vicente',
    ],
  },
  {
    id: 'maule',
    nombre: 'Maule',
    latMin: -36.5, latMax: -35.0, lngMin: -72.5, lngMax: -70.5,
    comunas: [
      'Talca','Curicó','Linares','Constitución','San Javier','Parral',
      'Cauquenes','Molina','Longaví','Retiro','Villa Alegre',
    ],
  },
  {
    id: 'nuble',
    nombre: 'Ñuble',
    latMin: -37.3, latMax: -36.5, lngMin: -73.0, lngMax: -71.0,
    comunas: [
      'Chillán','Chillán Viejo','San Carlos','Bulnes','Coihueco',
      'El Carmen','Pemuco','Pinto','Quillón','Ránquil','San Ignacio',
    ],
  },
  {
    id: 'biobio',
    nombre: 'Biobío',
    latMin: -38.5, latMax: -37.3, lngMin: -74.0, lngMax: -71.0,
    comunas: [
      'Concepción','Talcahuano','San Pedro de la Paz','Hualpén','Penco',
      'Tomé','Coronel','Lota','Lebu','Los Ángeles','Nacimiento',
      'Mulchén','Yumbel','Cabrero','Chiguayante',
    ],
  },
  {
    id: 'araucania',
    nombre: 'La Araucanía',
    latMin: -39.8, latMax: -38.5, lngMin: -73.5, lngMax: -71.0,
    comunas: [
      'Temuco','Padre Las Casas','Villarrica','Pucón','Angol','Victoria',
      'Lautaro','Nueva Imperial','Carahue','Cunco','Pitrufquén',
    ],
  },
  {
    id: 'losrios',
    nombre: 'Los Ríos',
    latMin: -40.5, latMax: -39.8, lngMin: -73.5, lngMax: -71.5,
    comunas: [
      'Valdivia','La Unión','Río Bueno','Corral','Mariquina',
      'Máfil','Lanco','Los Lagos','Panguipulli','Futrono',
    ],
  },
  {
    id: 'loslagos',
    nombre: 'Los Lagos',
    latMin: -43.5, latMax: -40.5, lngMin: -73.8, lngMax: -71.5,
    comunas: [
      'Puerto Montt','Osorno','Puerto Varas','Castro','Ancud',
      'Calbuco','Fresia','Frutillar','Llanquihue','Maullín',
      'Purranque','Río Negro','San Pablo','Quellón',
    ],
  },
  {
    id: 'atacama',
    nombre: 'Atacama',
    latMin: -29.0, latMax: -25.0, lngMin: -71.0, lngMax: -68.0,
    comunas: [
      'Copiapó','Caldera','Tierra Amarilla','Chañaral','Diego de Almagro',
      'Vallenar','Alto del Carmen','Freirina','Huasco',
    ],
  },
  {
    id: 'coquimbo',
    nombre: 'Coquimbo',
    latMin: -32.3, latMax: -29.0, lngMin: -71.5, lngMax: -69.5,
    comunas: [
      'La Serena','Coquimbo','Ovalle','Illapel','Los Vilos',
      'Salamanca','Vicuña','Andacollo','Monte Patria','Punitaqui',
    ],
  },
  {
    id: 'tarapaca',
    nombre: 'Tarapacá',
    latMin: -21.5, latMax: -18.5, lngMin: -70.5, lngMax: -68.5,
    comunas: ['Iquique','Alto Hospicio','Pozo Almonte','Pica','Huara','Colchane','Camiña'],
  },
  {
    id: 'antofagasta',
    nombre: 'Antofagasta',
    latMin: -25.0, latMax: -21.5, lngMin: -70.5, lngMax: -67.0,
    comunas: ['Antofagasta','Calama','Tocopilla','Mejillones','Sierra Gorda','Taltal','María Elena','Ollagüe','San Pedro de Atacama'],
  },
  {
    id: 'arica',
    nombre: 'Arica y Parinacota',
    latMin: -19.5, latMax: -17.5, lngMin: -70.5, lngMax: -69.0,
    comunas: ['Arica','Camarones','Putre','General Lagos'],
  },
  {
    id: 'aysen',
    nombre: 'Aysén',
    latMin: -49.0, latMax: -43.5, lngMin: -75.5, lngMax: -71.0,
    comunas: ['Coyhaique','Aysén','Chile Chico','Cisnes','Guaitecas','Lago Verde','Río Ibáñez','Tortel','O\'Higgins'],
  },
  {
    id: 'magallanes',
    nombre: 'Magallanes',
    latMin: -56.0, latMax: -49.0, lngMin: -75.5, lngMax: -66.0,
    comunas: ['Punta Arenas','Puerto Natales','Porvenir','Puerto Williams','Primavera','Río Verde','San Gregorio','Timaukel','Torres del Paine'],
  },
];

/**
 * Devuelve la región que contiene las coordenadas dadas, o null si no hay match.
 */
export function detectarRegion(lat, lng) {
  return REGIONES.find(r =>
    lat >= r.latMin && lat <= r.latMax &&
    lng >= r.lngMin && lng <= r.lngMax
  ) || null;
}
