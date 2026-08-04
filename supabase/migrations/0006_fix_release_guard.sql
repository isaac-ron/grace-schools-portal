-- =============================================================================
-- 0006_fix_release_guard.sql
--
-- Closes a hole in the results release gate.
--
-- 0004 guarded releasing with a BEFORE UPDATE trigger, which only covers the
-- draft -> released transition. Nothing guarded INSERT, and the
-- report_cards_staff_write policy grants ALL (including insert) to any teacher
-- of the class. So a teacher could create a report card that was already
-- `released` and publish marks to parents without holding the permission,
-- skipping the moderation step the gate exists to enforce.
--
-- The guard now covers INSERT and UPDATE, and the stamping of released_by /
-- released_at is centralised so it cannot be forged on either path.
-- =============================================================================

create or replace function report_cards_guard_release()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_was_released boolean := (tg_op = 'UPDATE' and old.status = 'released');
  v_now_released boolean := (new.status = 'released');
begin
  -- Any change in published state requires the permission, in either direction.
  -- Withdrawing results is as consequential as publishing them.
  if v_now_released is distinct from v_was_released then
    if not can_release_results() then
      raise exception
        'Only a user with results release permission may publish or withdraw results';
    end if;
  end if;

  if v_now_released then
    -- Always stamped from the session, never from client input, so the audit
    -- trail cannot be forged by supplying released_by in the payload.
    new.released_by := auth.uid();
    new.released_at := coalesce(
      case when v_was_released then old.released_at end,
      now()
    );
  else
    new.released_by := null;
    new.released_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists report_cards_guard_release_before_update on report_cards;

create trigger report_cards_guard_release_before_write
  before insert or update on report_cards
  for each row execute function report_cards_guard_release();
