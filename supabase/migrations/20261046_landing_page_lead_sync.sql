-- Lets the public landing page copy website leads into the Reception
-- enquiry pipeline and the Grievances module. Insert-only for anon: the
-- public can add rows but never read, change or delete them.
do $$
declare t text;
begin
  foreach t in array array['reception_enquiries', 'grievances'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_anon_website_insert', t);
      execute format('create policy %I on public.%I for insert to anon with check (true)', t || '_anon_website_insert', t);
    end if;
  end loop;
end $$;
