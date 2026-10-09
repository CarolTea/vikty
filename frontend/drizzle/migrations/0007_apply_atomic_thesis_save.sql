-- Called only by the authenticated server handler after checking the demo secret.
-- Identity is supplied by verified auth context, never by browser input.
CREATE FUNCTION public.save_tracked_thesis_atomic(owner_id uuid, session_id uuid, payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  saved public.theses%ROWTYPE;
  composition_id_value uuid;
  previous_assets jsonb;
  requested_assets jsonb;
  asset_count integer;
  snapshot_count integer;
BEGIN
  IF owner_id IS NULL OR session_id IS NULL
    OR jsonb_typeof(payload->'assets') IS DISTINCT FROM 'array'
    OR jsonb_array_length(payload->'assets') NOT BETWEEN 1 AND 12
    OR jsonb_typeof(payload->'snapshots') IS DISTINCT FROM 'array'
    OR jsonb_array_length(payload->'snapshots') <> 31 THEN
    RAISE EXCEPTION 'Invalid thesis payload';
  END IF;
  -- Serialize retries/tabs for a demo session, including the first insert.
  PERFORM pg_advisory_xact_lock(hashtextextended(session_id::text, 0));
  SELECT * INTO saved FROM public.theses WHERE demo_session_id = session_id;
  IF saved.id IS NOT NULL AND saved.user_id <> owner_id THEN
    RAISE EXCEPTION 'Demo already saved by another account. Start a new demo.';
  END IF;
  IF saved.id IS NOT NULL AND
    (saved.original_belief IS DISTINCT FROM payload->>'belief'
      OR saved.interpreted_thesis IS DISTINCT FROM payload->>'interpretation') THEN
    RAISE EXCEPTION 'This demo was already saved with different content. Start a new demo.';
  END IF;
  SELECT jsonb_agg(x - 'current_simulated_price' - 'initial_value' - 'current_value' ORDER BY x->>'asset_id')
    INTO requested_assets FROM jsonb_array_elements(payload->'assets') x;
  IF saved.id IS NOT NULL THEN
    SELECT id INTO composition_id_value FROM public.compositions WHERE thesis_id = saved.id AND user_id = owner_id;
    SELECT count(*), jsonb_agg(to_jsonb(a) - 'id' - 'composition_id' - 'user_id' - 'created_at'
      - 'current_simulated_price' - 'initial_value' - 'current_value' ORDER BY a.asset_id)
      INTO asset_count, previous_assets FROM public.composition_assets a WHERE composition_id = composition_id_value;
    IF previous_assets IS NOT NULL AND NOT previous_assets <@ requested_assets THEN
      RAISE EXCEPTION 'This demo was already saved with different assets. Start a new demo.';
    END IF;
    SELECT count(*) INTO snapshot_count FROM public.performance_snapshots WHERE composition_id = composition_id_value;
    IF composition_id_value IS NOT NULL AND asset_count > 0 AND snapshot_count = 31 THEN
      IF previous_assets IS DISTINCT FROM requested_assets THEN
        RAISE EXCEPTION 'This demo was already saved with different assets. Start a new demo.';
      END IF;
      RETURN saved.id; -- Confirmed complete retry: never regenerate persisted performance.
    END IF;
  END IF;

  INSERT INTO public.profiles(id, email, name)
    VALUES(owner_id, payload->>'email', payload->>'name') ON CONFLICT (id) DO NOTHING;
  IF saved.id IS NULL THEN
    INSERT INTO public.theses(user_id, demo_session_id, title, original_belief, interpreted_thesis)
      VALUES(owner_id, session_id, payload->>'title', payload->>'belief', payload->>'interpretation') RETURNING * INTO saved;
  ELSE
    -- Repair only an incomplete legacy save, within the same transaction.
    DELETE FROM public.compositions WHERE thesis_id = saved.id AND user_id = owner_id;
  END IF;
  INSERT INTO public.compositions(thesis_id,user_id,initial_amount,current_simulated_value)
    VALUES(saved.id,owner_id,1000,(payload->>'currentValue')::numeric) RETURNING id INTO composition_id_value;
  INSERT INTO public.composition_assets(composition_id,user_id,asset_id,ticker,name,allocation_percent,
    initial_simulated_price,current_simulated_price,initial_value,current_value,category,exposure,why,risks)
    SELECT composition_id_value,owner_id,x.asset_id,x.ticker,x.name,x.allocation_percent,
      x.initial_simulated_price,x.current_simulated_price,x.initial_value,x.current_value,x.category,x.exposure,x.why,x.risks
    FROM jsonb_to_recordset(payload->'assets') AS x(asset_id text,ticker text,name text,allocation_percent numeric,
      initial_simulated_price numeric,current_simulated_price numeric,initial_value numeric,current_value numeric,
      category text,exposure text,why text,risks text);
  INSERT INTO public.performance_snapshots(composition_id,user_id,value,snapshot_date)
    SELECT composition_id_value,owner_id,x.value,x.date FROM jsonb_to_recordset(payload->'snapshots') AS x(value numeric,date date);
  RETURN saved.id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_tracked_thesis_atomic(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_tracked_thesis_atomic(uuid,uuid,jsonb) TO service_role;