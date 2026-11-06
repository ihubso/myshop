-- ============================================================
-- activate_license_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.activate_license_secure(
    p_user_id uuid,
    p_business_id uuid,
    p_business_name text,
    p_business_email text,
    p_business_phone text,
    p_owner_name text,
    p_currency text,
    p_language text,
    p_plan text,
    p_interval text,
    p_amount numeric,
    p_reference text,
    p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_new_business_id uuid;
    v_business record;
    v_expiry timestamptz;
    v_result jsonb;
BEGIN
    IF p_interval = 'yearly' THEN
        v_expiry := NOW() + INTERVAL '1 year';
    ELSE
        v_expiry := NOW() + INTERVAL '1 month';
    END IF;

    SELECT * INTO v_business FROM public.business_info WHERE id = p_business_id;

    IF v_business.id IS NULL THEN
        INSERT INTO public.business_info (
            name, email, phone, owner_name, currency, language,
            license_status, license_plan, license_expires_at, license_activated_at
        ) VALUES (
            p_business_name, p_business_email, p_business_phone, p_owner_name, p_currency, p_language,
            'active', p_plan, v_expiry, NOW()
        ) RETURNING id INTO v_new_business_id;

        UPDATE public.users SET business_id = v_new_business_id WHERE id = p_user_id;
    ELSE
        UPDATE public.business_info SET
            license_status = 'active',
            license_plan = p_plan,
            license_expires_at = v_expiry,
            license_activated_at = NOW()
        WHERE id = p_business_id;
        v_new_business_id := p_business_id;
    END IF;

    INSERT INTO public.transactions (
        user_id, business_id, reference, plan, amount, interval, status, payment_method, is_subscription, created_at
    ) VALUES (
        p_user_id, v_new_business_id, p_reference, p_plan, p_amount, p_interval, 'completed', p_payment_method,
        (p_payment_method = 'paystack_subscription'), NOW()
    );

    SELECT row_to_json(b) INTO v_result FROM public.business_info b WHERE b.id = v_new_business_id;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- assert_session
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_session(p_token text, p_business_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id uuid;
BEGIN
    IF p_token IS NULL OR btrim(p_token) = '' THEN
        RAISE EXCEPTION 'Missing session token' USING ERRCODE = '42501';
    END IF;
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'Missing business id' USING ERRCODE = '42501';
    END IF;

    SELECT s.user_id INTO v_user_id
    FROM public.sessions s
    WHERE s.token       = p_token
      AND s.business_id = p_business_id
      AND s.expires_at  > now();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired session' USING ERRCODE = '42501';
    END IF;

    UPDATE public.sessions SET last_seen_at = now() WHERE token = p_token;

    RETURN v_user_id;
END;
$function$;


-- ============================================================
-- assert_session_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_session_user(p_token text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF p_token IS NULL OR btrim(p_token) = '' THEN
        RAISE EXCEPTION 'Missing session token' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.sessions
         WHERE token      = p_token
           AND user_id    = p_user_id
           AND expires_at > now()
    ) THEN
        RAISE EXCEPTION 'Invalid or expired session' USING ERRCODE = '42501';
    END IF;

    UPDATE public.sessions SET last_seen_at = now() WHERE token = p_token;
END;
$function$;


-- ============================================================
-- check_and_record_device_visit
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_record_device_visit(p_user_id uuid, p_business_id uuid, p_device_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.user_device_visits;
BEGIN
  IF p_user_id IS NULL OR p_business_id IS NULL THEN
    RAISE EXCEPTION 'user_id and business_id required' USING ERRCODE = 'check_violation';
  END IF;

  IF p_device_type NOT IN ('mobile','tablet','desktop') THEN
    RAISE EXCEPTION 'invalid device_type' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'user does not belong to business' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_row
  FROM public.user_device_visits
  WHERE user_id = p_user_id AND device_type = p_device_type;

  IF v_row.id IS NULL THEN
    INSERT INTO public.user_device_visits (user_id, device_type)
    VALUES (p_user_id, p_device_type)
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'is_first_visit', true,
      'device_type',    p_device_type,
      'first_seen_at',  v_row.first_seen_at
    );
  ELSE
    UPDATE public.user_device_visits
    SET last_seen_at = now()
    WHERE id = v_row.id;

    RETURN jsonb_build_object(
      'is_first_visit', false,
      'device_type',    p_device_type,
      'first_seen_at',  v_row.first_seen_at
    );
  END IF;
END;
$function$;


-- ============================================================
-- check_and_record_device_visit_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_record_device_visit_secure(p_user_id uuid, p_business_id uuid, p_device_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.user_device_visits;
BEGIN
  IF p_user_id IS NULL OR p_business_id IS NULL THEN
    RAISE EXCEPTION 'user_id and business_id required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_device_type NOT IN ('mobile','tablet','desktop') THEN
    RAISE EXCEPTION 'invalid device_type' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'user does not belong to business' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_row FROM public.user_device_visits
  WHERE user_id = p_user_id AND device_type = p_device_type;

  IF v_row.id IS NULL THEN
    INSERT INTO public.user_device_visits (user_id, device_type)
    VALUES (p_user_id, p_device_type) RETURNING * INTO v_row;
    RETURN jsonb_build_object('is_first_visit', true, 'device_type', p_device_type);
  ELSE
    UPDATE public.user_device_visits SET last_seen_at = now() WHERE id = v_row.id;
    RETURN jsonb_build_object('is_first_visit', false, 'device_type', p_device_type);
  END IF;
END;
$function$;


-- ============================================================
-- check_email_exists_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_email_exists_secure(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.users WHERE email = p_email
    ) INTO v_exists;

    RETURN v_exists;
END;
$function$;


-- ============================================================
-- check_rate_limit
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.rate_limits;
BEGIN
  IF p_max <= 0 OR p_window_seconds <= 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row FROM public.rate_limits WHERE key = p_key FOR UPDATE;

  IF NOT FOUND OR v_row.reset_at < now() THEN
    INSERT INTO public.rate_limits (key, count, reset_at)
    VALUES (p_key, 1, now() + (p_window_seconds || ' seconds')::interval)
    ON CONFLICT (key) DO UPDATE
      SET count = 1, reset_at = excluded.reset_at;
    RETURN true;
  END IF;

  IF v_row.count >= p_max THEN
    RETURN false;
  END IF;

  UPDATE public.rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN true;
END;
$function$;


-- ============================================================
-- check_username_exists_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_username_exists_secure(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.users WHERE username = p_username
    ) INTO v_exists;

    RETURN v_exists;
END;
$function$;


-- ============================================================
-- cleanup_ephemeral_tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_ephemeral_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_deleted int;
BEGIN
  DELETE FROM public.password_reset_codes
  WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day')
     OR (expires_at  IS NOT NULL AND expires_at  < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'password_reset_codes: %', v_deleted;

  DELETE FROM public.password_reset_tokens
  WHERE (used_at    IS NOT NULL AND used_at    < now() - interval '1 day')
     OR (expires_at IS NOT NULL AND expires_at < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'password_reset_tokens: %', v_deleted;

  DELETE FROM public.password_reset_attempts
  WHERE (locked_until IS NULL OR locked_until < now() - interval '1 day')
    AND COALESCE(failed_attempts, 0) = 0;
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'password_reset_attempts: %', v_deleted;

  DELETE FROM public.email_verifications
  WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day')
     OR (expires_at  IS NOT NULL AND expires_at  < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'email_verifications: %', v_deleted;

  DELETE FROM public.verified_emails
  WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day')
     OR (expires_at  IS NOT NULL AND expires_at  < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'verified_emails: %', v_deleted;

  DELETE FROM public.device_clear_challenges
  WHERE (used_at    IS NOT NULL AND used_at    < now() - interval '1 day')
     OR (expires_at IS NOT NULL AND expires_at < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'device_clear_challenges: %', v_deleted;

  DELETE FROM public.rate_limits WHERE reset_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'rate_limits: %', v_deleted;

  DELETE FROM public.user_sessions
  WHERE (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days')
     OR (expires_at IS NOT NULL AND expires_at < now() - interval '30 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'user_sessions: %', v_deleted;

  DELETE FROM public.business_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'business_events: %', v_deleted;
END;
$function$;


-- ============================================================
-- cleanup_old_notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    DELETE FROM public.notifications
    WHERE created_at < NOW() - INTERVAL '21 days'
    AND type IN ('daily_combined_report', 'manager_promoted', 'outstanding_balances_reminder');
END;
$function$;


-- ============================================================
-- cleanup_old_sessions
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions(p_retention_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cutoff  timestamptz := now() - make_interval(hours => p_retention_hours);
  v_deleted int;
BEGIN
  WITH deleted AS (
    DELETE FROM public.user_sessions
    WHERE (revoked_at IS NOT NULL OR expires_at < now())
      AND COALESCE(last_seen_at, created_at) < v_cutoff
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$function$;


-- ============================================================
-- clear_active_devices_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_active_devices_secure(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.active_devices WHERE business_id = p_business_id;
END;
$function$;


-- ============================================================
-- clear_completed_tasks_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_completed_tasks_secure(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.tasks
     WHERE status = 'completed'
       AND business_id = p_business_id;
END;
$function$;


-- ============================================================
-- create_push_subscription_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_push_subscription_secure(
    p_endpoint text,
    p_p256dh text,
    p_auth text,
    p_user_agent text,
    p_user_id text,
    p_business_id uuid,
    p_vapid_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_row public.push_subscriptions;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    IF p_endpoint IS NULL OR length(trim(p_endpoint)) = 0 THEN
        RAISE EXCEPTION 'endpoint is required';
    END IF;
    IF p_p256dh IS NULL OR length(trim(p_p256dh)) = 0 THEN
        RAISE EXCEPTION 'p256dh key is required';
    END IF;
    IF p_auth IS NULL OR length(trim(p_auth)) = 0 THEN
        RAISE EXCEPTION 'auth key is required';
    END IF;
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'business_id is required';
    END IF;

    INSERT INTO public.push_subscriptions (
        business_id,
        user_id,
        endpoint,
        p256dh,
        auth,
        user_agent,
        vapid_key,
        created_at,
        updated_at
    )
    VALUES (
        p_business_id,
        p_user_id,
        p_endpoint,
        p_p256dh,
        p_auth,
        p_user_agent,
        p_vapid_key,
        now(),
        now()
    )
    ON CONFLICT (endpoint) DO UPDATE
    SET
        business_id = EXCLUDED.business_id,
        user_id     = EXCLUDED.user_id,
        p256dh      = EXCLUDED.p256dh,
        auth        = EXCLUDED.auth,
        user_agent  = EXCLUDED.user_agent,
        vapid_key   = EXCLUDED.vapid_key,
        updated_at  = now()
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'push subscription already exists for endpoint %', p_endpoint;
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'invalid business_id or user_id';
END;
$function$;


-- ============================================================
-- delete_active_device_secure (overload 1: by id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_active_device_secure(p_id uuid, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.active_devices
    WHERE id = p_id AND business_id = p_business_id;
END;
$function$;


-- ============================================================
-- delete_active_device_secure (overload 2: by fingerprint)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_active_device_secure(p_business_id uuid, p_fingerprint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.active_devices
    WHERE business_id = p_business_id AND device_fingerprint = p_fingerprint;
END;
$function$;


-- ============================================================
-- delete_note_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_note_secure(p_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    DELETE FROM public.notes WHERE id = p_id AND user_id = p_user_id;
END;
$function$;


-- ============================================================
-- delete_reminder_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_reminder_secure(p_id uuid, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.reminders WHERE id = p_id;
END;
$function$;


-- ============================================================
-- delete_stock_secure  (deletes from public.products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_stock_secure(p_id uuid, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.products WHERE id = p_id;
END;
$function$;


-- ============================================================
-- delete_task_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_task_secure(p_id uuid, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.tasks WHERE id = p_id;
END;
$function$;


-- ============================================================
-- delete_user_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user_secure(p_username text, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.users WHERE username = p_username;
END;
$function$;


-- ============================================================
-- emit_business_event  (TG_TABLE_NAME 'stock' -> 'products')
-- ============================================================
CREATE OR REPLACE FUNCTION public.emit_business_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_business_id UUID;
  v_event_type  TEXT;
  v_payload     JSONB;
BEGIN
  IF TG_TABLE_NAME = 'sales' THEN
    v_business_id := NEW.business_id;
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'new_sale';
      v_payload := jsonb_build_object(
        'id',            NEW.id,
        'product_name',  NEW.product_name,
        'username',      NEW.username,
        'price',         NEW.price,
        'quantity',      NEW.quantity,
        'receipt_id',    NEW.receipt_id
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'tasks' THEN
    v_business_id := NEW.business_id;
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'new_task';
      v_payload := jsonb_build_object(
        'id',         NEW.id,
        'title',      NEW.title,
        'assigned_to', NEW.assigned_to,
        'created_by', NEW.created_by
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'products' THEN
    v_business_id := NEW.business_id;
    IF TG_OP = 'UPDATE' AND (OLD.quantity IS DISTINCT FROM NEW.quantity) THEN
      IF NEW.quantity < 3 AND (OLD.quantity IS NULL OR OLD.quantity >= 3) THEN
        v_event_type := 'low_stock';
        v_payload := jsonb_build_object(
          'id',       NEW.id,
          'name',     NEW.name,
          'quantity', NEW.quantity
        );
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'credit_sales' THEN
    v_business_id := NEW.business_id;
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'new_credit_sale';
      v_payload := jsonb_build_object(
        'id',             NEW.id,
        'customer_name',  NEW.customer_name,
        'total_amount',   NEW.total_amount,
        'due_date',       NEW.due_date
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'customer_receipts' THEN
    v_business_id := NEW.business_id;
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'new_receipt';
      v_payload := jsonb_build_object(
        'id',          NEW.id,
        'receipt_id',  NEW.receipt_id,
        'customer_name', NEW.customer_name
      );
    END IF;
  END IF;

  IF v_business_id IS NULL OR v_event_type IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.business_events (business_id, event_type, payload)
  VALUES (v_business_id, v_event_type, v_payload);

  RETURN NEW;
END;
$function$;


-- ============================================================
-- emit_dashboard_prefs_change
-- ============================================================
CREATE OR REPLACE FUNCTION public.emit_dashboard_prefs_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF (OLD.dashboard_preferences IS DISTINCT FROM NEW.dashboard_preferences) THEN
        INSERT INTO public.business_events (business_id, event_type, payload)
        VALUES (
            NEW.id,
            'dashboard_preferences_changed',
            jsonb_build_object(
                'widgetVisibility', NEW.dashboard_preferences->'widgetVisibility',
                'compactNumbers',   NEW.dashboard_preferences->'compactNumbers'
            )
        );
    END IF;
    RETURN NEW;
END;
$function$;


-- ============================================================
-- emit_supermarket_settings_change
-- ============================================================
CREATE OR REPLACE FUNCTION public.emit_supermarket_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF (OLD.supermarket_settings IS DISTINCT FROM NEW.supermarket_settings) THEN
        INSERT INTO public.business_events (business_id, event_type, payload)
        VALUES (
            NEW.id,
            'supermarket_settings_changed',
            jsonb_build_object(
                'settings', NEW.supermarket_settings,
                'changedAt', NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$function$;


-- ============================================================
-- emit_user_role_change
-- ============================================================
CREATE OR REPLACE FUNCTION public.emit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_event_type TEXT;
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        IF NEW.role = 'manager' AND OLD.role = 'sales' THEN
            v_event_type := 'user_promoted';
        ELSIF NEW.role = 'sales' AND OLD.role = 'manager' THEN
            v_event_type := 'user_demoted';
        ELSE
            v_event_type := 'user_role_changed';
        END IF;

        INSERT INTO public.business_events (business_id, event_type, payload)
        VALUES (
            NEW.business_id,
            v_event_type,
            jsonb_build_object(
                'userId',         NEW.id,
                'username',       NEW.username,
                'fullName',       NEW.full_name,
                'email',          NEW.email,
                'photoUrl',       NEW.photo_url,
                'oldRole',        OLD.role,
                'newRole',        NEW.role,
                'promotedAt',     NEW.promoted_at,
                'promotedBy',     NEW.promoted_by,
                'demotedAt',      NEW.demoted_at,
                'promotionLabel', NEW.promotion_date_label,
                'changedAt',      NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$function$;


-- ============================================================
-- fix_business_rls
-- ============================================================
CREATE OR REPLACE FUNCTION public.fix_business_rls(tbl_name text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', tbl_name, tbl_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', tbl_name, tbl_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', tbl_name, tbl_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_blocked ON public.%I', tbl_name, tbl_name);

    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (business_id::text = current_setting(''app.current_business_id'', true))', tbl_name, tbl_name);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (business_id::text = current_setting(''app.current_business_id'', true))', tbl_name, tbl_name);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (business_id::text = current_setting(''app.current_business_id'', true)) WITH CHECK (business_id::text = current_setting(''app.current_business_id'', true))', tbl_name, tbl_name);
    EXECUTE format('CREATE POLICY %I_delete_blocked ON public.%I FOR DELETE USING (false)', tbl_name, tbl_name);
END;
$function$;


-- ============================================================
-- get_active_device_fingerprints_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_device_fingerprints_secure(p_business_id uuid, p_seven_days_ago timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT jsonb_agg(device_fingerprint) INTO v_result
    FROM public.active_devices
    WHERE business_id = p_business_id
      AND last_active >= p_seven_days_ago;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;


-- ============================================================
-- get_active_devices_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_devices_secure(p_business_id uuid)
RETURNS TABLE(id uuid, device_fingerprint text, device_name text, last_active timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT
        ad.id,
        ad.device_fingerprint,
        ad.device_name,
        ad.last_active
    FROM public.active_devices ad
    WHERE ad.business_id = p_business_id
    ORDER BY ad.last_active DESC;
END;
$function$;


-- ============================================================
-- get_admin_profile_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_profile_secure(p_username text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user public.users;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT * INTO v_user
    FROM public.users
    WHERE LOWER(username) = LOWER(p_username) AND role = 'administrator';

    IF v_user.id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN row_to_json(v_user);
END;
$function$;


-- ============================================================
-- get_all_customers_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_customers_secure(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_customers jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT jsonb_agg(row_to_json(subq)) INTO v_customers
    FROM (
        SELECT name, MAX(phone) AS phone
        FROM (
            SELECT customer_name AS name, customer_phone AS phone FROM public.sales WHERE business_id = p_business_id
            UNION ALL
            SELECT customer_name AS name, customer_phone AS phone FROM public.credit_sales WHERE business_id = p_business_id
            UNION ALL
            SELECT name, phone FROM public.customers WHERE business_id = p_business_id
        ) AS combined
        WHERE name IS NOT NULL
          AND TRIM(name) != ''
          AND TRIM(name) != 'Tapez le nom du client'
        GROUP BY name
        ORDER BY name ASC
    ) AS subq;

    RETURN COALESCE(v_customers, '[]'::jsonb);
END;
$function$;


-- ============================================================
-- get_app_events_for_dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_app_events_for_dashboard(
    p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_limit integer DEFAULT 10000,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_rows  jsonb;
    v_total integer;
BEGIN
    SELECT count(*) INTO v_total
    FROM public.app_events
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date   IS NULL OR created_at <= p_end_date);

    SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT *
        FROM public.app_events
        WHERE (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date   IS NULL OR created_at <= p_end_date)
        ORDER BY created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) e;

    RETURN jsonb_build_object(
        'total', v_total,
        'rows',  v_rows
    );
END;
$function$;


-- ============================================================
-- get_available_usernames_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_usernames_secure(p_usernames text[])
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT username FROM unnest(p_usernames) AS username
    EXCEPT
    SELECT username FROM public.users;
END;
$function$;


-- ============================================================
-- get_business_info_by_id_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_business_info_by_id_secure(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_id::text, false);
    SELECT row_to_json(b) INTO v_result FROM public.business_info b WHERE b.id = p_id LIMIT 1;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_business_info_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_business_info_secure(p_business_id uuid)
RETURNS SETOF business_info
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    RETURN QUERY SELECT * FROM public.business_info WHERE id = p_business_id;
END;
$function$;


-- ============================================================
-- get_credit_sale_by_receipt_id_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_credit_sale_by_receipt_id_secure(p_receipt_id text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT row_to_json(cs) INTO v_result
    FROM public.credit_sales cs
    WHERE cs.receipt_id = p_receipt_id
    LIMIT 1;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_credit_sales_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_credit_sales_secure(p_business_id uuid)
RETURNS SETOF credit_sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.credit_sales
    WHERE business_id = p_business_id
    ORDER BY created_at DESC;
END;
$function$;


-- ============================================================
-- get_customer_receipt_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_customer_receipt_secure(p_receipt_id text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT row_to_json(cr) INTO v_result
    FROM public.customer_receipts cr
    WHERE cr.receipt_id = p_receipt_id
    LIMIT 1;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_customer_receipts_list_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_customer_receipts_list_secure(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT jsonb_agg(row_to_json(s)) INTO v_result
    FROM (
        SELECT customer_name, id, product_name, date_sold
        FROM public.sales
        WHERE business_id = p_business_id
          AND customer_name IS NOT NULL
          AND TRIM(customer_name) != ''
        ORDER BY date_sold DESC
    ) s;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;


-- ============================================================
-- get_customer_transactions_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_customer_transactions_secure(p_customer_name text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_sales jsonb;
    v_credits jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT jsonb_agg(row_to_json(s)) INTO v_sales
    FROM (
        SELECT * FROM public.sales
        WHERE business_id = p_business_id AND customer_name = p_customer_name
        ORDER BY date_sold DESC
    ) s;

    SELECT jsonb_agg(row_to_json(c)) INTO v_credits
    FROM (
        SELECT * FROM public.credit_sales
        WHERE business_id = p_business_id AND customer_name = p_customer_name
        ORDER BY created_at DESC
    ) c;

    RETURN jsonb_build_object(
        'sales', COALESCE(v_sales, '[]'::jsonb),
        'credits', COALESCE(v_credits, '[]'::jsonb)
    );
END;
$function$;


-- ============================================================
-- get_dashboard_data_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_data_secure(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_stock jsonb;
    v_sales jsonb;
    v_start_prev_month date;
    v_end_today date;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    v_start_prev_month := date_trunc('month', current_date - interval '1 month')::date;
    v_end_today := current_date;

    SELECT jsonb_agg(row_to_json(s)) INTO v_stock
    FROM (
        SELECT id, name, quantity, type, business_id, cost_price, price
        FROM public.products
        WHERE business_id = p_business_id
        ORDER BY name ASC
    ) s;

    SELECT jsonb_agg(row_to_json(sl)) INTO v_sales
    FROM (
        SELECT
            id, product_name, quantity, price, total_amount, payment_type,
            username, business_id, type, date_sold, receipt_id, product_id,
            created_at
        FROM public.sales
        WHERE business_id = p_business_id
          AND date_sold >= v_start_prev_month
          AND date_sold <= v_end_today
        ORDER BY created_at DESC
    ) sl;

    RETURN jsonb_build_object(
        'stock', COALESCE(v_stock, '[]'::jsonb),
        'sales', COALESCE(v_sales, '[]'::jsonb)
    );
END;
$function$;


-- ============================================================
-- get_exchange_products_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_exchange_products_secure(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
BEGIN
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;

    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',       s.id,
        'name',     s.name,
        'quantity', s.quantity,
        'price',    s.price,
        'type',     s.type,
        'category', s.category
    )), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT id, name, quantity, price, type, category
        FROM public.products
        WHERE business_id = p_business_id
          AND type = 'product'
          AND quantity > 0
        ORDER BY name ASC
    ) s;

    RETURN v_rows;
END;
$function$;


-- ============================================================
-- get_expenses_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_expenses_secure(p_business_id uuid)
RETURNS SETOF expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.expenses
    WHERE business_id = p_business_id
    ORDER BY date DESC;
END;
$function$;


-- ============================================================
-- get_filtered_combined_receipts_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_filtered_combined_receipts_secure(
    p_business_id uuid,
    p_receipt_id text DEFAULT NULL::text,
    p_customer_name text DEFAULT NULL::text,
    p_date date DEFAULT NULL::date,
    p_status text DEFAULT NULL::text,
    p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_limit    int := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 60);
  v_rows     jsonb;
  v_total    int;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'BUSINESS_ID_REQUIRED' USING ERRCODE = '22004';
  END IF;

  WITH credit AS (
    SELECT
      'credit_sale'::text              AS type,
      COALESCE(cs.receipt_id,
               'CS-' || left(cs.id::text, 8)) AS "receiptId",
      COALESCE(cs.customer_name, '')   AS "customerName",
      COALESCE(cs.date_sold, cs.created_at::date) AS "date",
      COALESCE(cs.total_amount, 0)     AS "amount",
      COALESCE(cs.paid_amount, 0)      AS "paidAmount",
      COALESCE(cs.credit_balance, 0)   AS "balance",
      COALESCE(cs.status, 'pending')   AS "status",
      COALESCE(cs.payment_type, 'Credit') AS "paymentType",
      COALESCE(cs.username, '')        AS "cashier",
      jsonb_build_object(
        'product_name',    cs.product_name,
        'quantity',        cs.quantity,
        'price',           cs.price,
        'advance_payment', cs.advance_payment,
        'payments',        cs.payments
      )                                AS "details",
      'credit_sales'::text             AS "source",
      cs.created_at                    AS "created_at",
      cs.id                            AS sort_id
    FROM public.credit_sales cs
    WHERE cs.business_id = p_business_id
      AND (p_receipt_id   IS NULL OR cs.receipt_id    ILIKE '%' || p_receipt_id   || '%')
      AND (p_customer_name IS NULL OR cs.customer_name ILIKE '%' || p_customer_name || '%')
      AND (p_date         IS NULL OR cs.date_sold     = p_date)
      AND (p_status       IS NULL OR cs.status        = p_status)
  ),
  receipts AS (
    SELECT
      'customer_receipt'::text         AS type,
      cr.receipt_id                    AS "receiptId",
      COALESCE(cr.customer_name, '')   AS "customerName",
      COALESCE(cr.date, cr.created_at::date) AS "date",
      COALESCE(cr.amount_paid, 0) + COALESCE(cr.balance_due, 0) AS "amount",
      COALESCE(cr.amount_paid, 0)      AS "paidAmount",
      COALESCE(cr.balance_due, 0)      AS "balance",
      CASE
        WHEN COALESCE(cr.balance_due, 0) > 0 THEN 'partial'
        ELSE 'completed'
      END                              AS "status",
      COALESCE(cr.payment_type_display, 'Cash') AS "paymentType",
      COALESCE(cr.cashier, '')         AS "cashier",
      jsonb_build_object(
        'items',           COALESCE(cr.items, '[]'::jsonb),
        'item_count',
          CASE
            WHEN cr.items IS NULL OR jsonb_typeof(cr.items) <> 'array' THEN 0
            ELSE jsonb_array_length(cr.items)
          END,
        'advance_payment', COALESCE(cr.advance_payment_amount, 0)
      )                                AS "details",
      'customer_receipts'::text        AS "source",
      cr.created_at                    AS "created_at",
      cr.id                            AS sort_id
    FROM public.customer_receipts cr
    WHERE cr.business_id = p_business_id
      AND (p_receipt_id   IS NULL OR cr.receipt_id    ILIKE '%' || p_receipt_id   || '%')
      AND (p_customer_name IS NULL OR cr.customer_name ILIKE '%' || p_customer_name || '%')
      AND (p_date         IS NULL OR cr.date          = p_date)
      AND p_status IS NULL
  ),
  combined AS (
    SELECT * FROM credit
    UNION ALL
    SELECT * FROM receipts
  ),
  deduped AS (
    SELECT DISTINCT ON ("receiptId") *
    FROM combined
    ORDER BY "receiptId", "created_at" DESC
  ),
  sorted AS (
    SELECT * FROM deduped
    ORDER BY "created_at" DESC
  )
  SELECT
    COUNT(*)::int,
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(s) - 'sort_id')
       FROM (SELECT * FROM sorted LIMIT v_limit) s),
      '[]'::jsonb
    )
  INTO v_total, v_rows
  FROM sorted;

  RETURN jsonb_build_object(
    'data',     v_rows,
    'total',    v_total,
    'limit',    v_limit,
    'hasMore',  v_total > v_limit,
    'message',  CASE
                  WHEN v_total > v_limit
                    THEN 'Showing first ' || v_limit || ' of ' || v_total ||
                         ' records. Please use the Date filter to narrow results.'
                  ELSE 'Showing all ' || v_total || ' records.'
                END
  );
END;
$function$;


-- ============================================================
-- get_filtered_credit_sales_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_filtered_credit_sales_secure(
    p_business_id uuid,
    p_customer_name text DEFAULT NULL::text,
    p_date date DEFAULT NULL::date,
    p_status text DEFAULT NULL::text,
    p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_data JSONB;
    current_user_id UUID;
    total_count INTEGER;
BEGIN
    current_user_id := current_setting('app.current_user_id', true)::UUID;

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No user context set';
    END IF;

    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'Invalid input: Business ID is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = current_user_id
        AND business_id = p_business_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User does not belong to this business';
    END IF;

    IF p_limit > 30 THEN
        p_limit := 30;
    END IF;

    WITH filtered_credit_sales AS (
        SELECT
            cs.id,
            cs.product_name,
            cs.quantity,
            cs.price,
            cs.total_amount,
            cs.customer_name,
            cs.customer_phone,
            cs.advance_payment,
            cs.advance_payment_date,
            cs.credit_balance,
            cs.status,
            cs.related_sale_id,
            cs.paid_amount,
            cs.date_paid,
            cs.username,
            cs.type,
            cs.business_id,
            cs.date_sold,
            cs.payment_type,
            cs.created_at,
            cs.updated_at,
            cs.receipt_id,
            cs.user_id,
            cs.payments,
            EXTRACT(DAY FROM (NOW() - cs.created_at)) AS days_open,
            CASE
                WHEN cs.total_amount > 0 THEN
                    ROUND(((cs.paid_amount) / cs.total_amount) * 100, 2)
                ELSE 0
            END AS payment_progress
        FROM public.credit_sales cs
        WHERE cs.business_id = p_business_id
        AND (p_customer_name IS NULL OR cs.customer_name ILIKE '%' || p_customer_name || '%')
        AND (p_date IS NULL OR cs.date_sold = p_date)
        AND (p_status IS NULL OR cs.status = p_status)
        ORDER BY cs.created_at DESC
        LIMIT p_limit
    ),
    total_count_cte AS (
        SELECT COUNT(*) AS total
        FROM public.credit_sales cs
        WHERE cs.business_id = p_business_id
        AND (p_customer_name IS NULL OR cs.customer_name ILIKE '%' || p_customer_name || '%')
        AND (p_date IS NULL OR cs.date_sold = p_date)
        AND (p_status IS NULL OR cs.status = p_status)
    )
    SELECT
        (SELECT total FROM total_count_cte) INTO total_count;

    SELECT jsonb_build_object(
        'data', COALESCE((SELECT jsonb_agg(row_to_json(filtered_credit_sales)) FROM filtered_credit_sales), '[]'::jsonb),
        'total', total_count,
        'limit', p_limit,
        'has_more', CASE WHEN total_count > p_limit THEN true ELSE false END,
        'message', CASE
            WHEN total_count > p_limit THEN
                'Showing ' || p_limit || ' of ' || total_count || ' records. Please use date filters to narrow results.'
            ELSE
                'Showing all ' || total_count || ' records.'
        END
    ) INTO result_data;

    RETURN result_data;
END;
$function$;


-- ============================================================
-- get_filtered_customer_receipts_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_filtered_customer_receipts_secure(
    p_business_id uuid,
    p_receipt_id text DEFAULT NULL::text,
    p_customer_name text DEFAULT NULL::text,
    p_date date DEFAULT NULL::date,
    p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_data JSONB;
    current_user_id UUID;
    total_count INTEGER;
BEGIN
    current_user_id := current_setting('app.current_user_id', true)::UUID;

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No user context set';
    END IF;

    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'Invalid input: Business ID is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = current_user_id
        AND business_id = p_business_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User does not belong to this business';
    END IF;

    IF p_limit > 30 THEN
        p_limit := 30;
    END IF;

    WITH filtered_receipts AS (
        SELECT
            cr.id,
            cr.receipt_id,
            cr.date,
            cr.customer_name,
            cr.cashier,
            cr.customer_phone,
            cr.items,
            cr.amount_paid,
            cr.balance_due,
            cr.advance_payment_amount,
            cr.advance_payment_date,
            cr.payment_type_display,
            cr.business_id,
            cr.source,
            cr.created_at,
            cr.updated_at,
            cr.advance_payment,
            cr.user_id,
            COALESCE(
                (SELECT SUM((item->>'price')::NUMERIC)
                 FROM jsonb_array_elements(cr.items) AS item),
                0
            ) AS receipt_total,
            COALESCE(
                (SELECT COUNT(*)
                 FROM jsonb_array_elements(cr.items)),
                0
            ) AS item_count,
            EXISTS (
                SELECT 1
                FROM jsonb_array_elements(cr.items) AS item
                WHERE item->>'paymentType' = 'Refund'
                OR item->>'type' = 'Refund'
            ) AS has_refund
        FROM public.customer_receipts cr
        WHERE cr.business_id = p_business_id
        AND (p_receipt_id IS NULL OR cr.receipt_id ILIKE '%' || p_receipt_id || '%')
        AND (p_customer_name IS NULL OR cr.customer_name ILIKE '%' || p_customer_name || '%')
        AND (p_date IS NULL OR cr.date = p_date)
        ORDER BY cr.date DESC, cr.created_at DESC
        LIMIT p_limit
    ),
    total_count_cte AS (
        SELECT COUNT(*) AS total
        FROM public.customer_receipts cr
        WHERE cr.business_id = p_business_id
        AND (p_receipt_id IS NULL OR cr.receipt_id ILIKE '%' || p_receipt_id || '%')
        AND (p_customer_name IS NULL OR cr.customer_name ILIKE '%' || p_customer_name || '%')
        AND (p_date IS NULL OR cr.date = p_date)
    )
    SELECT
        (SELECT total FROM total_count_cte) INTO total_count;

    SELECT jsonb_build_object(
        'data', COALESCE((SELECT jsonb_agg(row_to_json(filtered_receipts)) FROM filtered_receipts), '[]'::jsonb),
        'total', total_count,
        'limit', p_limit,
        'has_more', CASE WHEN total_count > p_limit THEN true ELSE false END,
        'message', CASE
            WHEN total_count > p_limit THEN
                'Showing ' || p_limit || ' of ' || total_count || ' records. Please use date filters to narrow results.'
            ELSE
                'Showing all ' || total_count || ' records.'
        END
    ) INTO result_data;

    RETURN result_data;
END;
$function$;


-- ============================================================
-- get_filtered_sales_receipts_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_filtered_sales_receipts_secure(
    p_business_id uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_data JSONB;
    current_user_id UUID;
BEGIN
    current_user_id := current_setting('app.current_user_id', true)::UUID;

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No user context set';
    END IF;

    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'Invalid input: Business ID is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = current_user_id
        AND business_id = p_business_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User does not belong to this business';
    END IF;

    WITH filtered_sales AS (
        SELECT
            s.id,
            s.receipt_id,
            s.product_name,
            s.quantity,
            s.price,
            s.total_amount,
            s.payment_type,
            s.customer_name,
            s.customer_phone,
            s.type,
            s.username,
            s.business_id,
            s.date_sold,
            s.created_at,
            s.updated_at,
            s.credit_balance,
            s.amount_paid,
            s.balance_due,
            s.advance_payment,
            s.advance_payment_date,
            s.notes,
            s.metadata,
            s.category,
            s.unit_price,
            s.total_price,
            s.subtotal,
            CASE
                WHEN s.price IS NOT NULL AND s.price > 0 THEN
                    ROUND(((s.price - s.cost_price) / s.price) * 100, 2)
                ELSE NULL
            END AS profit_margin
        FROM public.sales s
        WHERE s.business_id = p_business_id
        AND (p_start_date IS NULL OR s.date_sold >= p_start_date)
        AND (p_end_date IS NULL OR s.date_sold <= p_end_date)
        ORDER BY s.date_sold DESC, s.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ),
    total_count AS (
        SELECT COUNT(*) AS total
        FROM public.sales s
        WHERE s.business_id = p_business_id
        AND (p_start_date IS NULL OR s.date_sold >= p_start_date)
        AND (p_end_date IS NULL OR s.date_sold <= p_end_date)
    )
    SELECT jsonb_build_object(
        'data', COALESCE((SELECT jsonb_agg(row_to_json(filtered_sales)) FROM filtered_sales), '[]'::jsonb),
        'total', COALESCE((SELECT total FROM total_count), 0),
        'limit', p_limit,
        'offset', p_offset
    ) INTO result_data;

    RETURN result_data;
END;
$function$;


-- ============================================================
-- get_grouped_subcategories  (stock -> products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_grouped_subcategories(p_business_id uuid, p_year integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result  jsonb;
    v_y0      date;
    v_y1      date;
BEGIN
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;
    IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
        RAISE EXCEPTION 'INVALID_YEAR';
    END IF;

    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    v_y0 := make_date(p_year,     1, 1);
    v_y1 := make_date(p_year + 1, 1, 1);

    WITH
    sales_agg AS (
        SELECT LOWER(sa.product_name)         AS pname,
               COUNT(*)                       AS sales_count,
               COALESCE(SUM(sa.quantity), 0)  AS units_sold,
               COALESCE(SUM(sa.total_amount),0) AS revenue
          FROM public.sales sa
         WHERE sa.business_id   = p_business_id
           AND sa.date_sold::date >= v_y0
           AND sa.date_sold::date <  v_y1
         GROUP BY LOWER(sa.product_name)
    ),
    items AS (
        SELECT
            s.id,
            s.name,
            s.category,
            s.subcategory,
            s.quantity,
            s.price,
            s.cost_price,
            s.image,
            s.type,
            COALESCE(sa.units_sold,  0) AS units_sold,
            COALESCE(sa.revenue,     0) AS revenue,
            COALESCE(sa.sales_count, 0) AS sales_count
          FROM public.products s
          LEFT JOIN sales_agg sa ON LOWER(s.name) = sa.pname
         WHERE s.business_id = p_business_id
    ),
    grouped AS (
        SELECT
            COALESCE(NULLIF(TRIM(subcategory), ''), '#') AS subcategory,
            jsonb_agg(
                jsonb_build_object(
                    'id',          id,
                    'name',        name,
                    'category',    category,
                    'quantity',    quantity,
                    'price',       price,
                    'cost_price',  cost_price,
                    'image',   image,
                    'type',        type,
                    'unitsSold',   units_sold,
                    'revenue',     revenue,
                    'salesCount',  sales_count
                )
                ORDER BY name
            ) AS items,
            COUNT(*)                              AS items_count,
            COALESCE(SUM(quantity), 0)            AS total_qty,
            COALESCE(SUM(price * quantity), 0)    AS total_stock_value,
            COALESCE(SUM(units_sold), 0)          AS total_units_sold,
            COALESCE(SUM(revenue), 0)             AS total_revenue
          FROM items
         GROUP BY COALESCE(NULLIF(TRIM(subcategory), ''), '#')
    ),
    payload AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'subcategory', subcategory,
                'totals', jsonb_build_object(
                    'itemsCount',      items_count,
                    'totalQty',        total_qty,
                    'totalStockValue', total_stock_value,
                    'totalUnitsSold',  total_units_sold,
                    'totalRevenue',    total_revenue
                ),
                'items', items
            )
            ORDER BY subcategory
        ) AS arr
          FROM grouped
    )
    SELECT jsonb_build_object(
        'year',         p_year,
        'subcategories', COALESCE(arr, '[]'::jsonb)
    )
    INTO v_result
    FROM payload;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_loan_by_id_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_loan_by_id_secure(p_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT row_to_json(l) INTO v_result
    FROM public.loans l
    WHERE l.id = p_id
    LIMIT 1;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_loans_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_loans_secure(p_business_id uuid)
RETURNS SETOF loans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.loans
    WHERE business_id = p_business_id
    ORDER BY created_at DESC;
END;
$function$;


-- ============================================================
-- get_notes_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_notes_secure(p_user_id uuid)
RETURNS SETOF notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    RETURN QUERY
    SELECT * FROM public.notes
    WHERE user_id = p_user_id
    ORDER BY updated_at DESC;
END;
$function$;


-- ============================================================
-- get_notification_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_notification_secure(p_notification_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_notification public.notifications;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT * INTO v_notification
    FROM public.notifications
    WHERE id = p_notification_id;

    RETURN row_to_json(v_notification);
END;
$function$;


-- ============================================================
-- get_notifications_secure  (stock -> products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_notifications_secure(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result JSONB;
    tasks_json JSONB;
    reminders_json JSONB;
    stock_json JSONB;
    notif_json JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
    INTO tasks_json
    FROM (
        SELECT
            id,
            'task' as type,
            title,
            description as message,
            due_date as date,
            status,
            created_at,
            assigned_to,
            business_id,
            'task' as notification_type,
            jsonb_build_object(
                'title', title,
                'description', description,
                'assigned_to', assigned_to,
                'due_date', due_date,
                'status', status
            ) as data
        FROM tasks
        WHERE business_id = p_business_id
        AND status != 'completed'
        ORDER BY created_at DESC
        LIMIT 50
    ) t;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
    INTO reminders_json
    FROM (
        SELECT
            id,
            'reminder' as type,
            title,
            message,
            date,
            status,
            created_at,
            business_id,
            'reminder' as notification_type,
            jsonb_build_object(
                'title', title,
                'message', message,
                'date', date,
                'status', status
            ) as data
        FROM reminders
        WHERE business_id = p_business_id
        AND status != 'completed'
        ORDER BY created_at DESC
        LIMIT 50
    ) r;

    SELECT COALESCE(jsonb_agg(s), '[]'::jsonb)
    INTO stock_json
    FROM (
        SELECT
            id,
            'low_stock' as type,
            name,
            quantity,
            image,
            'low_stock' as notification_type,
            jsonb_build_object(
                'id', id,
                'name', name,
                'quantity', quantity,
                'image', image
            ) as data
        FROM public.products
        WHERE business_id = p_business_id
        AND quantity <= 3
        AND hasbeensold = true
        ORDER BY quantity ASC
        LIMIT 20
    ) s;

    SELECT COALESCE(jsonb_agg(n), '[]'::jsonb)
    INTO notif_json
    FROM (
        SELECT
            id,
            type,
            event,
            title,
            message,
            created_at as date,
            is_read as status,
            username,
            recipient_username,
            business_id,
            type as notification_type,
            COALESCE(data, '{}'::jsonb) as data,
            promoter_name,
            user_id,
            updated_at
        FROM notifications
        WHERE business_id = p_business_id
        AND type IN (
            'daily_combined_report',
            'manager_promoted',
            'manager-promoted',
            'outstanding_balances_reminder',
            'credit_sale_reminder',
            'loan_reminder',
            'task_reminder',
            'stock_alert'
        )
        AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 100
    ) n;

    result = jsonb_build_object(
        'tasks', tasks_json,
        'reminders', reminders_json,
        'low_stock', stock_json,
        'notifications', notif_json
    );

    RETURN result;
END;
$function$;


-- ============================================================
-- get_personal_loans_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_personal_loans_secure(p_business_id uuid)
RETURNS SETOF loans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.loans
    WHERE business_id = p_business_id
      AND loan_type = 'personal'
    ORDER BY created_at DESC;
END;
$function$;


-- ============================================================
-- get_product_type  (stock -> products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_product_type(p_product_id uuid, p_product_name text, p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_type TEXT;
BEGIN
    IF p_product_id IS NOT NULL THEN
        SELECT type INTO v_type
        FROM public.products
        WHERE id = p_product_id
        AND business_id = p_business_id;
    END IF;

    IF v_type IS NULL AND p_product_name IS NOT NULL THEN
        SELECT type INTO v_type
        FROM public.products
        WHERE name ILIKE p_product_name
        AND business_id = p_business_id
        LIMIT 1;
    END IF;

    RETURN COALESCE(v_type, 'product');
END;
$function$;


-- ============================================================
-- get_reminders_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_reminders_secure(p_business_id uuid)
RETURNS SETOF reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.reminders
    WHERE business_id = p_business_id
    ORDER BY created_at DESC;
END;
$function$;


-- ============================================================
-- get_sale_by_id_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sale_by_id_secure(p_id text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT row_to_json(s) INTO v_result
    FROM public.sales s
    WHERE s.business_id = p_business_id
      AND (s.id::text = p_id OR s.receipt_id = p_id)
    LIMIT 1;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_sales_by_date_range_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sales_by_date_range_secure(p_business_id uuid, p_start_date text, p_end_date text)
RETURNS SETOF sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT s.*
    FROM public.sales s
    WHERE s.business_id = p_business_id
      AND s.date_sold >= p_start_date::date
      AND s.date_sold <= p_end_date::date
    ORDER BY s.date_sold DESC, s.created_at DESC;
END;
$function$;


-- ============================================================
-- get_sales_by_receipt_id_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sales_by_receipt_id_secure(p_receipt_id text, p_business_id uuid)
RETURNS SETOF sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.sales
    WHERE business_id = p_business_id AND receipt_id = p_receipt_id
    ORDER BY created_at ASC;
END;
$function$;


-- ============================================================
-- get_stock_for_business  (stock -> products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_stock_for_business(p_business_id uuid)
RETURNS SETOF products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.products
    WHERE business_id = p_business_id
    ORDER BY name ASC;
END;
$function$;


-- ============================================================
-- get_stock_history_secure  (stock_history stays)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_stock_history_secure(
    p_business_id uuid,
    p_start_date text DEFAULT NULL::text,
    p_end_date text DEFAULT NULL::text
)
RETURNS SETOF stock_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
        RETURN QUERY
        SELECT * FROM public.stock_history
        WHERE business_id = p_business_id
          AND timestamp >= p_start_date::timestamptz
          AND timestamp <= p_end_date::timestamptz
        ORDER BY timestamp DESC;
    ELSE
        RETURN QUERY
        SELECT * FROM public.stock_history
        WHERE business_id = p_business_id
        ORDER BY timestamp DESC;
    END IF;
END;
$function$;


-- ============================================================
-- get_subcategory_analytics  (stock -> products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_subcategory_analytics(p_business_id uuid, p_subcategory text, p_year integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_items    jsonb;
    v_sales    jsonb;
    v_history  jsonb;
    v_summary  jsonb;
    v_result   jsonb;
    v_y0       date;
    v_y1       date;
    v_ts0      timestamptz;
    v_ts1      timestamptz;
BEGIN
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;
    IF p_subcategory IS NULL OR TRIM(p_subcategory) = '' THEN
        RAISE EXCEPTION 'SUBCATEGORY_REQUIRED';
    END IF;
    IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
        RAISE EXCEPTION 'INVALID_YEAR';
    END IF;

    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    v_y0  := make_date(p_year,     1, 1);
    v_y1  := make_date(p_year + 1, 1, 1);
    v_ts0 := make_timestamptz(p_year,     1, 1, 0, 0, 0);
    v_ts1 := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0);

    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      INTO v_items
      FROM public.products s
     WHERE s.business_id  = p_business_id
       AND s.subcategory  = p_subcategory;

    SELECT COALESCE(jsonb_agg(to_jsonb(sa)), '[]'::jsonb)
      INTO v_sales
      FROM public.sales sa
     WHERE sa.business_id = p_business_id
       AND sa.date_sold::date >= v_y0
       AND sa.date_sold::date <  v_y1
       AND EXISTS (
           SELECT 1
             FROM public.products st
            WHERE st.business_id = p_business_id
              AND st.subcategory = p_subcategory
              AND LOWER(st.name) = LOWER(sa.product_name)
       );

    SELECT COALESCE(jsonb_agg(to_jsonb(sh)), '[]'::jsonb)
      INTO v_history
      FROM public.stock_history sh
     WHERE sh.business_id = p_business_id
       AND sh.timestamp  >= v_ts0
       AND sh.timestamp  <  v_ts1
       AND EXISTS (
           SELECT 1
             FROM public.products st
            WHERE st.business_id = p_business_id
              AND st.subcategory = p_subcategory
              AND st.name        = sh.item_name
       );

    WITH items AS (
        SELECT id, name, quantity, price, cost_price
          FROM public.products
         WHERE business_id = p_business_id
           AND subcategory = p_subcategory
    ),
    sales_agg AS (
        SELECT LOWER(sa.product_name)   AS pname,
               COUNT(*)                 AS sales_count,
               COALESCE(SUM(sa.quantity), 0)     AS units_sold,
               COALESCE(SUM(sa.total_amount), 0) AS revenue
          FROM public.sales sa
         WHERE sa.business_id = p_business_id
           AND sa.date_sold::date >= v_y0
           AND sa.date_sold::date <  v_y1
         GROUP BY LOWER(sa.product_name)
    ),
    metrics AS (
        SELECT
            i.id,
            i.name,
            i.quantity,
            i.price,
            i.cost_price,
            COALESCE(s.sales_count, 0) AS sales_count,
            COALESCE(s.units_sold,  0) AS units_sold,
            COALESCE(s.revenue,     0) AS revenue,
            COALESCE(s.units_sold, 0) * COALESCE(i.cost_price, 0) AS cogs,
            COALESCE(i.price, 0)      * COALESCE(i.quantity, 0) AS stock_retail_value,
            COALESCE(i.cost_price, 0) * COALESCE(i.quantity, 0) AS stock_cost_value
          FROM items i
          LEFT JOIN sales_agg s ON LOWER(i.name) = s.pname
    )
    SELECT jsonb_build_object(
        'itemsCount',           COUNT(*),
        'totalStockQty',        COALESCE(SUM(quantity), 0),
        'totalStockRetailVal',  COALESCE(SUM(stock_retail_value), 0),
        'totalStockCostVal',    COALESCE(SUM(stock_cost_value), 0),
        'totalSalesCount',      COALESCE(SUM(sales_count), 0),
        'totalUnitsSold',       COALESCE(SUM(units_sold), 0),
        'totalRevenue',         COALESCE(SUM(revenue), 0),
        'totalCOGS',            COALESCE(SUM(cogs), 0),
        'grossProfit',          COALESCE(SUM(revenue), 0) - COALESCE(SUM(cogs), 0),
        'profitMargin',         CASE
                                    WHEN COALESCE(SUM(revenue), 0) > 0
                                    THEN ROUND(
                                        ( (COALESCE(SUM(revenue),0) - COALESCE(SUM(cogs),0))
                                          / COALESCE(SUM(revenue),1) ) * 100,
                                        2)
                                    ELSE 0
                                END,
        'lowStockCount',        COUNT(*) FILTER (WHERE quantity < 3 AND quantity > 0),
        'outOfStockCount',      COUNT(*) FILTER (WHERE quantity = 0),
        'itemsWithNoSales',     COALESCE(
                                    jsonb_agg(name) FILTER (WHERE units_sold = 0 AND name IS NOT NULL),
                                    '[]'::jsonb
                                ),
        'bestSeller',           (SELECT jsonb_build_object(
                                            'name',       name,
                                            'unitsSold',  units_sold,
                                            'revenue',    revenue
                                        )
                                   FROM metrics
                                  WHERE units_sold > 0
                                  ORDER BY units_sold DESC, revenue DESC
                                  LIMIT 1),
        'worstSeller',          (SELECT jsonb_build_object(
                                            'name',       name,
                                            'unitsSold',  units_sold,
                                            'revenue',    revenue
                                        )
                                   FROM metrics
                                  WHERE units_sold > 0
                                  ORDER BY units_sold ASC, revenue ASC
                                  LIMIT 1),
        'topRevenue',           (SELECT jsonb_build_object(
                                            'name',       name,
                                            'revenue',    revenue
                                        )
                                   FROM metrics
                                  WHERE revenue > 0
                                  ORDER BY revenue DESC
                                  LIMIT 1),
        'perItem',              (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                            'id',           id,
                                            'name',         name,
                                            'quantity',     quantity,
                                            'price',        price,
                                            'cost_price',   cost_price,
                                            'salesCount',   sales_count,
                                            'unitsSold',    units_sold,
                                            'revenue',      revenue,
                                            'cogs',         cogs,
                                            'profit',       revenue - cogs
                                        )), '[]'::jsonb)
                                   FROM metrics)
    )
    INTO v_summary
    FROM metrics;

    v_result := jsonb_build_object(
        'subcategory', p_subcategory,
        'year',        p_year,
        'items',       v_items,
        'sales',       v_sales,
        'history',     v_history,
        'summary',     v_summary
    );

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_tasks_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tasks_secure(p_business_id uuid)
RETURNS SETOF tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.tasks
    WHERE business_id = p_business_id
    ORDER BY created_at DESC;
END;
$function$;


-- ============================================================
-- get_transaction_detail_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_transaction_detail_secure(p_id text, p_type text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    IF p_type = 'sale' OR p_type = 'receipt' THEN
        SELECT row_to_json(s) INTO v_result
        FROM public.sales s
        WHERE s.business_id = p_business_id AND s.receipt_id = p_id
        LIMIT 1;
    ELSIF p_type = 'credit' THEN
        SELECT row_to_json(c) INTO v_result
        FROM public.credit_sales c
        WHERE c.business_id = p_business_id AND c.id::text = p_id
        LIMIT 1;
    END IF;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_user_by_email_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_by_email_secure(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    SELECT row_to_json(u) INTO v_result FROM public.users u WHERE u.email = p_email LIMIT 1;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_user_by_id_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_by_id_secure(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    SELECT row_to_json(u) INTO v_result FROM public.users u WHERE u.id = p_id LIMIT 1;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_user_by_singlebyourytid_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_by_singlebyourytid_secure(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result JSONB;
    v_user RECORD;
BEGIN
    SELECT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.business_id,
        u.created_at,
        u.updated_at,
        u.photo_url,
        u.phone,
        b.name as business_name,
        b.language as business_language,
        b.currency as business_currency
    INTO v_user
    FROM users u
    LEFT JOIN business_info b ON u.business_id = b.id
    WHERE u.id = p_user_id;

    IF v_user IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;

    result = jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_user.id,
            'username', v_user.username,
            'email', v_user.email,
            'full_name', v_user.full_name,
            'role', v_user.role,
            'business_id', v_user.business_id,
            'created_at', v_user.created_at,
            'updated_at', v_user.updated_at,
            'photo_url', v_user.photo_url,
            'phone', v_user.phone,
            'business_name', v_user.business_name,
            'business_language', v_user.business_language,
            'business_currency', v_user.business_currency
        )
    );

    UPDATE users
    SET last_login = NOW()
    WHERE id = p_user_id;

    RETURN result;
END;
$function$;


-- ============================================================
-- get_user_by_username_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_by_username_secure(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    SELECT row_to_json(u) INTO v_result FROM public.users u WHERE u.username = p_username LIMIT 1;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_user_feedback_for_dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_feedback_for_dashboard(p_limit integer DEFAULT 5000, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT *
        FROM public.user_feedback
        ORDER BY created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) f;

    RETURN v_rows;
END;
$function$;


-- ============================================================
-- get_user_profile_secure  (stock_history stays)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_profile_secure(p_username text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user public.users;
    v_sales_count int;
    v_history_count int;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT * INTO v_user
    FROM public.users
    WHERE username = p_username AND role IN ('sales', 'manager');

    IF v_user.id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*) INTO v_sales_count
    FROM public.sales
    WHERE username = p_username AND business_id = p_business_id;

    SELECT COUNT(*) INTO v_history_count
    FROM public.stock_history
    WHERE username = p_username AND business_id = p_business_id;

    RETURN jsonb_build_object(
        'user', row_to_json(v_user),
        'sales_count', v_sales_count,
        'history_count', v_history_count
    );
END;
$function$;


-- ============================================================
-- get_user_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_secure(p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT row_to_json(u.*) INTO v_result
    FROM public.users u
    WHERE u.id = p_user_id;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- get_user_setups_for_dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_setups_for_dashboard(p_limit integer DEFAULT 5000, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT *
        FROM public.user_setups
        ORDER BY created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) s;

    RETURN v_rows;
END;
$function$;


-- ============================================================
-- get_user_updates_for_dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_updates_for_dashboard(p_limit integer DEFAULT 5000, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT *
        FROM public.userupdate
        ORDER BY created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) u;

    RETURN v_rows;
END;
$function$;


-- ============================================================
-- get_users_by_role_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_by_role_secure(p_business_id uuid, p_role text)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    IF p_role = 'all_admins' THEN
        RETURN QUERY SELECT * FROM public.users WHERE role = 'administrator' AND business_id = p_business_id ORDER BY username ASC;
    ELSIF p_role = 'sales_managers' THEN
        RETURN QUERY SELECT * FROM public.users WHERE role IN ('sales', 'manager') AND business_id = p_business_id ORDER BY username ASC;
    ELSE
        RETURN QUERY SELECT * FROM public.users WHERE role = p_role AND business_id = p_business_id ORDER BY username ASC;
    END IF;
END;
$function$;


-- ============================================================
-- get_users_for_business_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_for_business_secure(p_business_id uuid)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.users
    WHERE business_id = p_business_id
    ORDER BY username ASC;
END;
$function$;


-- ============================================================
-- insert_business_info_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_business_info_secure(p_record jsonb, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    INSERT INTO public.business_info
    SELECT * FROM jsonb_populate_record(null::public.business_info, p_record)
    RETURNING row_to_json(business_info.*) INTO v_result;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_credit_sale_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_credit_sale_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    INSERT INTO public.credit_sales (
        product_name, type, quantity, price, total_amount, payment_type,
        date_sold, customer_name, receipt_id, credit_balance, advance_payment,
        user_id, business_id, username, created_at
    ) VALUES (
        p_record->>'product_name', COALESCE(p_record->>'type', 'product'),
        COALESCE((p_record->>'quantity')::numeric, 1), COALESCE((p_record->>'price')::numeric, 0),
        COALESCE((p_record->>'total_amount')::numeric, 0), COALESCE(p_record->>'payment_type', 'Credit'),
        COALESCE((p_record->>'date_sold')::date, CURRENT_DATE), p_record->>'customer_name',
        p_record->>'receipt_id', COALESCE((p_record->>'credit_balance')::numeric, 0),
        COALESCE((p_record->>'advance_payment')::numeric, 0),
        p_user_id, p_business_id, COALESCE(p_record->>'username', 'Unknown'), NOW()
    ) RETURNING row_to_json(public.credit_sales.*) INTO v_result;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_customer_receipt_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_customer_receipt_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    INSERT INTO public.customer_receipts (
        receipt_id, date, customer_name, cashier, customer_phone, items,
        amount_paid, balance_due, advance_payment_amount, advance_payment_date,
        payment_type_display, source, user_id, business_id, created_at
    ) VALUES (
        p_record->>'receipt_id', COALESCE((p_record->>'date')::date, CURRENT_DATE),
        p_record->>'customer_name', p_record->>'cashier', p_record->>'customer_phone',
        COALESCE((p_record->>'items')::jsonb, '[]'::jsonb),
        COALESCE((p_record->>'amount_paid')::numeric, 0), COALESCE((p_record->>'balance_due')::numeric, 0),
        COALESCE((p_record->>'advance_payment_amount')::numeric, 0), (p_record->>'advance_payment_date')::date,
        COALESCE(p_record->>'payment_type_display', 'Cash'), COALESCE(p_record->>'source', 'custom'),
        p_user_id, p_business_id, NOW()
    ) RETURNING row_to_json(public.customer_receipts.*) INTO v_result;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_expense_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_expense_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    INSERT INTO public.expenses (description, amount, date, category, notes, type, loan_id, user_id, business_id, username, created_at)
    VALUES (
        p_record->>'description', COALESCE((p_record->>'amount')::numeric, 0),
        COALESCE((p_record->>'date')::date, CURRENT_DATE), COALESCE(p_record->>'category', 'general'),
        p_record->>'notes', p_record->>'type', (p_record->>'loan_id')::uuid,
        p_user_id, p_business_id, COALESCE(p_record->>'username', 'Unknown'), NOW()
    ) RETURNING row_to_json(public.expenses.*) INTO v_result;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_loan_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_loan_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    INSERT INTO public.loans (borrower, borrower_contact, loan_type, amount, interest_rate, issue_date, due_date, purpose, status, repayments, user_id, business_id, created_by, created_at)
    VALUES (
        p_record->>'borrower', p_record->>'borrower_contact', COALESCE(p_record->>'loan_type', 'personal'),
        COALESCE((p_record->>'amount')::numeric, 0), COALESCE((p_record->>'interest_rate')::numeric, 0),
        COALESCE((p_record->>'issue_date')::date, CURRENT_DATE), (p_record->>'due_date')::date,
        p_record->>'purpose', COALESCE(p_record->>'status', 'Active'), COALESCE((p_record->>'repayments')::jsonb, '[]'::jsonb),
        p_user_id, p_business_id, COALESCE(p_record->>'created_by', 'Unknown'), NOW()
    ) RETURNING row_to_json(public.loans.*) INTO v_result;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_notification_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_notification_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    INSERT INTO public.notifications (
        type, event, username, promoter_name, message, recipient_username,
        is_read, user_id, business_id, created_at
    ) VALUES (
        p_record->>'type', p_record->>'event', p_record->>'username',
        p_record->>'promoter_name', p_record->>'message',
        COALESCE(p_record->>'recipient_username', 'all'),
        COALESCE((p_record->>'is_read')::boolean, false),
        p_user_id, p_business_id, NOW()
    ) RETURNING row_to_json(public.notifications.*) INTO v_result;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_reminder_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_reminder_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    INSERT INTO public.reminders (title, message, type, date, time, status, is_active, username, created_by, user_id, business_id, created_at)
    VALUES (
        p_record->>'title', p_record->>'message', COALESCE(p_record->>'type', 'once'),
        (p_record->>'date')::date, COALESCE(p_record->>'time', '09:00'), COALESCE(p_record->>'status', 'active'),
        COALESCE((p_record->>'is_active')::boolean, true), COALESCE(p_record->>'username', 'Unknown'),
        COALESCE(p_record->>'created_by', 'Unknown'), p_user_id, p_business_id, NOW()
    ) RETURNING row_to_json(public.reminders.*) INTO v_result;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_sale_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_sale_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
    v_id     uuid;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id',     p_user_id::text,     false);

    v_id := COALESCE(NULLIF(p_record->>'id', '')::uuid, gen_random_uuid());

    INSERT INTO public.sales (
        id,
        product_name,
        type,
        quantity,
        price,
        tax_rate,
        tax_amount,
        total_amount,
        amount_paid,
        credit_balance,
        payment_type,
        date_sold,
        customer_name,
        customer_phone,
        mobile_money_type,
        hybrid_breakdown,
        advance_payment,
        advance_payment_date,
        credit_status,
        receipt_id,
        product_id,
        username,
        user_id,
        business_id,
        created_at
    ) VALUES (
        v_id,
        p_record->>'product_name',
        COALESCE(NULLIF(p_record->>'type', ''), 'product'),
        COALESCE(ROUND((p_record->>'quantity')::numeric), 1)::integer,
        COALESCE((p_record->>'price')::numeric, 0),
        COALESCE((p_record->>'tax_rate')::numeric, 0),
        COALESCE((p_record->>'tax_amount')::numeric, 0),
        COALESCE((p_record->>'total_amount')::numeric, 0),
        COALESCE((p_record->>'amount_paid')::numeric, 0),
        COALESCE((p_record->>'credit_balance')::numeric, 0),
        COALESCE(NULLIF(p_record->>'payment_type', ''), 'Cash'),
        COALESCE(NULLIF(p_record->>'date_sold', '')::date, CURRENT_DATE),
        COALESCE(p_record->>'customer_name', ''),
        COALESCE(p_record->>'customer_phone', ''),
        COALESCE(p_record->>'mobile_money_type', ''),
        COALESCE(p_record->'hybrid_breakdown', '{}'::jsonb),
        COALESCE((p_record->>'advance_payment')::numeric, 0),
        NULLIF(p_record->>'advance_payment_date', '')::date,
        NULLIF(p_record->>'credit_status', ''),
        p_record->>'receipt_id',
        NULLIF(p_record->>'product_id', '')::uuid,
        COALESCE(p_record->>'username', ''),
        p_user_id,
        p_business_id,
        COALESCE(NULLIF(p_record->>'created_at', '')::timestamptz, NOW())
    )
    RETURNING row_to_json(public.sales.*) INTO v_result;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_sales_bulk_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_sales_bulk_secure(p_records jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    WITH forced_data AS (
        SELECT
            r->>'product_name' AS product_name,
            COALESCE(r->>'type', 'product') AS type,
            COALESCE((r->>'quantity')::numeric, 1) AS quantity,
            COALESCE((r->>'price')::numeric, 0) AS price,
            COALESCE((r->>'total_amount')::numeric, 0) AS total_amount,
            COALESCE(r->>'payment_type', 'Cash') AS payment_type,
            COALESCE((r->>'date_sold')::date, CURRENT_DATE) AS date_sold,
            r->>'customer_name' AS customer_name,
            r->>'receipt_id' AS receipt_id,
            p_user_id AS user_id,
            p_business_id AS business_id
        FROM jsonb_array_elements(p_records) r
    )
    INSERT INTO public.sales (
        product_name, type, quantity, price, total_amount, payment_type,
        date_sold, customer_name, receipt_id, user_id, business_id, created_at
    )
    SELECT *, NOW() FROM forced_data
    RETURNING jsonb_agg(row_to_json(public.sales.*)) INTO v_result;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;


-- ============================================================
-- insert_stock_history_secure  (stock_history stays)
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_stock_history_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result         jsonb;
    v_qty_raw        text;
    v_quantity_change numeric := 0;
BEGIN
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;

    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id',     p_user_id::text,     false);

    v_qty_raw := NULLIF(TRIM(COALESCE(p_record->>'quantity_change', '')), '');

    IF v_qty_raw IS NOT NULL AND v_qty_raw ~ '^[+-]?[0-9]+(\.[0-9]+)?$' THEN
        v_quantity_change := v_qty_raw::numeric;
    ELSE
        v_quantity_change := 0;
    END IF;

    WITH inserted AS (
        INSERT INTO public.stock_history (
            item_name,
            action,
            quantity_change,
            username,
            user_id,
            business_id,
            timestamp
        )
        VALUES (
            COALESCE(p_record->>'item_name', 'Unknown'),
            COALESCE(p_record->>'action',    'No action'),
            v_quantity_change,
            COALESCE(p_record->>'username',  'Unknown'),
            p_user_id,
            p_business_id,
            COALESCE(NULLIF(p_record->>'timestamp','')::timestamptz, NOW())
        )
        RETURNING *
    )
    SELECT to_jsonb(inserted) INTO v_result FROM inserted;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_stock_secure  (stock -> products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_stock_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result        jsonb;
    v_barcode       text;
    v_existing_name text;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id',     p_user_id::text,     false);

    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;

    v_barcode := NULLIF(TRIM(COALESCE(p_record->>'barcode', '')), '');

    IF v_barcode IS NOT NULL THEN
        SELECT s.name
          INTO v_existing_name
          FROM public.products AS s
         WHERE s.business_id = p_business_id
           AND s.barcode IS NOT NULL
           AND TRIM(s.barcode) <> ''
           AND (
                TRIM(s.barcode) = v_barcode
                OR (
                    TRIM(LEADING '0' FROM s.barcode) = TRIM(LEADING '0' FROM v_barcode)
                    AND TRIM(LEADING '0' FROM v_barcode) <> ''
                )
           )
         LIMIT 1;

        IF v_existing_name IS NOT NULL THEN
            RAISE EXCEPTION 'BARCODE_EXISTS_DB:%', v_existing_name;
        END IF;
    END IF;

    WITH inserted AS (
        INSERT INTO public.products (
            id, name, type, quantity, price, cost_price,
            barcode, image, category, subcategory, tax_rate,
            hasbeensold, username, date_added,
            user_id, business_id, created_at, updated_at
        )
        VALUES (
            COALESCE(NULLIF(p_record->>'id', '')::uuid, gen_random_uuid()),
            p_record->>'name',
            COALESCE(NULLIF(p_record->>'type', ''), 'product'),
            COALESCE(NULLIF(p_record->>'quantity',   '')::numeric, 0),
            NULLIF(p_record->>'price',      '')::numeric,
            NULLIF(p_record->>'cost_price', '')::numeric,
            v_barcode,
            NULLIF(p_record->>'image',   ''),
            NULLIF(p_record->>'category',    ''),
            NULLIF(p_record->>'subcategory', ''),
            COALESCE(NULLIF(p_record->>'tax_rate', '')::numeric, 0),
            COALESCE(NULLIF(p_record->>'hasbeensold', '')::boolean, false),
            NULLIF(p_record->>'username', ''),
            COALESCE(NULLIF(p_record->>'date_added', '')::timestamptz, NOW()),
            p_user_id,
            p_business_id,
            COALESCE(NULLIF(p_record->>'created_at', '')::timestamptz, NOW()),
            COALESCE(NULLIF(p_record->>'updated_at', '')::timestamptz, NOW())
        )
        RETURNING *
    )
    SELECT to_jsonb(inserted) INTO v_result FROM inserted;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- insert_task_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_task_secure(p_record jsonb, p_user_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);

    INSERT INTO public.tasks (title, description, assigned_to, created_by, due_date, status, is_announcement, is_active, user_id, business_id, created_at)
    VALUES (
        p_record->>'title', p_record->>'description', COALESCE(p_record->>'assigned_to', 'all'),
        COALESCE(p_record->>'created_by', 'Unknown'), (p_record->>'due_date')::date,
        COALESCE(p_record->>'status', 'pending'), COALESCE((p_record->>'is_announcement')::boolean, false),
        COALESCE((p_record->>'is_active')::boolean, true), p_user_id, p_business_id, NOW()
    ) RETURNING row_to_json(public.tasks.*) INTO v_result;
    RETURN v_result;
END;
$function$;


-- ============================================================
-- logout_all_sessions_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.logout_all_sessions_secure(p_token text, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM public.assert_session(p_token, p_business_id);
    DELETE FROM public.sessions WHERE business_id = p_business_id;
END;
$function$;


-- ============================================================
-- mark_notification_read_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read_secure(p_notification_id uuid, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    UPDATE public.notifications
    SET is_read = true, updated_at = NOW()
    WHERE id = p_notification_id;
END;
$function$;


-- ============================================================
-- process_supermarket_checkout  (stock -> products)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_supermarket_checkout(
    p_sales jsonb,
    p_stock_updates jsonb,
    p_history_inserts jsonb,
    p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    INSERT INTO public.sales
    SELECT * FROM jsonb_populate_recordset(null::public.sales, p_sales);

    IF p_stock_updates IS NOT NULL AND jsonb_array_length(p_stock_updates) > 0 THEN
        UPDATE public.products AS s
        SET
            quantity = u.quantity,
            hasbeensold = u.hasbeensold,
            updated_at = u.updated_at
        FROM jsonb_to_recordset(p_stock_updates) AS u(
            id uuid,
            quantity numeric,
            hasbeensold boolean,
            updated_at timestamp
        )
        WHERE s.id = u.id;
    END IF;

    IF p_history_inserts IS NOT NULL AND jsonb_array_length(p_history_inserts) > 0 THEN
        INSERT INTO public.stock_history
        SELECT * FROM jsonb_populate_recordset(null::public.stock_history, p_history_inserts);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Checkout processed successfully');
END;
$function$;


-- ============================================================
-- rls_auto_enable
-- ============================================================
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;


-- ============================================================
-- search_customer_suggestions_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_customer_suggestions_secure(p_search_term text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_suggestions jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT jsonb_agg(row_to_json(subq)) INTO v_suggestions
    FROM (
        SELECT name, MAX(phone) AS phone
        FROM (
            SELECT customer_name AS name, customer_phone AS phone FROM public.sales WHERE business_id = p_business_id AND customer_name ILIKE p_search_term
            UNION ALL
            SELECT customer_name AS name, customer_phone AS phone FROM public.credit_sales WHERE business_id = p_business_id AND customer_name ILIKE p_search_term
            UNION ALL
            SELECT name, phone FROM public.customers WHERE business_id = p_business_id AND name ILIKE p_search_term
        ) AS combined
        WHERE name IS NOT NULL AND TRIM(name) != '' AND TRIM(name) != 'Tapez le nom du client'
        GROUP BY name
        ORDER BY name ASC
        LIMIT 10
    ) AS subq;

    RETURN COALESCE(v_suggestions, '[]'::jsonb);
END;
$function$;


-- ============================================================
-- search_customers_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_customers_secure(p_search_term text, p_business_id uuid)
RETURNS SETOF customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.customers
    WHERE business_id = p_business_id
      AND (name ILIKE p_search_term OR phone ILIKE p_search_term)
    LIMIT 50;
END;
$function$;


-- ============================================================
-- set_business_created_by
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_business_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by = current_setting('app.current_user_id', TRUE)::UUID;
    END IF;
    RETURN NEW;
END;
$function$;


-- ============================================================
-- set_created_by_on_insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_created_by_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by = current_setting('app.current_user_id', TRUE)::UUID;
    END IF;
    RETURN NEW;
END;
$function$;


-- ============================================================
-- set_current_context
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_current_context(p_user_id uuid, p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
END;
$function$;


-- ============================================================
-- set_current_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_current_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, FALSE);
END;
$function$;


-- ============================================================
-- set_user_id_on_insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id = current_setting('app.current_user_id', TRUE)::UUID;
    END IF;
    RETURN NEW;
END;
$function$;


-- ============================================================
-- update_business_info_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_business_info_secure(p_id uuid, p_record jsonb, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    UPDATE public.business_info
    SET
        name                    = COALESCE(p_record->>'name', name),
        address                 = COALESCE(p_record->>'address', address),
        phone                   = COALESCE(p_record->>'phone', phone),
        phone_number_two        = COALESCE(p_record->>'phone_number_two', phone_number_two),
        email                   = COALESCE(p_record->>'email', email),
        website                 = COALESCE(p_record->>'website', website),
        social_media_handles    = COALESCE(p_record->>'social_media_handles', social_media_handles),
        details                 = COALESCE(p_record->>'details', details),
        logo_url                = COALESCE(p_record->>'logo_url', logo_url),
        currency                = COALESCE(p_record->>'currency', currency),
        language                = COALESCE(p_record->>'language', language),
        font_style              = COALESCE(p_record->>'font_style', font_style),
        warranty_duration       = COALESCE(NULLIF(p_record->>'warranty_duration','')::int, warranty_duration),
        warranty_unit           = COALESCE(p_record->>'warranty_unit', warranty_unit),
        warranty_text           = COALESCE(p_record->>'warranty_text', warranty_text),
        festive_badge_enabled   = COALESCE((p_record->>'festive_badge_enabled')::boolean, festive_badge_enabled),
        current_badge_index     = COALESCE(NULLIF(p_record->>'current_badge_index','')::int, current_badge_index),
        use_custom_badge        = COALESCE((p_record->>'use_custom_badge')::boolean, use_custom_badge),
        custom_badge_text       = COALESCE(p_record->>'custom_badge_text', custom_badge_text),
        setup_completed         = COALESCE((p_record->>'setup_completed')::boolean, setup_completed),
        description             = COALESCE(p_record->>'description', description),
        email_alerts_enabled    = COALESCE((p_record->>'email_alerts_enabled')::boolean, email_alerts_enabled),
        dashboard_preferences   = COALESCE(p_record->'dashboard_preferences', dashboard_preferences),
        supermarket_settings    = COALESCE(p_record->'supermarket_settings', supermarket_settings),
        updated_at              = NOW()
    WHERE id = p_id
    RETURNING row_to_json(business_info.*) INTO v_result;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Business % not found', p_id;
    END IF;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- update_credit_sale_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_credit_sale_secure(p_id uuid, p_record jsonb, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
    v_payments JSONB;
    v_status TEXT;
    v_credit_balance NUMERIC;
    v_date_paid DATE;
    v_paid_amount NUMERIC;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    v_status := COALESCE(p_record->>'status', 'pending');
    v_credit_balance := COALESCE((p_record->>'credit_balance')::NUMERIC, 0);
    v_paid_amount := COALESCE((p_record->>'paid_amount')::NUMERIC, 0);

    IF p_record->>'date_paid' IS NOT NULL AND p_record->>'date_paid' != '' THEN
        v_date_paid := (p_record->>'date_paid')::DATE;
    ELSE
        v_date_paid := NULL;
    END IF;

    v_payments := p_record->'payments';

    UPDATE public.credit_sales
    SET
        status = v_status,
        credit_balance = v_credit_balance,
        date_paid = v_date_paid,
        paid_amount = v_paid_amount,
        payments = CASE
            WHEN v_payments IS NOT NULL AND jsonb_array_length(v_payments) > 0
            THEN v_payments
            ELSE COALESCE(payments, '[]'::JSONB)
        END,
        updated_at = NOW()
    WHERE id = p_id
    AND business_id = p_business_id
    RETURNING row_to_json(public.credit_sales.*) INTO v_result;

    RETURN v_result;
END;
$function$;


-- ============================================================
-- update_customer_receipt_secure
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_customer_receipt_secure(p_receipt_id text, p_record jsonb, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_receipt public.customer_receipts;
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    SELECT * INTO v_receipt FROM public.customer_receipts WHERE receipt_id = p_receipt_id;

    IF v_receipt.id IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;

    v_receipt := jsonb_populate_record(v_receipt, p_record);
    v_receipt.updated_at = NOW();

    UPDATE public.customer_receipts
    SET
        date = v_receipt.date,
        customer_name = v_receipt.customer_name,
        cashier = v_receipt.cashier,
        customer_phone = v_receipt.customer_phone,
        items = v_receipt.items,
        amount_paid = v_receipt.amount_paid,
        balance_due = v_receipt.balance_due,
        advance_payment_amount = v_receipt.advance_payment_amount,
        advance_payment_date = v_receipt.advance_payment_date,
        payment_type_display = v_receipt.payment_type_display,
        source = v_receipt.source,
        updated_at = v_receipt.updated_at
    WHERE receipt_id = p_receipt_id
    RETURNING row_to_json(public.customer_receipts.*) INTO v_result;

    RETURN v_result;
END;
$function$;




CREATE OR REPLACE FUNCTION public.update_stock_secure(
    p_id uuid,
    p_record jsonb,
    p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_stock          public.products;
    v_result         jsonb;
    v_new_barcode    text;
    v_existing_name  text;
BEGIN
    -- ── Guards ───────────────────────────────────────────────────
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;

    -- Session context (RLS / triggers)
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    -- ── 1. Fetch existing row, SCOPED TO BUSINESS, with row lock ─
    SELECT *
      INTO v_stock
      FROM public.products
     WHERE id = p_id
       AND business_id = p_business_id          -- 🔒 cross-tenant guard
     FOR UPDATE;

    IF v_stock.id IS NULL THEN
        RAISE EXCEPTION 'STOCK_ITEM_NOT_FOUND';
    END IF;

    -- ── 2. Apply incoming fields ─────────────────────────────────
    v_stock := jsonb_populate_record(v_stock, p_record);
    v_stock.updated_at := NOW();

    -- ── 3. Barcode duplicate check (same business, excluding self) ─
    v_new_barcode := NULLIF(TRIM(COALESCE(v_stock.barcode, '')), '');

    IF v_new_barcode IS NOT NULL THEN
        SELECT s.name
          INTO v_existing_name
          FROM public.products AS s
         WHERE s.business_id = p_business_id
           AND s.id <> p_id
           AND s.barcode IS NOT NULL
           AND TRIM(s.barcode) <> ''
           AND (
                TRIM(s.barcode) = v_new_barcode
                OR (
                    TRIM(LEADING '0' FROM s.barcode) = TRIM(LEADING '0' FROM v_new_barcode)
                    AND TRIM(LEADING '0' FROM v_new_barcode) <> ''
                )
           )
         LIMIT 1;

        IF v_existing_name IS NOT NULL THEN
            RAISE EXCEPTION 'BARCODE_EXISTS_DB:%', v_existing_name;
        END IF;
    END IF;

    -- ── 4. Update, SCOPED TO BUSINESS, return full row as jsonb ──
    WITH updated AS (
        UPDATE public.products
           SET name        = v_stock.name,
               quantity    = v_stock.quantity,
               price       = v_stock.price,
               cost_price  = v_stock.cost_price,
               barcode     = v_new_barcode,
               image   = v_stock.image,
               category    = v_stock.category,
               subcategory = v_stock.subcategory,
               tax_rate    = v_stock.tax_rate,
               updated_at  = v_stock.updated_at
         WHERE id = p_id
           AND business_id = p_business_id
        RETURNING *
    )
    SELECT to_jsonb(updated) INTO v_result FROM updated;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'STOCK_ITEM_NOT_FOUND';
    END IF;

    RETURN v_result;
END;
$$;