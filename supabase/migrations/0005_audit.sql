-- =============================================================================
-- 0005_audit.sql
-- Audit trail for grade mutations and privilege changes.
--
-- SECURITY DEFINER because audit_log has no insert policy: nothing may write to
-- it through the API, and nothing may amend it afterwards. Only these triggers
-- can append.
-- =============================================================================

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_entity_id text;
begin
  v_entity_id := case
    when tg_op = 'DELETE' then coalesce((to_jsonb(old) ->> 'id'), null)
    else coalesce((to_jsonb(new) ->> 'id'), null)
  end;

  insert into audit_log (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Marks, report card status, submission grades, privilege changes and the
-- student register. Everything a dispute could turn on.
do $$
declare
  t text;
begin
  foreach t in array array[
    'scores', 'report_cards', 'submission_grades', 'profiles', 'students'
  ]
  loop
    execute format(
      'create trigger %I_audit after insert or update or delete on %I
         for each row execute function audit_row_change()',
      t, t
    );
  end loop;
end;
$$;
