/**
 * Seed script para crear usuarios del dashboard en Supabase Auth.
 *
 * Uso:  npx tsx scripts/seed-users.ts
 *
 * Crea (o actualiza) dos usuarios:
 *   1. samarluansl@gmail.com  (Samuel — admin)
 *   2. marta@samarluansl.com  (Marta  — admin)
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface UserSeed {
  email: string;
  password: string;
  name: string;
  role: string;
}

const USERS: UserSeed[] = [
  {
    email: 'samarluansl@gmail.com',
    password: 'Samarluansl2026odoo',
    name: 'Samuel',
    role: 'admin',
  },
  {
    email: 'marta@samarluansl.com',
    password: 'Samarluansl2026odoo',
    name: 'Marta',
    role: 'admin',
  },
];

async function seed() {
  console.log('🌱 Creando usuarios en Supabase Auth...\n');

  for (const u of USERS) {
    // Comprobar si ya existe
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((usr) => usr.email === u.email);

    if (found) {
      console.log(`  ⚠️  ${u.email} ya existe (id: ${found.id}). Actualizando contraseña...`);
      const { error } = await admin.auth.admin.updateUserById(found.id, {
        password: u.password,
        user_metadata: { name: u.name },
      });
      if (error) {
        console.error(`  ❌ Error actualizando ${u.email}:`, error.message);
      } else {
        console.log(`  ✅ ${u.email} actualizado.`);
      }
      continue;
    }

    // Crear usuario
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: { name: u.name },
    });

    if (error) {
      console.error(`  ❌ Error creando ${u.email}:`, error.message);
    } else {
      console.log(`  ✅ ${u.email} creado (id: ${data.user?.id})`);
    }
  }

  console.log('\n🎉 Seed completado.');
}

seed().catch(console.error);
