-- ============================================================================
-- 011_seed_estacionamientos_v2.sql
-- ----------------------------------------------------------------------------
-- Datos de demostración v2: RM (15 comunas) + Rancagua/Machalí/Graneros.
--
-- · Todas las plazas tienen fotos reales de estacionamientos (Unsplash CDN,
--   sin CORS, sirve jpg/webp según Accept del navegador). Imágenes coherentes
--   con el contexto (garajes, calles con autos), no fotos aleatorias.
-- · Idempotente (NOT EXISTS guard).
-- · user_id = NULL → plazas del sistema, no aparecen en dashboards de arrendadores.
-- · Para borrar todo el demo:
--     DELETE FROM public.estacionamientos WHERE user_id IS NULL;
-- ============================================================================

INSERT INTO public.estacionamientos
  (nombre, arrendador, lat, lng, coordenadas, comuna, direccion, descripcion,
   precio_hora, total_spots, occupied_spots, es_pmr, rating, reviews_count,
   allowed_vehicle_types, activo, photos)
SELECT
  d.nombre, d.arrendador, d.lat, d.lng,
  ST_SetSRID(ST_MakePoint(d.lng, d.lat), 4326),
  d.comuna, d.direccion, d.descripcion,
  d.precio_hora, d.total_spots, d.occupied_spots, d.es_pmr, d.rating, d.reviews_count,
  d.veh, true, d.photos
FROM (VALUES
  -- SANTIAGO CENTRO
  ('Parking Plaza de Armas','Estacionamientos Centro SpA',-33.4372,-70.6506,'Santiago','Compañía 1110, Santiago Centro','Estacionamiento techado a pasos de la Plaza de Armas y el Metro. Vigilancia 24/7 y cámaras de seguridad.',2000,20,12,true,4.6::real,84,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1545179605-1296651e9d0d?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop']::text[]),
  ('Estacionamiento Barrio Italia','Italia Parking SpA',-33.4420,-70.6370,'Santiago','Av. Italia 1200, Santiago','En pleno Barrio Italia, zona cultural y gastronómica. Seguro y techado.',1500,14,6,false,4.4::real,52,ARRAY['car','motorcycle','bicycle']::text[],ARRAY['https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&q=80&auto=format&fit=crop']::text[]),
  -- PROVIDENCIA
  ('Estacionamiento Costanera','Parking Providencia Ltda.',-33.4180,-70.6060,'Providencia','Av. Andrés Bello 2425, Providencia','Subterráneo amplio junto al Costanera Center. Ideal para compras y oficinas.',2500,30,25,false,4.4::real,156,ARRAY['car']::text[],ARRAY['https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80&auto=format&fit=crop']::text[]),
  ('Parking Manuel Montt','Providencia Norte Parking',-33.4260,-70.6150,'Providencia','Av. Providencia 1880, Providencia','A pasos del Metro Manuel Montt. Ideal para oficinas y comercio de la zona.',2200,18,10,true,4.3::real,73,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1597007066704-67bf2068d5b2?w=800&q=80&auto=format&fit=crop']::text[]),
  -- LAS CONDES
  ('Parking El Golf','Las Condes Premium Parking',-33.4150,-70.5840,'Las Condes','Av. Apoquindo 3000, Las Condes','Estacionamiento premium en Sanhattan. Plazas amplias y carga para vehículos eléctricos.',3000,15,5,true,4.8::real,67,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1597007066704-67bf2068d5b2?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80&auto=format&fit=crop']::text[]),
  ('Parking Escuela Militar','Las Condes Sur Parking',-33.4090,-70.5950,'Las Condes','Av. Marchant Pereira 150, Las Condes','Cerca del Metro Escuela Militar. Tranquilo y seguro para el sector oriente.',2800,12,3,false,4.5::real,44,ARRAY['car']::text[],ARRAY['https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1545179605-1296651e9d0d?w=800&q=80&auto=format&fit=crop']::text[]),
  -- ÑUÑOA
  ('Plaza Ñuñoa Parking','Vecinos de Ñuñoa SpA',-33.4560,-70.5980,'Ñuñoa','Av. Irarrázaval 3400, Ñuñoa','A pasos de Plaza Ñuñoa, bares y restaurantes. Perfecto para salir de noche.',1800,12,8,false,4.3::real,42,ARRAY['car','motorcycle','bicycle']::text[],ARRAY['https://images.unsplash.com/photo-1545179605-1296651e9d0d?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop']::text[]),
  -- VITACURA
  ('Parking Bicentenario','Vitacura Parking',-33.3980,-70.5800,'Vitacura','Av. Bicentenario 3800, Vitacura','Junto al Parque Bicentenario. Ambiente seguro y arbolado, ideal para deportistas.',2800,10,3,true,4.7::real,38,ARRAY['car','bicycle']::text[],ARRAY['https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&q=80&auto=format&fit=crop']::text[]),
  -- MAIPÚ
  ('Estacionamiento Plaza Maipú','Maipú Centro Parking',-33.5167,-70.7580,'Maipú','Av. 5 de Abril 100, Maipú','Amplio estacionamiento frente a la Plaza de Maipú y el Templo Votivo.',1200,25,10,false,4.1::real,91,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80&auto=format&fit=crop']::text[]),
  -- LA FLORIDA
  ('Mall Parking La Florida','Plaza Vespucio Parking',-33.5170,-70.5990,'La Florida','Av. Vicuña Mackenna 6100, La Florida','Centro comercial más grande del sector. Conexión directa al Metro Bellavista.',1500,40,30,true,4.2::real,203,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1597007066704-67bf2068d5b2?w=800&q=80&auto=format&fit=crop']::text[]),
  -- PUENTE ALTO
  ('Parking Centro Puente Alto','Cordillera Parking',-33.6110,-70.5760,'Puente Alto','Av. Concha y Toro 1500, Puente Alto','Económico en el centro de Puente Alto, cerca de servicios municipales.',1000,18,6,false,3.9::real,55,ARRAY['car','motorcycle','bicycle','scooter']::text[],ARRAY['https://images.unsplash.com/photo-1597007066704-67bf2068d5b2?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80&auto=format&fit=crop']::text[]),
  -- RECOLETA
  ('Estacionamiento Patronato','Barrio Patronato SpA',-33.4280,-70.6420,'Recoleta','Loreto 200, Recoleta','En pleno barrio comercial Patronato. Ideal para compras de ropa y textiles.',1300,14,9,false,4.0::real,78,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1545179605-1296651e9d0d?w=800&q=80&auto=format&fit=crop']::text[]),
  -- ESTACIÓN CENTRAL
  ('Parking USACH','Estación Central Parking',-33.4520,-70.6820,'Estación Central','Av. Libertador B. O''Higgins 3363, Estación Central','Frente a la Universidad de Santiago y la Estación Central de trenes.',1400,22,15,true,4.1::real,112,ARRAY['car','bicycle','scooter']::text[],ARRAY['https://images.unsplash.com/photo-1545179605-1296651e9d0d?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop']::text[]),
  -- SAN BERNARDO
  ('Plaza San Bernardo Parking','Maipo Parking Ltda.',-33.5930,-70.6990,'San Bernardo','Eyzaguirre 500, San Bernardo','Estacionamiento familiar junto a la Plaza de San Bernardo. Tarifa por día.',900,16,4,false,4.2::real,47,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&q=80&auto=format&fit=crop']::text[]),
  -- PEÑALOLÉN
  ('Parking Grange','Peñalolén Oriente Parking',-33.4880,-70.5500,'Peñalolén','Av. Tobalaba 8200, Peñalolén','Tranquilo en sector residencial, cercano al Parque Peñalolén y colegios.',1600,10,2,true,4.5::real,29,ARRAY['car','bicycle']::text[],ARRAY['https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80&auto=format&fit=crop']::text[]),
  -- RANCAGUA / O'HIGGINS
  ('Parking Plaza de los Héroes','Rancagua Centro Parking',-34.1708,-70.7444,'Rancagua','Estado 285, Rancagua','Techado en el corazón de Rancagua, a pasos de la Plaza de los Héroes. Vigilancia 24/7.',1200,20,8,true,4.3::real,61,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1597007066704-67bf2068d5b2?w=800&q=80&auto=format&fit=crop']::text[]),
  ('Estacionamiento Terminal Rancagua','OHiggins Bus Terminal Parking',-34.1755,-70.7400,'Rancagua','Av. Salinas 1165, Rancagua','Junto al Terminal de Buses de Rancagua. Ideal para viajeros y visitas al centro.',1000,30,14,false,4.0::real,88,ARRAY['car','motorcycle','bicycle']::text[],ARRAY['https://images.unsplash.com/photo-1597007066704-67bf2068d5b2?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80&auto=format&fit=crop']::text[]),
  ('Parking Mall Portal Rancagua','Portal Rancagua SpA',-34.1630,-70.7370,'Rancagua','Av. San Martín 255, Rancagua','Estacionamiento del Mall Portal Rancagua. Acceso cubierto y fácil desde ruta 5 Sur.',1400,40,22,true,4.5::real,134,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1545179605-1296651e9d0d?w=800&q=80&auto=format&fit=crop']::text[]),
  ('Parking Estadio El Teniente','Machalí Parking',-34.1590,-70.7220,'Machalí','Av. Los Libertadores 1500, Machalí','Cerca del Estadio El Teniente y zona residencial de Machalí. Tarifas accesibles.',900,18,5,false,4.1::real,33,ARRAY['car','motorcycle','bicycle']::text[],ARRAY['https://images.unsplash.com/photo-1545179605-1296651e9d0d?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop']::text[]),
  ('Estacionamiento Graneros Centro','Graneros Parking Ltda.',-34.0670,-70.7280,'Graneros','Calle Balmaceda 320, Graneros','Tranquilo en el centro de Graneros, con acceso a comercio local y servicios de la comuna.',800,12,3,false,3.9::real,21,ARRAY['car','motorcycle']::text[],ARRAY['https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&q=80&auto=format&fit=crop','https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&q=80&auto=format&fit=crop']::text[])
) AS d(nombre,arrendador,lat,lng,comuna,direccion,descripcion,precio_hora,total_spots,occupied_spots,es_pmr,rating,reviews_count,veh,photos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.estacionamientos e WHERE e.nombre = d.nombre AND e.comuna = d.comuna
);
