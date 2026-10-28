-- ============================================================
-- CallM: Family Circle
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run once on a fresh project.
-- ============================================================

-- ---------- Tables ----------

-- A family circle (e.g. "Keluarga Nizam"), joined with a 6-letter code.
create table public.circles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  code        text not null unique,
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- Who is in each circle (one row per sibling's phone).
create table public.members (
  circle_id     uuid not null references public.circles(id) on delete cascade,
  user_id       uuid not null default auth.uid(),
  display_name  text not null check (char_length(display_name) between 1 and 40),
  joined_at     timestamptz not null default now(),
  primary key (circle_id, user_id)
);

-- The people the family keeps in touch with (Mak, Abah, Tok...).
create table public.people (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text not null default '',
  every_days  int  not null default 5 check (every_days between 1 and 60),
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (id, circle_id)
);

-- Every call anyone in the family makes. One row per caller, per person, per day.
create table public.calls (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null,
  person_id   uuid not null,
  user_id     uuid not null default auth.uid(),
  day         date not null,
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  -- the person must belong to the same circle
  foreign key (person_id, circle_id) references public.people(id, circle_id) on delete cascade,
  unique (person_id, user_id, day)
);

-- Shared news & things to tell / follow-ups.
create table public.news (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles(id) on delete cascade,
  person_id   uuid references public.people(id) on delete set null,
  user_id     uuid not null default auth.uid(),
  text        text not null check (char_length(text) between 1 and 300),
  done        boolean not null default false,
  due         date,
  created_at  timestamptz not null default now()
);

create index on public.calls (circle_id, day desc);
create index on public.news (circle_id, created_at desc);
create index on public.members (user_id);

-- ---------- Helper: am I in this circle? ----------
create or replace function public.is_member(c uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.members where circle_id = c and user_id = auth.uid());
$$;

-- ---------- Security: only members can see or change a circle's data ----------
alter table public.circles enable row level security;
alter table public.members enable row level security;
alter table public.people  enable row level security;
alter table public.calls   enable row level security;
alter table public.news    enable row level security;

create policy "members read circle"   on public.circles for select to authenticated using (public.is_member(id));
create policy "members rename circle" on public.circles for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy "members see members"   on public.members for select to authenticated using (public.is_member(circle_id));
create policy "edit own member row"   on public.members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leave circle"          on public.members for delete to authenticated using (user_id = auth.uid());

create policy "members read people"   on public.people for select to authenticated using (public.is_member(circle_id));
create policy "members add people"    on public.people for insert to authenticated with check (public.is_member(circle_id));
create policy "members edit people"   on public.people for update to authenticated using (public.is_member(circle_id)) with check (public.is_member(circle_id));
create policy "members remove people" on public.people for delete to authenticated using (public.is_member(circle_id));

create policy "members read calls"    on public.calls for select to authenticated using (public.is_member(circle_id));
create policy "log own calls"         on public.calls for insert to authenticated with check (public.is_member(circle_id) and user_id = auth.uid());
create policy "edit own calls"        on public.calls for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(circle_id));
create policy "delete own calls"      on public.calls for delete to authenticated using (user_id = auth.uid());

create policy "members read news"     on public.news for select to authenticated using (public.is_member(circle_id));
create policy "members post news"     on public.news for insert to authenticated with check (public.is_member(circle_id) and user_id = auth.uid());
create policy "members tick news"     on public.news for update to authenticated using (public.is_member(circle_id)) with check (public.is_member(circle_id));
create policy "delete own news"       on public.news for delete to authenticated using (user_id = auth.uid());

-- ---------- Create / join a circle (the only way in) ----------
create or replace function public.create_circle(p_name text, p_display_name text)
returns public.circles
language plpgsql security definer set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O or 1/I
  new_code text;
  result public.circles;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.circles where code = new_code);
  end loop;
  insert into public.circles (name, code, created_by)
    values (trim(p_name), new_code, auth.uid()) returning * into result;
  insert into public.members (circle_id, user_id, display_name)
    values (result.id, auth.uid(), trim(p_display_name));
  return result;
end;
$$;

create or replace function public.join_circle(p_code text, p_display_name text)
returns public.circles
language plpgsql security definer set search_path = public
as $$
declare
  result public.circles;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into result from public.circles where code = upper(replace(trim(p_code), ' ', ''));
  if not found then raise exception 'No family circle with that code'; end if;
  insert into public.members (circle_id, user_id, display_name)
    values (result.id, auth.uid(), trim(p_display_name))
    on conflict (circle_id, user_id) do update set display_name = excluded.display_name;
  return result;
end;
$$;

revoke all on function public.create_circle(text, text) from public, anon;
revoke all on function public.join_circle(text, text)   from public, anon;
revoke all on function public.is_member(uuid)           from public, anon;
grant execute on function public.create_circle(text, text) to authenticated;
grant execute on function public.join_circle(text, text)   to authenticated;
grant execute on function public.is_member(uuid)           to authenticated;

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.members, public.people, public.calls, public.news;
