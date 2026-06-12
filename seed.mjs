import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en apps/web/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log("Creando cuentas de prueba en Supabase...");

  const testAccounts = [
    { email: 'arrendador@test.com', password: 'password123', nombre: 'Arrendador Test', rol: 'arrendador' },
    { email: 'usuario@test.com', password: 'password123', nombre: 'Conductor Test', rol: 'cliente' }
  ];

  for (const account of testAccounts) {
    const { data, error } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: {
        data: {
          nombre: account.nombre,
          rol: account.rol
        }
      }
    });

    if (error) {
      console.error(`❌ Error al crear cuenta ${account.email}:`, error.message);
    } else {
      console.log(`✅ Cuenta creada: ${account.email} / ${account.password} (Rol: ${account.rol})`);
      
      // Insert profile explicitly in seed just in case trigger fails
      if (data?.user) {
        await supabase.from('perfiles').insert({
          id: data.user.id,
          nombre: account.nombre,
          rol: account.rol
        }).select();
      }
    }
  }

  console.log("Proceso terminado.");
}

seed();
