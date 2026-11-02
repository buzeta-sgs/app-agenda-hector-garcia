-- Pegar completo en Supabase > SQL Editor > Run

create table if not exists contactos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nombre text not null,
  telefono text,
  correo text,
  sector text,
  acepta boolean default true
);

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  titulo text not null,
  fecha date not null,
  hora text,
  lugar text,
  sector text
);

create table if not exists envios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  canal text not null,          -- 'wa' o 'mail'
  sector text,
  lugar text,
  mensaje text,
  cantidad int default 0
);
alter table envios add column if not exists evento uuid;   -- evento al que pertenece el aviso (historial del evento)
alter table envios add column if not exists tipo text;     -- invitar, hoy, cambio, suspendido, gracias

create table if not exists donaciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  donante text not null,
  fecha date not null,
  monto numeric default 0,
  moneda text default 'USD',    -- 'USD' o 'Bs'
  metodo text,
  nota text,
  comprobante text              -- ruta en el bucket "comprobantes"
);

create table if not exists equipo (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nombre text not null,
  apellido text,
  correo text,
  telefono text,
  cargo text,
  funciones text,
  bienvenida_en timestamptz     -- cuándo se le envió el correo de bienvenida
);
-- Organigrama de la campaña (árbol: padre = a quién reporta) y equipos aliados (aparte, no van en el árbol)
create table if not exists organigrama (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  cargo text not null,
  nombre text,
  apellido text,
  padre uuid references organigrama(id) on delete set null
);

create table if not exists aliados (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nombre text not null,
  apellido text,
  correo text,                  -- no sale en el PDF
  cargo text,
  partido text
);

-- ===== Módulo Elecciones =====

create table if not exists e_candidatos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nombre text not null,
  organizacion text,
  color text default '#1E5FA3',
  foto text,                    -- foto pequeña guardada como imagen en texto
  orden int default 0
);
alter table e_candidatos add column if not exists foto text;

create table if not exists e_centros (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nombre text not null,
  codigo text,
  sector text
);

create table if not exists e_mesas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  centro_id uuid not null references e_centros(id) on delete cascade,
  numero int not null,
  electores int,
  estado text not null default 'pendiente',   -- pendiente, cargada, verificada, incidencia
  votos jsonb not null default '{}'::jsonb,  -- { id_candidato: votos }
  nulos int,
  votantes int,
  observacion text,
  foto text,                                  -- ruta en el bucket "actas"
  cargado_en timestamptz,
  verificado_en timestamptz,
  unique (centro_id, numero)
);

create table if not exists e_testigos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nombre text not null,
  telefono text,
  centro_id uuid references e_centros(id) on delete cascade,
  mesa int,
  rol text,
  confirmado boolean default false
);

-- Permisos:
--   Todo el equipo (con sesión) ve y edita Campaña: contactos, eventos, envios.
--   Solo el administrador ve Equipo, Organigrama, Recaudación y Elecciones.
create or replace function es_admin() returns boolean
language sql stable as $f$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('psi.hectordavidgarcia@gmail.com')
$f$;

do $$
declare t text;
begin
  foreach t in array array['contactos','eventos','envios','donaciones','equipo','organigrama','aliados','e_candidatos','e_centros','e_mesas','e_testigos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists equipo on %I', t);
    execute format('drop policy if exists solo_admin on %I', t);
  end loop;
  foreach t in array array['contactos','eventos','envios'] loop
    execute format('create policy equipo on %I for all to authenticated using (true) with check (true)', t);
  end loop;
  foreach t in array array['donaciones','equipo','organigrama','aliados','e_candidatos','e_centros','e_mesas','e_testigos'] loop
    execute format('create policy solo_admin on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

-- Buckets privados: comprobantes de donaciones y fotos de actas (solo administrador)
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false), ('actas', 'actas', false)
on conflict (id) do nothing;

drop policy if exists "equipo comprobantes" on storage.objects;
drop policy if exists "admin archivos" on storage.objects;
create policy "admin archivos" on storage.objects for all to authenticated
  using (bucket_id in ('comprobantes', 'actas') and es_admin())
  with check (bucket_id in ('comprobantes', 'actas') and es_admin());
