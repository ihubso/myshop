


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."activate_license_secure"("p_user_id" "uuid", "p_business_id" "uuid", "p_business_name" "text", "p_business_email" "text", "p_business_phone" "text", "p_owner_name" "text", "p_currency" "text", "p_language" "text", "p_plan" "text", "p_interval" "text", "p_amount" numeric, "p_reference" "text", "p_payment_method" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_new_business_id uuid;
    v_business record;
    v_expiry timestamptz;
    v_result jsonb;
BEGIN
    -- Calculate expiry based on interval
    IF p_interval = 'yearly' THEN
        v_expiry := NOW() + INTERVAL '1 year';
    ELSE
        v_expiry := NOW() + INTERVAL '1 month';
    END IF;

    -- Check if business already exists
    SELECT * INTO v_business FROM public.business_info WHERE id = p_business_id;

    IF v_business.id IS NULL THEN
        -- Create new business
        INSERT INTO public.business_info (
            name, email, phone, owner_name, currency, language, 
            license_status, license_plan, license_expires_at, license_activated_at
        ) VALUES (
            p_business_name, p_business_email, p_business_phone, p_owner_name, p_currency, p_language,
            'active', p_plan, v_expiry, NOW()
        ) RETURNING id INTO v_new_business_id;
        
        -- Link user to the new business
        UPDATE public.users SET business_id = v_new_business_id WHERE id = p_user_id;
    ELSE
        -- Update existing business license
        UPDATE public.business_info SET
            license_status = 'active',
            license_plan = p_plan,
            license_expires_at = v_expiry,
            license_activated_at = NOW()
        WHERE id = p_business_id;
        v_new_business_id := p_business_id;
    END IF;

    -- Record the transaction securely
    INSERT INTO public.transactions (
        user_id, business_id, reference, plan, amount, interval, status, payment_method, is_subscription, created_at
    ) VALUES (
        p_user_id, v_new_business_id, p_reference, p_plan, p_amount, p_interval, 'completed', p_payment_method, (p_payment_method = 'paystack_subscription'), NOW()
    );

    -- Return the fully activated business info
    SELECT row_to_json(b) INTO v_result FROM public.business_info b WHERE b.id = v_new_business_id;
    RETURN v_result;
END; $$;


ALTER FUNCTION "public"."activate_license_secure"("p_user_id" "uuid", "p_business_id" "uuid", "p_business_name" "text", "p_business_email" "text", "p_business_phone" "text", "p_owner_name" "text", "p_currency" "text", "p_language" "text", "p_plan" "text", "p_interval" "text", "p_amount" numeric, "p_reference" "text", "p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_session"("p_token" "text", "p_business_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

    -- Refresh last_seen_at (cheap: one row update)
    UPDATE public.sessions
       SET last_seen_at = now()
     WHERE token = p_token;

    RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."assert_session"("p_token" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_session_user"("p_token" "text", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."assert_session_user"("p_token" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists_secure"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_exists boolean;
BEGIN
    -- Check if the email exists in the users table
    SELECT EXISTS (
        SELECT 1 FROM public.users WHERE email = p_email
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;


ALTER FUNCTION "public"."check_email_exists_secure"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row public.rate_limits;
BEGIN
  IF p_max <= 0 OR p_window_seconds <= 0 THEN
    RETURN false;   -- defensive: invalid config always denies
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
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_username_exists_secure"("p_username" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_exists boolean;
BEGIN
    -- Check if the username exists in the users table
    SELECT EXISTS (
        SELECT 1 FROM public.users WHERE username = p_username
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;


ALTER FUNCTION "public"."check_username_exists_secure"("p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_ephemeral_tables"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_deleted int;
BEGIN
  -- password_reset_codes
  DELETE FROM public.password_reset_codes
  WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day')
     OR (expires_at  IS NOT NULL AND expires_at  < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'password_reset_codes: %', v_deleted;

  -- password_reset_tokens
  DELETE FROM public.password_reset_tokens
  WHERE (used_at    IS NOT NULL AND used_at    < now() - interval '1 day')
     OR (expires_at IS NOT NULL AND expires_at < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'password_reset_tokens: %', v_deleted;

  -- password_reset_attempts
  DELETE FROM public.password_reset_attempts
  WHERE (locked_until IS NULL OR locked_until < now() - interval '1 day')
    AND COALESCE(failed_attempts, 0) = 0;
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'password_reset_attempts: %', v_deleted;

  -- email_verifications
  DELETE FROM public.email_verifications
  WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day')
     OR (expires_at  IS NOT NULL AND expires_at  < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'email_verifications: %', v_deleted;

  -- verified_emails
  DELETE FROM public.verified_emails
  WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day')
     OR (expires_at  IS NOT NULL AND expires_at  < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'verified_emails: %', v_deleted;

  -- device_clear_challenges
  DELETE FROM public.device_clear_challenges
  WHERE (used_at    IS NOT NULL AND used_at    < now() - interval '1 day')
     OR (expires_at IS NOT NULL AND expires_at < now() - interval '1 day');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'device_clear_challenges: %', v_deleted;

  -- rate_limits  ← NEW
  DELETE FROM public.rate_limits WHERE reset_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'rate_limits: %', v_deleted;

  -- user_sessions
  DELETE FROM public.user_sessions
  WHERE (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days')
     OR (expires_at IS NOT NULL AND expires_at < now() - interval '30 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'user_sessions: %', v_deleted;

  -- business_events
  DELETE FROM public.business_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RAISE NOTICE 'business_events: %', v_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_ephemeral_tables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Delete notifications older than 21 days (3 weeks) for specific types
    DELETE FROM public.notifications
    WHERE created_at < NOW() - INTERVAL '21 days'
    AND type IN ('daily_combined_report', 'manager_promoted', 'outstanding_balances_reminder');
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_sessions"("p_retention_hours" integer DEFAULT 24) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_cutoff  timestamptz := now() - make_interval(hours => p_retention_hours);
  v_deleted int;
BEGIN
  WITH deleted AS (
    DELETE FROM public.user_sessions
    WHERE (revoked_at IS NOT NULL OR expires_at < now())        -- dead
      AND COALESCE(last_seen_at, created_at) < v_cutoff         -- inactive 24h+
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_sessions"("p_retention_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_active_devices_secure"("p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.active_devices WHERE business_id = p_business_id;
END;
$$;


ALTER FUNCTION "public"."clear_active_devices_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_completed_tasks_secure"("p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.tasks
     WHERE status = 'completed'
       AND business_id = p_business_id;
END;
$$;


ALTER FUNCTION "public"."clear_completed_tasks_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "text", "p_business_id" "uuid", "p_vapid_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
        vapid_key,           -- ← fixed: plain column name
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
        p_vapid_key,         -- ← fixed: bound parameter
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
$$;


ALTER FUNCTION "public"."create_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "text", "p_business_id" "uuid", "p_vapid_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_active_device_secure"("p_business_id" "uuid", "p_fingerprint" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    DELETE FROM public.active_devices 
    WHERE business_id = p_business_id AND device_fingerprint = p_fingerprint;
END;
$$;


ALTER FUNCTION "public"."delete_active_device_secure"("p_business_id" "uuid", "p_fingerprint" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_active_device_secure"("p_id" "uuid", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Set context for RLS
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- Delete the specific device, ensuring it belongs to this business
    DELETE FROM public.active_devices 
    WHERE id = p_id AND business_id = p_business_id;
END;
$$;


ALTER FUNCTION "public"."delete_active_device_secure"("p_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_note_secure"("p_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    
    -- Delete only if it belongs to this user (Defense in Depth)
    DELETE FROM public.notes WHERE id = p_id AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_note_secure"("p_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_reminder_secure"("p_id" "uuid", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.reminders WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_reminder_secure"("p_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_stock_secure"("p_id" "uuid", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- Delete the stock item
    DELETE FROM public.stock WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_stock_secure"("p_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_task_secure"("p_id" "uuid", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.tasks WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_task_secure"("p_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_secure"("p_username" "text", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    DELETE FROM public.users WHERE username = p_username;
END;
$$;


ALTER FUNCTION "public"."delete_user_secure"("p_username" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_business_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_business_id UUID;
  v_event_type  TEXT;
  v_payload     JSONB;
BEGIN
  -- Which row changed?
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

  ELSIF TG_TABLE_NAME = 'stock' THEN
    v_business_id := NEW.business_id;
    IF TG_OP = 'UPDATE' AND (OLD.quantity IS DISTINCT FROM NEW.quantity) THEN
      -- Only emit if we crossed the low-stock threshold
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

  -- If nothing matched, do nothing
  IF v_business_id IS NULL OR v_event_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert the event
  INSERT INTO public.business_events (business_id, event_type, payload)
  VALUES (v_business_id, v_event_type, v_payload);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."emit_business_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_dashboard_prefs_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."emit_dashboard_prefs_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_supermarket_settings_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."emit_supermarket_settings_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_user_role_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_event_type TEXT;
BEGIN
    -- Only fire on actual role changes
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
$$;


ALTER FUNCTION "public"."emit_user_role_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_business_rls"("tbl_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Drop old policies
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', tbl_name, tbl_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', tbl_name, tbl_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', tbl_name, tbl_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_blocked ON public.%I', tbl_name, tbl_name);

    -- Create new policies with app.current_business_id
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (business_id::text = current_setting(''app.current_business_id'', true))', tbl_name, tbl_name);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (business_id::text = current_setting(''app.current_business_id'', true))', tbl_name, tbl_name);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (business_id::text = current_setting(''app.current_business_id'', true)) WITH CHECK (business_id::text = current_setting(''app.current_business_id'', true))', tbl_name, tbl_name);
    EXECUTE format('CREATE POLICY %I_delete_blocked ON public.%I FOR DELETE USING (false)', tbl_name, tbl_name);
END;
$$;


ALTER FUNCTION "public"."fix_business_rls"("tbl_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_device_fingerprints_secure"("p_business_id" "uuid", "p_seven_days_ago" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- Returns a simple JSON array of strings, e.g., ["fp1", "fp2"]
    SELECT jsonb_agg(device_fingerprint) INTO v_result
    FROM public.active_devices
    WHERE business_id = p_business_id
      AND last_active >= p_seven_days_ago;
      
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_active_device_fingerprints_secure"("p_business_id" "uuid", "p_seven_days_ago" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_devices_secure"("p_business_id" "uuid") RETURNS TABLE("id" "uuid", "device_fingerprint" "text", "device_name" "text", "last_active" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Set context for RLS (if you have RLS on active_devices)
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- Return full device records ordered by most recently active
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
$$;


ALTER FUNCTION "public"."get_active_devices_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_profile_secure"("p_username" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user public.users;
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Get the user (only administrator role, case-insensitive username match)
    SELECT * INTO v_user 
    FROM public.users 
    WHERE LOWER(username) = LOWER(p_username) AND role = 'administrator';
    
    IF v_user.id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- 3. Return as JSON
    RETURN row_to_json(v_user);
END;
$$;


ALTER FUNCTION "public"."get_admin_profile_secure"("p_username" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_customers_secure"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_customers jsonb;
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Aggregate, deduplicate, and fill in missing phone numbers
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
    
    -- 3. Return empty array if no customers found
    RETURN COALESCE(v_customers, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_all_customers_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_app_events_for_dashboard"("p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 10000, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_app_events_for_dashboard"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_usernames_secure"("p_usernames" "text"[]) RETURNS SETOF "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Return usernames from the input array that DO NOT exist in the users table
    RETURN QUERY 
    SELECT username FROM unnest(p_usernames) AS username
    EXCEPT
    SELECT username FROM public.users;
END;
$$;


ALTER FUNCTION "public"."get_available_usernames_secure"("p_usernames" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_business_info_by_id_secure"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_id::text, false);
    SELECT row_to_json(b) INTO v_result FROM public.business_info b WHERE b.id = p_id LIMIT 1;
    RETURN v_result;
END; $$;


ALTER FUNCTION "public"."get_business_info_by_id_secure"("p_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."business_info" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT ''::"text",
    "address" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "email" "text" DEFAULT ''::"text",
    "website" "text" DEFAULT ''::"text",
    "details" "text" DEFAULT ''::"text",
    "logo_url" "text" DEFAULT ''::"text",
    "currency" "text" DEFAULT 'XAF'::"text",
    "language" "text" DEFAULT 'en'::"text",
    "setup_completed" boolean DEFAULT false,
    "owner_name" "text" DEFAULT ''::"text",
    "weekly_target" numeric DEFAULT 0,
    "monthly_target" numeric DEFAULT 0,
    "email_schedule" "jsonb" DEFAULT '{"enabled": false, "frequency": "daily"}'::"jsonb",
    "alert_types" "jsonb" DEFAULT '{"expiry": true, "restock": true, "lowStock": true}'::"jsonb",
    "warranty_duration" integer DEFAULT 0,
    "warranty_unit" "text" DEFAULT 'days'::"text",
    "warranty_text" "text" DEFAULT ''::"text",
    "font_style" "text" DEFAULT 'default'::"text",
    "festive_badge_enabled" boolean DEFAULT false,
    "current_badge_index" integer DEFAULT 0,
    "social_media_handles" "text" DEFAULT ''::"text",
    "phone_number_two" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "email_alerts_enabled" boolean DEFAULT false,
    "license_plan" "text",
    "license_status" "text" DEFAULT 'inactive'::"text",
    "license_expires_at" timestamp with time zone,
    "license_activated_at" timestamp with time zone,
    "max_devices" integer DEFAULT 1,
    "custom_badge_text" "text",
    "use_custom_badge" boolean,
    "created_by" "uuid",
    "dashboard_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "supermarket_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by_name" "text"
);


ALTER TABLE "public"."business_info" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_business_info_secure"("p_business_id" "uuid") RETURNS SETOF "public"."business_info"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    RETURN QUERY SELECT * FROM public.business_info WHERE id = p_business_id;
END;
$$;


ALTER FUNCTION "public"."get_business_info_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_sale_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Fetch the credit sale by receipt_id
    SELECT row_to_json(cs) INTO v_result
    FROM public.credit_sales cs
    WHERE cs.receipt_id = p_receipt_id
    LIMIT 1;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_credit_sale_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_name" "text",
    "quantity" integer DEFAULT 1,
    "price" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(15,2) DEFAULT 0,
    "customer_name" "text" DEFAULT ''::"text",
    "customer_phone" "text" DEFAULT ''::"text",
    "advance_payment" numeric(15,2) DEFAULT 0,
    "advance_payment_date" "date",
    "credit_balance" numeric(15,2) DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "payments" "jsonb" DEFAULT '[]'::"jsonb",
    "related_sale_id" "text",
    "paid_amount" numeric DEFAULT 0,
    "date_paid" "date",
    "username" "text" DEFAULT ''::"text",
    "type" "text" DEFAULT 'product'::"text",
    "business_id" "uuid",
    "date_sold" "date",
    "payment_type" "text" DEFAULT 'Credit'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "receipt_id" "text",
    "user_id" "uuid",
    CONSTRAINT "credit_sales_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'partial'::"text", 'paid'::"text", 'unpaid'::"text", 'Active'::"text", 'active'::"text"])))
);


ALTER TABLE "public"."credit_sales" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_sales_secure"("p_business_id" "uuid") RETURNS SETOF "public"."credit_sales"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return all credit sales for this business, ordered by newest first
    RETURN QUERY 
    SELECT * FROM public.credit_sales 
    WHERE business_id = p_business_id 
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_credit_sales_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_receipt_secure"("p_receipt_id" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customer_receipt_secure"("p_receipt_id" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_receipts_list_secure"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Fetch only the needed columns, filtering out null/empty customer names
    SELECT jsonb_agg(row_to_json(s)) INTO v_result
    FROM (
        SELECT customer_name, id, product_name, date_sold
        FROM public.sales
        WHERE business_id = p_business_id
          AND customer_name IS NOT NULL
          AND TRIM(customer_name) != ''
        ORDER BY date_sold DESC
    ) s;
    
    -- 3. Return empty array if no results
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_customer_receipts_list_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_transactions_secure"("p_customer_name" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customer_transactions_secure"("p_customer_name" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_data_secure"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_stock jsonb;
    v_sales jsonb;
    v_start_prev_month date;
    v_end_today date;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    v_start_prev_month := date_trunc('month', current_date - interval '1 month')::date;
    v_end_today := current_date;

    -- Stock
    SELECT jsonb_agg(row_to_json(s)) INTO v_stock
    FROM (
        SELECT id, name, quantity, type, business_id, cost_price, price
        FROM public.stock
        WHERE business_id = p_business_id
        ORDER BY name ASC
    ) s;

    -- Sales: NOW WITH created_at
    SELECT jsonb_agg(row_to_json(sl)) INTO v_sales
    FROM (
        SELECT 
            id, product_name, quantity, price, total_amount, payment_type,
            username, business_id, type, date_sold, receipt_id, product_id,
            created_at                            -- 🔥 ADDED
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
$$;


ALTER FUNCTION "public"."get_dashboard_data_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_exchange_products_secure"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
        FROM public.stock
        WHERE business_id = p_business_id
          AND type = 'product'
          AND quantity > 0
        ORDER BY name ASC
    ) s;

    RETURN v_rows;
END;
$$;


ALTER FUNCTION "public"."get_exchange_products_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(15,2) DEFAULT 0,
    "category" "text" DEFAULT 'general'::"text",
    "date" "date" DEFAULT CURRENT_DATE,
    "type" "text" DEFAULT ''::"text",
    "notes" "text" DEFAULT ''::"text",
    "loan_id" "uuid",
    "username" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_expenses_secure"("p_business_id" "uuid") RETURNS SETOF "public"."expenses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return all expenses for this business, ordered by newest first
    RETURN QUERY 
    SELECT * FROM public.expenses 
    WHERE business_id = p_business_id 
    ORDER BY date DESC;
END;
$$;


ALTER FUNCTION "public"."get_expenses_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_combined_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text" DEFAULT NULL::"text", "p_customer_name" "text" DEFAULT NULL::"text", "p_date" "date" DEFAULT NULL::"date", "p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_limit    int := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 60);
  v_rows     jsonb;
  v_total    int;
BEGIN
  -- ── Guards ────────────────────────────────────────────────────────
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'BUSINESS_ID_REQUIRED' USING ERRCODE = '22004';
  END IF;

  -- ── Build the combined, deduped, normalized set once ──────────────
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
      -- status filter only applies to credit sales; ignore for receipts
      AND p_status IS NULL
  ),
  combined AS (
    SELECT * FROM credit
    UNION ALL
    SELECT * FROM receipts
  ),
  -- Dedupe by receiptId — prefer credit_sale if both exist, else whichever
  -- came first by created_at (matches your JS `seenReceiptIds` behavior)
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

  -- ── Response ──────────────────────────────────────────────────────
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
$$;


ALTER FUNCTION "public"."get_filtered_combined_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text", "p_customer_name" "text", "p_date" "date", "p_status" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_credit_sales_secure"("p_business_id" "uuid", "p_customer_name" "text" DEFAULT NULL::"text", "p_date" "date" DEFAULT NULL::"date", "p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result_data JSONB;
    current_user_id UUID;
    total_count INTEGER;
BEGIN
    -- 🔒 Verify caller's identity
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
            -- ✅ Safe: Just return payments as text to avoid JSON errors
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
$$;


ALTER FUNCTION "public"."get_filtered_credit_sales_secure"("p_business_id" "uuid", "p_customer_name" "text", "p_date" "date", "p_status" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_customer_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text" DEFAULT NULL::"text", "p_customer_name" "text" DEFAULT NULL::"text", "p_date" "date" DEFAULT NULL::"date", "p_limit" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result_data JSONB;
    current_user_id UUID;
    total_count INTEGER;
BEGIN
    -- 🔒 Verify caller's identity
    current_user_id := current_setting('app.current_user_id', true)::UUID;
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No user context set';
    END IF;

    -- 🔒 Validate business access
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'Invalid input: Business ID is required';
    END IF;

    -- 🔒 BUSINESS ISOLATION
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = current_user_id 
        AND business_id = p_business_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User does not belong to this business';
    END IF;

    -- 🔒 Enforce max 30 records
    IF p_limit > 30 THEN
        p_limit := 30;
    END IF;

    -- 🔒 Build query with filters
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
            -- Calculate receipt total from items JSONB
            COALESCE(
                (SELECT SUM((item->>'price')::NUMERIC) 
                 FROM jsonb_array_elements(cr.items) AS item),
                0
            ) AS receipt_total,
            -- Count items in receipt
            COALESCE(
                (SELECT COUNT(*) 
                 FROM jsonb_array_elements(cr.items)),
                0
            ) AS item_count,
            -- Check if receipt has refund items
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
$$;


ALTER FUNCTION "public"."get_filtered_customer_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text", "p_customer_name" "text", "p_date" "date", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_sales_receipts_secure"("p_business_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result_data JSONB;
    current_user_id UUID;
BEGIN
    -- 🔒 Verify caller's identity
    current_user_id := current_setting('app.current_user_id', true)::UUID;
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No user context set';
    END IF;

    -- 🔒 Validate business access
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'Invalid input: Business ID is required';
    END IF;

    -- 🔒 BUSINESS ISOLATION: User must belong to this business
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = current_user_id 
        AND business_id = p_business_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User does not belong to this business';
    END IF;

    -- 🔒 Build and execute query with date filtering
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
            -- Calculate profit margin if cost_price exists
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
$$;


ALTER FUNCTION "public"."get_filtered_sales_receipts_secure"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_grouped_subcategories"("p_business_id" "uuid", "p_year" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    -- 1. Units sold per product name (this year)
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

    -- 2. Every stock item joined with its sales numbers
    items AS (
        SELECT
            s.id,
            s.name,
            s.category,
            s.subcategory,
            s.quantity,
            s.price,
            s.cost_price,
            s.image_url,
            s.type,
            COALESCE(sa.units_sold,  0) AS units_sold,
            COALESCE(sa.revenue,     0) AS revenue,
            COALESCE(sa.sales_count, 0) AS sales_count
          FROM public.stock s
          LEFT JOIN sales_agg sa ON LOWER(s.name) = sa.pname
         WHERE s.business_id = p_business_id
    ),

    -- 3. Group items into subcategory buckets
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
                    'image_url',   image_url,
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

    -- 4. Build the response array
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
$$;


ALTER FUNCTION "public"."get_grouped_subcategories"("p_business_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_loan_by_id_secure"("p_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_loan_by_id_secure"("p_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "borrower" "text" DEFAULT ''::"text",
    "borrower_contact" "text" DEFAULT ''::"text",
    "loan_type" "text" DEFAULT 'personal'::"text",
    "amount" numeric(15,2) DEFAULT 0,
    "interest_rate" numeric DEFAULT 0,
    "issue_date" "date",
    "due_date" "date",
    "purpose" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'Active'::"text",
    "repayments" "jsonb" DEFAULT '[]'::"jsonb",
    "paid_date" "date",
    "marked_as_paid" boolean DEFAULT false,
    "created_by" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."loans" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_loans_secure"("p_business_id" "uuid") RETURNS SETOF "public"."loans"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return all loans for this business, ordered by newest first
    RETURN QUERY 
    SELECT * FROM public.loans 
    WHERE business_id = p_business_id 
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_loans_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text",
    "content" "text" DEFAULT ''::"text",
    "user_id" "uuid",
    "business_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notes_secure"("p_user_id" "uuid") RETURNS SETOF "public"."notes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    
    RETURN QUERY 
    SELECT * FROM public.notes 
    WHERE user_id = p_user_id 
    ORDER BY updated_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_notes_secure"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notification_secure"("p_notification_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_notification public.notifications;
BEGIN
    -- Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- Fetch the notification by ID
    SELECT * INTO v_notification 
    FROM public.notifications 
    WHERE id = p_notification_id;
    
    RETURN row_to_json(v_notification);
END;
$$;


ALTER FUNCTION "public"."get_notification_secure"("p_notification_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notifications_secure"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result JSONB;
    tasks_json JSONB;
    reminders_json JSONB;
    stock_json JSONB;
    notif_json JSONB;
BEGIN
    -- 1. Get tasks (pending and in-progress)
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

    -- 2. Get reminders (pending)
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

    -- 3. Get low stock items
    SELECT COALESCE(jsonb_agg(s), '[]'::jsonb)
    INTO stock_json
    FROM (
        SELECT 
            id,
            'low_stock' as type,
            name,
            quantity,
            image_url,
            'low_stock' as notification_type,
            jsonb_build_object(
                'id', id,
                'name', name,
                'quantity', quantity,
                'image_url', image_url
            ) as data
        FROM stock
        WHERE business_id = p_business_id
        AND quantity <= 3
        AND hasbeensold = true
        ORDER BY quantity ASC
        LIMIT 20
    ) s;

    -- 🔥 4. GET NOTIFICATIONS FROM NOTIFICATIONS TABLE (THIS WAS MISSING!)
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
        -- Include all important notification types
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
        -- Only get notifications from the last 30 days
        AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 100
    ) n;

    -- Combine all into one result
    result = jsonb_build_object(
        'tasks', tasks_json,
        'reminders', reminders_json,
        'low_stock', stock_json,
        'notifications', notif_json  -- 🔥 NOW INCLUDED!
    );

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_notifications_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_personal_loans_secure"("p_business_id" "uuid") RETURNS SETOF "public"."loans"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return ONLY personal loans for this business, ordered by newest first
    RETURN QUERY 
    SELECT * FROM public.loans 
    WHERE business_id = p_business_id 
      AND loan_type = 'personal'
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_personal_loans_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_type"("p_product_id" "uuid", "p_product_name" "text", "p_business_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_type TEXT;
BEGIN
    -- Try by product_id first
    IF p_product_id IS NOT NULL THEN
        SELECT type INTO v_type
        FROM public.stock
        WHERE id = p_product_id
        AND business_id = p_business_id;
    END IF;
    
    -- If not found, try by product_name
    IF v_type IS NULL AND p_product_name IS NOT NULL THEN
        SELECT type INTO v_type
        FROM public.stock
        WHERE name ILIKE p_product_name
        AND business_id = p_business_id
        LIMIT 1;
    END IF;
    
    -- Default to 'product'
    RETURN COALESCE(v_type, 'product');
END;
$$;


ALTER FUNCTION "public"."get_product_type"("p_product_id" "uuid", "p_product_name" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" DEFAULT ''::"text",
    "type" "text" DEFAULT 'once'::"text",
    "date" "date",
    "time" "text" DEFAULT '09:00'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "is_active" boolean DEFAULT true,
    "username" "text" DEFAULT ''::"text",
    "created_by" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "notified_at" timestamp with time zone
);


ALTER TABLE "public"."reminders" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_reminders_secure"("p_business_id" "uuid") RETURNS SETOF "public"."reminders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return all reminders for this business, ordered by newest first
    RETURN QUERY 
    SELECT * FROM public.reminders 
    WHERE business_id = p_business_id 
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_reminders_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sale_by_id_secure"("p_id" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Fetch the sale by EITHER the UUID (cast to text) OR the receipt_id
    SELECT row_to_json(s) INTO v_result
    FROM public.sales s
    WHERE s.business_id = p_business_id
      AND (s.id::text = p_id OR s.receipt_id = p_id)
    LIMIT 1;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_sale_by_id_secure"("p_id" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_name" "text" NOT NULL,
    "productname" "text",
    "quantity" integer DEFAULT 1,
    "price" numeric(15,2) DEFAULT 0,
    "total_amount" numeric(15,2) DEFAULT 0,
    "payment_type" "text" DEFAULT 'Cash'::"text",
    "customer_name" "text" DEFAULT ''::"text",
    "customer_phone" "text" DEFAULT ''::"text",
    "type" "text" DEFAULT 'product'::"text",
    "tax_rate" numeric DEFAULT 0,
    "tax_amount" numeric DEFAULT 0,
    "credit_balance" numeric DEFAULT 0,
    "amount_paid" numeric DEFAULT 0,
    "balance_due" numeric DEFAULT 0,
    "advance_payment" numeric DEFAULT 0,
    "advance_payment_date" "date",
    "mobile_money_type" "text" DEFAULT ''::"text",
    "hybrid_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "receipt_id" "text",
    "serial_number" "text",
    "refund_of" "text",
    "refund_reason" "text",
    "exchange_with" "text",
    "extra_paid" numeric DEFAULT 0,
    "product_id" "uuid",
    "exchange_product_id" "uuid",
    "is_exchange_extra" boolean DEFAULT false,
    "is_loan_repayment" boolean DEFAULT false,
    "loan_id" "uuid",
    "credit_sale_ref_id" "text",
    "credit_remaining" numeric,
    "credit_status" "text",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "username" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "date_sold" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" character varying(255),
    "unit_price" numeric(10,2),
    "total_price" numeric(10,2),
    "subtotal" numeric(10,2),
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_by_date_range_secure"("p_business_id" "uuid", "p_start_date" "text", "p_end_date" "text") RETURNS SETOF "public"."sales"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_sales_by_date_range_secure"("p_business_id" "uuid", "p_start_date" "text", "p_end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") RETURNS SETOF "public"."sales"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return all sales for this receipt_id, ordered by creation time
    RETURN QUERY 
    SELECT * FROM public.sales 
    WHERE business_id = p_business_id AND receipt_id = p_receipt_id
    ORDER BY created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'product'::"text",
    "category" "text" DEFAULT ''::"text",
    "subcategory" "text" DEFAULT ''::"text",
    "quantity" integer DEFAULT 0,
    "price" numeric(15,2) DEFAULT 0,
    "cost_price" numeric(15,2) DEFAULT 0,
    "image_url" "text" DEFAULT ''::"text",
    "date_added" "date" DEFAULT CURRENT_DATE,
    "hasbeensold" boolean DEFAULT false,
    "tax_rate" numeric DEFAULT 0,
    "created_by" "uuid",
    "username" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "barcode" "text",
    "user_id" "uuid",
    CONSTRAINT "stock_type_check" CHECK (("type" = ANY (ARRAY['product'::"text", 'service'::"text"])))
);


ALTER TABLE "public"."stock" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stock_for_business"("p_business_id" "uuid") RETURNS SETOF "public"."stock"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    RETURN QUERY
    SELECT * FROM public.stock
    WHERE business_id = p_business_id
    ORDER BY name ASC;
END;
$$;


ALTER FUNCTION "public"."get_stock_for_business"("p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_name" "text",
    "action" "text" DEFAULT ''::"text",
    "quantity_change" "text",
    "quantitychange" "text",
    "username" "text" DEFAULT ''::"text",
    "user_id" "uuid",
    "business_id" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" character varying(255),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_history" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stock_history_secure"("p_business_id" "uuid", "p_start_date" "text" DEFAULT NULL::"text", "p_end_date" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."stock_history"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return history with optional date filtering, ordered by newest first
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
$$;


ALTER FUNCTION "public"."get_stock_history_secure"("p_business_id" "uuid", "p_start_date" "text", "p_end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_subcategory_analytics"("p_business_id" "uuid", "p_subcategory" "text", "p_year" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    -- ── Guards ────────────────────────────────────────────────
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

    -- ── 1. Items in this subcategory ──────────────────────────
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      INTO v_items
      FROM public.stock s
     WHERE s.business_id  = p_business_id
       AND s.subcategory  = p_subcategory;

    -- ── 2. Sales this year whose product_name matches an item ─
    SELECT COALESCE(jsonb_agg(to_jsonb(sa)), '[]'::jsonb)
      INTO v_sales
      FROM public.sales sa
     WHERE sa.business_id = p_business_id
       AND sa.date_sold::date >= v_y0
       AND sa.date_sold::date <  v_y1
       AND EXISTS (
           SELECT 1
             FROM public.stock st
            WHERE st.business_id = p_business_id
              AND st.subcategory = p_subcategory
              AND LOWER(st.name) = LOWER(sa.product_name)
       );

    -- ── 3. History this year for those items ──────────────────
    SELECT COALESCE(jsonb_agg(to_jsonb(sh)), '[]'::jsonb)
      INTO v_history
      FROM public.stock_history sh
     WHERE sh.business_id = p_business_id
       AND sh.timestamp  >= v_ts0
       AND sh.timestamp  <  v_ts1
       AND EXISTS (
           SELECT 1
             FROM public.stock st
            WHERE st.business_id = p_business_id
              AND st.subcategory = p_subcategory
              AND st.name        = sh.item_name
       );

    -- ── 4. Per-item metrics + summary ─────────────────────────
    WITH items AS (
        SELECT id, name, quantity, price, cost_price
          FROM public.stock
         WHERE business_id = p_business_id
           AND subcategory = p_subcategory
    ),
    sales_agg AS (
        -- Aggregate once instead of a subquery per item
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
            -- COGS this year for this item
            COALESCE(s.units_sold, 0) * COALESCE(i.cost_price, 0) AS cogs,
            -- Stock value (retail + cost)
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

    -- ── 5. Bundle everything ──────────────────────────────────
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
$$;


ALTER FUNCTION "public"."get_subcategory_analytics"("p_business_id" "uuid", "p_subcategory" "text", "p_year" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "assigned_to" "text" DEFAULT 'all'::"text",
    "created_by" "text" DEFAULT ''::"text",
    "due_date" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "is_announcement" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "completed_at" timestamp with time zone,
    "completed_by" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tasks_secure"("p_business_id" "uuid") RETURNS SETOF "public"."tasks"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return all tasks for this business, ordered by newest first
    RETURN QUERY 
    SELECT * FROM public.tasks 
    WHERE business_id = p_business_id 
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_tasks_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_transaction_detail_secure"("p_id" "text", "p_type" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_transaction_detail_secure"("p_id" "text", "p_type" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_by_email_secure"("p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_result jsonb;
BEGIN
    SELECT row_to_json(u) INTO v_result FROM public.users u WHERE u.email = p_email LIMIT 1;
    RETURN v_result;
END; $$;


ALTER FUNCTION "public"."get_user_by_email_secure"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_by_id_secure"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_result jsonb;
BEGIN
    SELECT row_to_json(u) INTO v_result FROM public.users u WHERE u.id = p_id LIMIT 1;
    RETURN v_result;
END; $$;


ALTER FUNCTION "public"."get_user_by_id_secure"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_by_singlebyourytid_secure"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result JSONB;
    v_user RECORD;
BEGIN
    -- Get user with all their data
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

    -- Check if user exists
    IF v_user IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;

    -- Return user data as JSON
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

    -- Update last_login regardless (remove the is_active check)
    UPDATE users 
    SET last_login = NOW() 
    WHERE id = p_user_id;

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_user_by_singlebyourytid_secure"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_by_username_secure"("p_username" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_result jsonb;
BEGIN
    SELECT row_to_json(u) INTO v_result FROM public.users u WHERE u.username = p_username LIMIT 1;
    RETURN v_result;
END; $$;


ALTER FUNCTION "public"."get_user_by_username_secure"("p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_feedback_for_dashboard"("p_limit" integer DEFAULT 5000, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_feedback_for_dashboard"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile_secure"("p_username" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user public.users;
    v_sales_count int;
    v_history_count int;
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Get the user (only sales or manager roles)
    SELECT * INTO v_user 
    FROM public.users 
    WHERE username = p_username AND role IN ('sales', 'manager');
    
    IF v_user.id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- 3. Get their stats securely
    SELECT COUNT(*) INTO v_sales_count 
    FROM public.sales 
    WHERE username = p_username AND business_id = p_business_id;
    
    SELECT COUNT(*) INTO v_history_count 
    FROM public.stock_history 
    WHERE username = p_username AND business_id = p_business_id;
    
    -- 4. Return everything as a single JSON object
    RETURN jsonb_build_object(
        'user', row_to_json(v_user),
        'sales_count', v_sales_count,
        'history_count', v_history_count
    );
END;
$$;


ALTER FUNCTION "public"."get_user_profile_secure"("p_username" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_secure"("p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- Fetch the user and return as JSON
    SELECT row_to_json(u.*) INTO v_result 
    FROM public.users u 
    WHERE u.id = p_user_id;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_user_secure"("p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_setups_for_dashboard"("p_limit" integer DEFAULT 5000, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_setups_for_dashboard"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_updates_for_dashboard"("p_limit" integer DEFAULT 5000, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_updates_for_dashboard"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "password" "text",
    "full_name" "text" DEFAULT ''::"text",
    "first_name" "text" DEFAULT ''::"text",
    "surname" "text" DEFAULT ''::"text",
    "role" "text" DEFAULT 'sales'::"text",
    "email" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "address" "text" DEFAULT ''::"text",
    "is_owner" boolean DEFAULT false,
    "photo_url" "text" DEFAULT ''::"text",
    "photo" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "security_questions" "jsonb" DEFAULT '[]'::"jsonb",
    "promoted_at" timestamp with time zone,
    "demoted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "promoted_by" "text",
    "promotion_date_label" "date",
    "isOwner" "text",
    "created_by" "uuid",
    "ownerUserId" "text",
    "last_login" "text",
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "google_sub" "text",
    "created_by_name" "text",
    "bigmouse" boolean DEFAULT false,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['administrator'::"text", 'manager'::"text", 'sales'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_by_role_secure"("p_business_id" "uuid", "p_role" "text") RETURNS SETOF "public"."users"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_users_by_role_secure"("p_business_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_for_business_secure"("p_business_id" "uuid") RETURNS SETOF "public"."users"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Return all users for this business, ordered by username
    RETURN QUERY 
    SELECT * FROM public.users 
    WHERE business_id = p_business_id 
    ORDER BY username ASC;
END;
$$;


ALTER FUNCTION "public"."get_users_for_business_secure"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_business_info_secure"("p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    INSERT INTO public.business_info
    SELECT * FROM jsonb_populate_record(null::public.business_info, p_record)
    RETURNING row_to_json(business_info.*) INTO v_result;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."insert_business_info_secure"("p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_credit_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END; $$;


ALTER FUNCTION "public"."insert_credit_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_customer_receipt_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END; $$;


ALTER FUNCTION "public"."insert_customer_receipt_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_expense_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END; $$;


ALTER FUNCTION "public"."insert_expense_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_loan_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END; $$;


ALTER FUNCTION "public"."insert_loan_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_notification_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END; $$;


ALTER FUNCTION "public"."insert_notification_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_reminder_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END; $$;


ALTER FUNCTION "public"."insert_reminder_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
    v_id     uuid;
BEGIN
    -- 🔒 Set session context for any downstream triggers / RLS helpers
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id',     p_user_id::text,     false);

    -- Use client-generated id if present, otherwise generate
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
        user_id,        -- 🔥 FORCED
        business_id,    -- 🔥 FORCED
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
        p_user_id,      -- 🔥 Cannot be spoofed via JSON
        p_business_id,  -- 🔥 Cannot be spoofed via JSON
        COALESCE(NULLIF(p_record->>'created_at', '')::timestamptz, NOW())
    )
    RETURNING row_to_json(public.sales.*) INTO v_result;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."insert_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_sales_bulk_secure"("p_records" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    
    -- Force user_id and business_id on EVERY row in the bulk insert
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
END; $$;


ALTER FUNCTION "public"."insert_sales_bulk_secure"("p_records" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_stock_history_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    v_result         jsonb;
    v_qty_raw        text;
    v_quantity_change numeric := 0;
BEGIN
    -- ── Guards ───────────────────────────────────────────────────
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;

    -- Session context (RLS / triggers)
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id',     p_user_id::text,     false);

    -- ── Safe numeric parse ───────────────────────────────────────
    -- Accepts: "+3", "-2", "3.5", "3"
    -- Defaults to 0 for: NULL, "", "N/A", "abc", anything non-numeric
    v_qty_raw := NULLIF(TRIM(COALESCE(p_record->>'quantity_change', '')), '');

    IF v_qty_raw IS NOT NULL AND v_qty_raw ~ '^[+-]?[0-9]+(\.[0-9]+)?$' THEN
        v_quantity_change := v_qty_raw::numeric;
    ELSE
        v_quantity_change := 0;
    END IF;

    -- ── Atomic insert ────────────────────────────────────────────
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
$_$;


ALTER FUNCTION "public"."insert_stock_history_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_stock_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result        jsonb;
    v_barcode       text;
    v_existing_name text;
BEGIN
    -- Session context
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id',     p_user_id::text,     false);

    -- Guard: never proceed without a business
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_ID_REQUIRED';
    END IF;

    -- Normalise barcode: '' or whitespace → NULL
    v_barcode := NULLIF(TRIM(COALESCE(p_record->>'barcode', '')), '');

    ------------------------------------------------------------------
    -- BARCODE DUPLICATE CHECK — SCOPED TO p_business_id ONLY.
    -- Different businesses may share the same barcode.
    ------------------------------------------------------------------
    IF v_barcode IS NOT NULL THEN
        SELECT s.name
          INTO v_existing_name
          FROM public.stock AS s
         WHERE s.business_id = p_business_id           -- 🔒 SAME BUSINESS ONLY
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

    -- Atomic insert
    WITH inserted AS (
        INSERT INTO public.stock (
            id, name, type, quantity, price, cost_price,
            barcode, image_url, category, subcategory, tax_rate,
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
            NULLIF(p_record->>'image_url',   ''),
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
$$;


ALTER FUNCTION "public"."insert_stock_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_task_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END; $$;


ALTER FUNCTION "public"."insert_task_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."logout_all_sessions_secure"("p_token" "text", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.assert_session(p_token, p_business_id);
    DELETE FROM public.sessions WHERE business_id = p_business_id;
END;
$$;


ALTER FUNCTION "public"."logout_all_sessions_secure"("p_token" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read_secure"("p_notification_id" "uuid", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    UPDATE public.notifications
    SET is_read = true, updated_at = NOW()
    WHERE id = p_notification_id;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read_secure"("p_notification_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_supermarket_checkout"("p_sales" "jsonb", "p_stock_updates" "jsonb", "p_history_inserts" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context ONCE for the entire transaction (Bypasses PgBouncer drop)
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    -- 2. Batch insert ALL sales in one go
    INSERT INTO public.sales
    SELECT * FROM jsonb_populate_recordset(null::public.sales, p_sales);

    -- 3. Batch update ALL stock in one go (using a highly efficient JOIN)
    IF p_stock_updates IS NOT NULL AND jsonb_array_length(p_stock_updates) > 0 THEN
        UPDATE public.stock AS s
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

    -- 4. Batch insert ALL history logs in one go
    IF p_history_inserts IS NOT NULL AND jsonb_array_length(p_history_inserts) > 0 THEN
        INSERT INTO public.stock_history
        SELECT * FROM jsonb_populate_recordset(null::public.stock_history, p_history_inserts);
    END IF;

    -- Return success
    RETURN jsonb_build_object('success', true, 'message', 'Checkout processed successfully');
END;
$$;


ALTER FUNCTION "public"."process_supermarket_checkout"("p_sales" "jsonb", "p_stock_updates" "jsonb", "p_history_inserts" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_customer_suggestions_secure"("p_search_term" "text", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_suggestions jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- UNION ALL + GROUP BY elegantly merges names and fills in missing phone numbers
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
$$;


ALTER FUNCTION "public"."search_customer_suggestions_secure"("p_search_term" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" DEFAULT ''::"text",
    "email" "text" DEFAULT ''::"text",
    "address" "text" DEFAULT ''::"text",
    "notes" "text" DEFAULT ''::"text",
    "business_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_customers_secure"("p_search_term" "text", "p_business_id" "uuid") RETURNS SETOF "public"."customers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    RETURN QUERY 
    SELECT * FROM public.customers 
    WHERE business_id = p_business_id 
      AND (name ILIKE p_search_term OR phone ILIKE p_search_term)
    LIMIT 50;
END;
$$;


ALTER FUNCTION "public"."search_customers_secure"("p_search_term" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_business_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by = current_setting('app.current_user_id', TRUE)::UUID;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_business_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_created_by_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- If created_by is NULL, set it from current setting
    IF NEW.created_by IS NULL THEN
        NEW.created_by = current_setting('app.current_user_id', TRUE)::UUID;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_created_by_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_context"("p_user_id" "uuid", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
END;
$$;


ALTER FUNCTION "public"."set_current_context"("p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_user"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, FALSE);
END;
$$;


ALTER FUNCTION "public"."set_current_user"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_id_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- If user_id is NULL, set it from current setting
    IF NEW.user_id IS NULL THEN
        NEW.user_id = current_setting('app.current_user_id', TRUE)::UUID;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_user_id_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_business_info_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
        supermarket_settings    = COALESCE(p_record->'supermarket_settings', supermarket_settings),  -- ⬅️ NEW
        updated_at              = NOW()
    WHERE id = p_id
    RETURNING row_to_json(business_info.*) INTO v_result;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Business % not found', p_id;
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_business_info_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_credit_sale_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
    v_payments JSONB;
    v_status TEXT;
    v_credit_balance NUMERIC;
    v_date_paid DATE;
    v_paid_amount NUMERIC;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- Extract values
    v_status := COALESCE(p_record->>'status', 'pending');
    v_credit_balance := COALESCE((p_record->>'credit_balance')::NUMERIC, 0);
    v_paid_amount := COALESCE((p_record->>'paid_amount')::NUMERIC, 0);
    
    IF p_record->>'date_paid' IS NOT NULL AND p_record->>'date_paid' != '' THEN
        v_date_paid := (p_record->>'date_paid')::DATE;
    ELSE
        v_date_paid := NULL;
    END IF;
    
    v_payments := p_record->'payments';
    
    -- Update
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
$$;


ALTER FUNCTION "public"."update_credit_sale_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_receipt_secure"("p_receipt_id" "text", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_receipt public.customer_receipts;
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    SELECT * INTO v_receipt FROM public.customer_receipts WHERE receipt_id = p_receipt_id;
    
    IF v_receipt.id IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;
    
    -- Safely populate with new values (handles all type casting automatically!)
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
$$;


ALTER FUNCTION "public"."update_customer_receipt_secure"("p_receipt_id" "text", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_loan_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_loan public.loans;
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    SELECT * INTO v_loan FROM public.loans WHERE id = p_id;
    
    IF v_loan.id IS NULL THEN
        RAISE EXCEPTION 'Loan not found';
    END IF;
    
    -- Safely populate with new values (handles JSON array casting for 'repayments' automatically!)
    v_loan := jsonb_populate_record(v_loan, p_record);
    v_loan.updated_at = NOW();
    
    UPDATE public.loans
    SET 
        borrower = v_loan.borrower,
        borrower_contact = v_loan.borrower_contact,
        loan_type = v_loan.loan_type,
        amount = v_loan.amount,
        interest_rate = v_loan.interest_rate,
        issue_date = v_loan.issue_date,
        due_date = v_loan.due_date,
        purpose = v_loan.purpose,
        status = v_loan.status,
        repayments = v_loan.repayments,
        paid_date = v_loan.paid_date,
        updated_at = v_loan.updated_at
    WHERE id = p_id
    RETURNING row_to_json(public.loans.*) INTO v_result;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_loan_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reminder_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_reminder public.reminders;
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    SELECT * INTO v_reminder FROM public.reminders WHERE id = p_id;
    
    IF v_reminder.id IS NULL THEN
        RAISE EXCEPTION 'Reminder not found';
    END IF;
    
    -- Safely populate with new values (handles all type casting automatically!)
    v_reminder := jsonb_populate_record(v_reminder, p_record);
    v_reminder.updated_at = NOW();
    
    UPDATE public.reminders
    SET 
        title = v_reminder.title,
        message = v_reminder.message,
        date = v_reminder.date,
        time = v_reminder.time,
        type = v_reminder.type,
        status = v_reminder.status,
        is_active = v_reminder.is_active,
        completed_at = v_reminder.completed_at,
        updated_at = v_reminder.updated_at
    WHERE id = p_id
    RETURNING row_to_json(public.reminders.*) INTO v_result;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_reminder_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_advance_payment" numeric, "p_amount_paid" numeric, "p_balance_due" numeric, "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Update all sales rows matching this receipt_id
    UPDATE public.sales
    SET 
        advance_payment = p_advance_payment,
        amount_paid = p_amount_paid,
        balance_due = p_balance_due,
        updated_at = NOW()
    WHERE receipt_id = p_receipt_id;
END;
$$;


ALTER FUNCTION "public"."update_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_advance_payment" numeric, "p_amount_paid" numeric, "p_balance_due" numeric, "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_stock          public.stock;
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
      FROM public.stock
     WHERE id = p_id
       AND business_id = p_business_id          -- 🔒 cross-tenant guard
     FOR UPDATE;                                -- prevents concurrent updates racing

    IF v_stock.id IS NULL THEN
        RAISE EXCEPTION 'STOCK_ITEM_NOT_FOUND';
    END IF;

    -- ── 2. Apply incoming fields ─────────────────────────────────
    -- jsonb_populate_record only overwrites keys present in p_record;
    -- keys the frontend omitted keep their existing value.
    v_stock := jsonb_populate_record(v_stock, p_record);
    v_stock.updated_at := NOW();

    -- ── 3. Barcode duplicate check (same business, excluding self) ─
    v_new_barcode := NULLIF(TRIM(COALESCE(v_stock.barcode, '')), '');

    IF v_new_barcode IS NOT NULL THEN
        SELECT s.name
          INTO v_existing_name
          FROM public.stock AS s
         WHERE s.business_id = p_business_id         -- 🔒 same business only
           AND s.id <> p_id                          -- exclude self
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
        UPDATE public.stock
           SET name        = v_stock.name,
               quantity    = v_stock.quantity,
               price       = v_stock.price,
               cost_price  = v_stock.cost_price,
               barcode     = v_new_barcode,
               image_url   = v_stock.image_url,
               category    = v_stock.category,
               subcategory = v_stock.subcategory,
               tax_rate    = v_stock.tax_rate,
               updated_at  = v_stock.updated_at
         WHERE id = p_id
           AND business_id = p_business_id           -- 🔒 belt-and-braces
        RETURNING *
    )
    SELECT to_jsonb(updated) INTO v_result FROM updated;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'STOCK_ITEM_NOT_FOUND';
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_stock_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_task public.tasks;
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    SELECT * INTO v_task FROM public.tasks WHERE id = p_id;
    
    IF v_task.id IS NULL THEN
        RAISE EXCEPTION 'Task not found';
    END IF;
    
    -- Safely populate with new values (handles all type casting automatically!)
    v_task := jsonb_populate_record(v_task, p_record);
    v_task.updated_at = NOW();
    
    UPDATE public.tasks
    SET 
        title = v_task.title,
        description = v_task.description,
        assigned_to = v_task.assigned_to,
        created_by = v_task.created_by,
        due_date = v_task.due_date,
        status = v_task.status,
        is_announcement = v_task.is_announcement,
        is_active = v_task.is_active,
        completed_at = v_task.completed_at,
        completed_by = v_task.completed_by,
        updated_at = v_task.updated_at
    WHERE id = p_id
    RETURNING row_to_json(public.tasks.*) INTO v_result;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user          public.users;
  v_result        jsonb;
  v_new_email     text;
  v_current_email text;
  v_token         text;
  v_token_hash    text;
  v_verif_row     public.verified_emails;
  v_new_role      text;
  v_target_id     uuid;
BEGIN
  -- 1. Transaction-scoped business context (used by any RLS on children)
  PERFORM set_config('app.current_business_id', p_business_id::text, false);

  -- 2. Fetch user — MUST scope by business_id
  SELECT * INTO v_user
  FROM public.users
  WHERE username = p_username
    AND business_id = p_business_id;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  v_target_id := v_user.id;

  -- ═══════════════════════════════════════════════════════════════════
  -- 3. Email-change verification gate
  --    If p_record changes the email, require a valid verification_token
  --    from verified_emails (purpose='profile_change'). Consume it.
  -- ═══════════════════════════════════════════════════════════════════
  v_new_email     := NULLIF(trim(p_record->>'email'), '');
  v_current_email := v_user.email;

  IF v_new_email IS NOT NULL
     AND lower(v_new_email) IS DISTINCT FROM lower(coalesce(v_current_email, ''))
  THEN
    v_token := NULLIF(p_record->>'verification_token', '');

    IF v_token IS NULL THEN
      RAISE EXCEPTION 'Email change requires verification_token'
        USING ERRCODE = 'check_violation';
    END IF;

    v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

    SELECT * INTO v_verif_row
    FROM public.verified_emails
    WHERE lower(email) = lower(v_new_email)
      AND purpose      = 'profile_change'
      AND token_hash   = v_token_hash
      AND consumed_at  IS NULL
      AND expires_at   > now()
    LIMIT 1;

    IF v_verif_row.id IS NULL THEN
      RAISE EXCEPTION 'Invalid or expired verification_token'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.verified_emails
    SET consumed_at = now()
    WHERE id = v_verif_row.id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- 4. Role change guard — block privilege escalation
  --    Allowed transitions from this RPC:
  --      • no change
  --      • sales ↔ manager
  --      • administrator → administrator (no-op)
  --    Blocked:
  --      • anything → administrator  (use update_user_role_secure)
  --      • anything → owner          (never via profile update)
  --      • administrator → non-admin (use update_user_role_secure)
  -- ═══════════════════════════════════════════════════════════════════
  v_new_role := lower(coalesce(NULLIF(p_record->>'role', ''), v_user.role));

  IF v_new_role NOT IN ('sales', 'manager', 'administrator') THEN
    RAISE EXCEPTION 'Invalid role: %', v_new_role USING ERRCODE = 'check_violation';
  END IF;

  IF v_new_role = 'administrator'
     AND v_user.role IS DISTINCT FROM 'administrator' THEN
    RAISE EXCEPTION 'Cannot promote user to administrator via profile update'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_user.role = 'administrator'
     AND v_new_role <> 'administrator' THEN
    RAISE EXCEPTION 'Cannot demote administrator via profile update'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- 5. Populate the record with new values
  --    jsonb_populate_record ignores keys that aren't columns (like
  --    verification_token / email_verified), which is what we want.
  -- ═══════════════════════════════════════════════════════════════════
  v_user := jsonb_populate_record(v_user, p_record);
  v_user.updated_at := now();

  -- ═══════════════════════════════════════════════════════════════════
  -- 6. Update
  -- ═══════════════════════════════════════════════════════════════════
  UPDATE public.users SET
    first_name = v_user.first_name,
    surname    = v_user.surname,
    password   = v_user.password,
    photo_url  = v_user.photo_url,
    full_name  = v_user.full_name,
    role       = v_user.role,
    email      = v_user.email,
    phone      = v_user.phone,
    address    = v_user.address,
    updated_at = v_user.updated_at
  WHERE id = v_target_id
  RETURNING to_jsonb(users.*) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_user_profile_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
    v_user public.users;
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    -- 2. Fetch the existing user record
    SELECT * INTO v_user FROM public.users WHERE username = p_username;
    
    -- 3. Safely populate the record with new values from JSON. 
    -- This automatically handles all type casting (like text to timestamptz)!
    v_user := jsonb_populate_record(v_user, p_record);
    
    -- 4. Force updated_at to NOW()
    v_user.updated_at = NOW();
    
    -- 5. Update the database with the safely casted values
    UPDATE public.users
    SET 
        role = v_user.role,
        promoted_at = v_user.promoted_at,
        promoted_by = v_user.promoted_by,
        promotion_date_label = v_user.promotion_date_label,
        demoted_at = v_user.demoted_at,
        updated_at = v_user.updated_at
    WHERE username = p_username
    RETURNING row_to_json(public.users.*) INTO v_result;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_user_role_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);

    UPDATE public.users
    SET
        -- Identity
        username           = COALESCE(p_record->>'username',           username),
        password           = COALESCE(p_record->>'password',           password),

        -- Profile
        full_name          = COALESCE(p_record->>'full_name',          full_name),
        first_name         = COALESCE(p_record->>'first_name',         first_name),
        surname            = COALESCE(p_record->>'surname',            surname),
        email              = COALESCE(p_record->>'email',              email),
        phone              = COALESCE(p_record->>'phone',              phone),
        address            = COALESCE(p_record->>'address',            address),

        -- Media
        photo_url          = COALESCE(p_record->>'photo_url',          photo_url),
        photo              = COALESCE(p_record->>'photo',              photo),

        -- Organization
        role               = COALESCE(p_record->>'role',               role),
        business_id        = COALESCE((p_record->>'business_id')::uuid, business_id),
        is_owner           = COALESCE((p_record->>'is_owner')::boolean, is_owner),

        -- JSON blobs
        permissions        = COALESCE(p_record->'permissions',         permissions),
        security_questions = COALESCE(p_record->'security_questions',  security_questions),

        -- Promotion metadata
        promoted_at        = COALESCE((p_record->>'promoted_at')::timestamptz, promoted_at),
        demoted_at         = COALESCE((p_record->>'demoted_at')::timestamptz,   demoted_at),
        promoted_by        = COALESCE(p_record->>'promoted_by',        promoted_by),
        promotion_date_label = COALESCE((p_record->>'promotion_date_label')::date, promotion_date_label),

        -- Audit
        updated_at         = NOW()
    WHERE id = p_id
    RETURNING row_to_json(users.*) INTO v_result;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'User % not found', p_id;
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_user_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_active_device_secure"("p_business_id" "uuid", "p_device_fingerprint" "text", "p_device_name" "text", "p_last_active" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    INSERT INTO public.active_devices (business_id, device_fingerprint, device_name, last_active)
    VALUES (p_business_id, p_device_fingerprint, p_device_name, p_last_active)
    ON CONFLICT (business_id, device_fingerprint) 
    DO UPDATE SET 
        device_name = EXCLUDED.device_name,
        last_active = EXCLUDED.last_active;
END;
$$;


ALTER FUNCTION "public"."upsert_active_device_secure"("p_business_id" "uuid", "p_device_fingerprint" "text", "p_device_name" "text", "p_last_active" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_note_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    
    -- Insert or Update based on ID conflict, enforcing user_id and business_id
    INSERT INTO public.notes (id, title, content, user_id, business_id, updated_at)
    VALUES (
        (p_record->>'id')::uuid,
        p_record->>'title',
        p_record->>'content',
        p_user_id,
        p_business_id,
        COALESCE(NULLIF(p_record->>'updated_at', ''), NOW()::text)::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        user_id = EXCLUDED.user_id,
        business_id = EXCLUDED.business_id,
        updated_at = EXCLUDED.updated_at
    RETURNING row_to_json(public.notes.*) INTO v_result;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."upsert_note_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "uuid", "p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Set context for this exact transaction
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    
    -- 2. Upsert securely (handles both new subscriptions and updates)
    INSERT INTO public.push_subscriptions (
        endpoint, p256dh, auth, user_agent, user_id, business_id, created_at, updated_at
    ) VALUES (
        p_endpoint, p_p256dh, p_auth, p_user_agent, p_user_id, p_business_id, NOW(), NOW()
    )
    ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        user_id = EXCLUDED.user_id,
        business_id = EXCLUDED.business_id,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."upsert_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "uuid", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_backup_secure"("p_user_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    PERFORM set_config('app.current_business_id', p_business_id::text, false);
    
    INSERT INTO public.user_backups
    SELECT * FROM jsonb_populate_record(null::public.user_backups, p_record)
    ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        data = EXCLUDED.data,
        device_info = EXCLUDED.device_info,
        updated_at = EXCLUDED.updated_at
    RETURNING row_to_json(user_backups.*) INTO v_result;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."upsert_user_backup_secure"("p_user_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."active_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "device_fingerprint" "text" NOT NULL,
    "device_name" "text",
    "last_active" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."active_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_events" (
    "id" integer NOT NULL,
    "device_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb",
    "ip_hash" "text",
    "country" "text",
    "city" "text",
    "latitude" double precision,
    "longitude" double precision,
    "user_agent" "text",
    "username" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "version" "text",
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."app_events_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."app_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."app_events_id_seq" OWNED BY "public"."app_events"."id";



CREATE TABLE IF NOT EXISTS "public"."business_events" (
    "id" bigint NOT NULL,
    "business_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."business_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."business_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."business_events_id_seq" OWNED BY "public"."business_events"."id";



CREATE TABLE IF NOT EXISTS "public"."customer_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_id" "text" NOT NULL,
    "date" "date",
    "customer_name" "text" DEFAULT ''::"text",
    "cashier" "text" DEFAULT ''::"text",
    "customer_phone" "text" DEFAULT ''::"text",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "amount_paid" numeric DEFAULT 0,
    "balance_due" numeric DEFAULT 0,
    "advance_payment_amount" numeric DEFAULT 0,
    "advance_payment_date" "date",
    "payment_type_display" "text" DEFAULT 'Cash'::"text",
    "business_id" "uuid",
    "source" "text" DEFAULT 'custom'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "advance_payment" numeric DEFAULT '0'::numeric,
    "user_id" "uuid"
);


ALTER TABLE "public"."customer_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_clear_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "challenge_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."device_clear_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "purpose" "text" DEFAULT 'setup'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "event" "text" DEFAULT ''::"text",
    "username" "text",
    "promoter_name" "text",
    "message" "text" NOT NULL,
    "recipient_username" "text" DEFAULT 'all'::"text",
    "business_id" "uuid",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "data" "jsonb",
    "title" "text",
    "updated_at" timestamp with time zone,
    "user_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_attempts" (
    "user_id" "uuid" NOT NULL,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone
);


ALTER TABLE "public"."password_reset_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."password_reset_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "method" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message" "text" NOT NULL,
    "level" "text" DEFAULT 'info'::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "dismissible" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "link_url" "text",
    "link_label" "text",
    CONSTRAINT "platform_broadcasts_level_check" CHECK (("level" = ANY (ARRAY['info'::"text", 'warning'::"text", 'danger'::"text", 'success'::"text"]))),
    CONSTRAINT "platform_broadcasts_link_label_len" CHECK ((("link_label" IS NULL) OR ("length"("link_label") <= 60))),
    CONSTRAINT "platform_broadcasts_link_url_len" CHECK ((("link_url" IS NULL) OR ("length"("link_url") <= 500)))
);


ALTER TABLE "public"."platform_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "user_id" "text",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vapid_key" "text"
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_revoke_log" (
    "id" bigint NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid",
    "business_id" "uuid",
    "revoked_at" timestamp with time zone,
    "db_user" "text",
    "application_name" "text",
    "client_addr" "inet",
    "backend_pid" integer,
    "txid" bigint,
    "logged_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."session_revoke_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."session_revoke_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."session_revoke_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."session_revoke_log_id_seq" OWNED BY "public"."session_revoke_log"."id";



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "business_id" "uuid",
    "reference" "text" NOT NULL,
    "plan" "text" NOT NULL,
    "amount" integer NOT NULL,
    "interval" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payment_method" "text" DEFAULT 'paystack'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_subscription" boolean DEFAULT false
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_backups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "username" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "business_id" "uuid"
);


ALTER TABLE "public"."user_backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_feedback" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sentiment" "text" NOT NULL,
    "suggestions" "text" NOT NULL,
    "username" "text",
    "email" "text",
    "device_id" "text",
    "actions" "text",
    "install_date" "text",
    "country" "text",
    "city" "text",
    "latitude" double precision,
    "longitude" double precision,
    "user_agent" "text",
    "platform" "text",
    "language" "text",
    "status" "text" DEFAULT 'new'::"text",
    "reviewed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "feedback_sources" "text",
    "feedback_type" "text",
    "business_id" "uuid",
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_feedback" OWNER TO "postgres";


ALTER TABLE "public"."user_feedback" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_feedback_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "token" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_agent" "text",
    "ip_address" "text",
    "provider" "text" DEFAULT 'email'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "device_fingerprint" "text"
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_setups" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "username" "text" NOT NULL,
    "email" "text",
    "owner_name" "text",
    "business_name" "text",
    "business_address" "text",
    "business_phone" "text",
    "business_website" "text",
    "business_description" "text",
    "city" "text",
    "country" "text",
    "region" "text",
    "latitude" double precision,
    "longitude" double precision,
    "location_source" "text",
    "language" "text" DEFAULT 'en'::"text",
    "currency" "text" DEFAULT 'XAF'::"text",
    "warranty_duration" integer DEFAULT 0,
    "warranty_unit" "text" DEFAULT 'days'::"text",
    "device_id" "text",
    "ip_address" "text",
    "user_agent" "text",
    "setup_completed_at" timestamp with time zone DEFAULT "now"(),
    "app_version" "text" DEFAULT '1.0'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "business_id" "uuid",
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_setups" OWNER TO "postgres";


ALTER TABLE "public"."user_setups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_setups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."userupdate" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "username" "text" NOT NULL,
    "email" "text",
    "owner_name" "text",
    "business_name" "text",
    "business_address" "text",
    "business_phone" "text",
    "business_website" "text",
    "business_description" "text",
    "city" "text",
    "country" "text",
    "region" "text",
    "latitude" double precision,
    "longitude" double precision,
    "location_source" "text",
    "language" "text" DEFAULT 'en'::"text",
    "currency" "text" DEFAULT 'XAF'::"text",
    "warranty_duration" integer DEFAULT 0,
    "warranty_unit" "text" DEFAULT 'days'::"text",
    "device_id" "text",
    "ip_address" "text",
    "user_agent" "text",
    "setup_completed_at" timestamp with time zone DEFAULT "now"(),
    "app_version" "text" DEFAULT '1.0'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "business_id" "uuid",
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."userupdate" OWNER TO "postgres";


ALTER TABLE "public"."userupdate" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."userupdate_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."verified_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "business_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."verified_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visits" (
    "id" integer NOT NULL,
    "visitor_id" "text" NOT NULL,
    "page_url" "text" NOT NULL,
    "referrer" "text",
    "browser" "text",
    "browser_version" "text",
    "os" "text",
    "os_version" "text",
    "device_type" "text",
    "device_model" "text",
    "country" "text",
    "city" "text",
    "latitude" double precision,
    "longitude" double precision,
    "ip_hash" "text",
    "visited_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."visits_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."visits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."visits_id_seq" OWNED BY "public"."visits"."id";



ALTER TABLE ONLY "public"."app_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."app_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."business_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."business_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."session_revoke_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."session_revoke_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."visits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."visits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."active_devices"
    ADD CONSTRAINT "active_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_events"
    ADD CONSTRAINT "app_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_events"
    ADD CONSTRAINT "business_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_info"
    ADD CONSTRAINT "business_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_sales"
    ADD CONSTRAINT "credit_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_receipts"
    ADD CONSTRAINT "customer_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_receipts"
    ADD CONSTRAINT "customer_receipts_receipt_id_key" UNIQUE ("receipt_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_clear_challenges"
    ADD CONSTRAINT "device_clear_challenges_challenge_hash_key" UNIQUE ("challenge_hash");



ALTER TABLE ONLY "public"."device_clear_challenges"
    ADD CONSTRAINT "device_clear_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loans"
    ADD CONSTRAINT "loans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_attempts"
    ADD CONSTRAINT "password_reset_attempts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."password_reset_codes"
    ADD CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."platform_broadcasts"
    ADD CONSTRAINT "platform_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_revoke_log"
    ADD CONSTRAINT "session_revoke_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_history"
    ADD CONSTRAINT "stock_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock"
    ADD CONSTRAINT "stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."active_devices"
    ADD CONSTRAINT "unique_business_device" UNIQUE ("business_id", "device_fingerprint");



ALTER TABLE ONLY "public"."user_backups"
    ADD CONSTRAINT "user_backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_backups"
    ADD CONSTRAINT "user_backups_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."user_setups"
    ADD CONSTRAINT "user_setups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."userupdate"
    ADD CONSTRAINT "userupdate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verified_emails"
    ADD CONSTRAINT "verified_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verified_emails"
    ADD CONSTRAINT "verified_emails_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_app_events_device_date" ON "public"."app_events" USING "btree" ("device_id", "created_at");



CREATE INDEX "idx_app_events_type" ON "public"."app_events" USING "btree" ("event_type");



CREATE INDEX "idx_business_events_created" ON "public"."business_events" USING "btree" ("created_at");



CREATE INDEX "idx_business_events_lookup" ON "public"."business_events" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "idx_device_clear_biz_user" ON "public"."device_clear_challenges" USING "btree" ("business_id", "user_id", "expires_at" DESC);



CREATE INDEX "idx_email_verif_email" ON "public"."email_verifications" USING "btree" ("lower"("email"), "purpose", "created_at" DESC);



CREATE INDEX "idx_feedback_created_at" ON "public"."user_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_sentiment" ON "public"."user_feedback" USING "btree" ("sentiment");



CREATE INDEX "idx_feedback_status" ON "public"."user_feedback" USING "btree" ("status");



CREATE INDEX "idx_notes_business_id" ON "public"."notes" USING "btree" ("business_id");



CREATE INDEX "idx_notes_user_id" ON "public"."notes" USING "btree" ("user_id");



CREATE INDEX "idx_prc_user" ON "public"."password_reset_codes" USING "btree" ("user_id", "expires_at" DESC);



CREATE INDEX "idx_push_subs_business" ON "public"."push_subscriptions" USING "btree" ("business_id");



CREATE INDEX "idx_push_subs_created" ON "public"."push_subscriptions" USING "btree" ("created_at");



CREATE INDEX "idx_push_subs_endpoint" ON "public"."push_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "idx_reminders_due" ON "public"."reminders" USING "btree" ("date", "time", "is_active", "notified_at");



CREATE INDEX "idx_sessions_device" ON "public"."user_sessions" USING "btree" ("device_fingerprint");



CREATE INDEX "idx_sessions_expires" ON "public"."user_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_sessions_user" ON "public"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_transactions_business_id" ON "public"."transactions" USING "btree" ("business_id");



CREATE INDEX "idx_transactions_reference" ON "public"."transactions" USING "btree" ("reference");



CREATE INDEX "idx_transactions_status" ON "public"."transactions" USING "btree" ("status");



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");



CREATE INDEX "idx_user_setups_country" ON "public"."user_setups" USING "btree" ("country");



CREATE INDEX "idx_user_setups_created_at" ON "public"."user_setups" USING "btree" ("created_at");



CREATE INDEX "idx_user_setups_email" ON "public"."user_setups" USING "btree" ("email");



CREATE INDEX "idx_user_setups_username" ON "public"."user_setups" USING "btree" ("username");



CREATE INDEX "idx_userupdate_country" ON "public"."userupdate" USING "btree" ("country");



CREATE INDEX "idx_userupdate_created_at" ON "public"."userupdate" USING "btree" ("created_at");



CREATE INDEX "idx_userupdate_email" ON "public"."userupdate" USING "btree" ("email");



CREATE INDEX "idx_userupdate_username" ON "public"."userupdate" USING "btree" ("username");



CREATE INDEX "idx_verified_emails_email" ON "public"."verified_emails" USING "btree" ("lower"("email"), "purpose", "created_at" DESC);



CREATE INDEX "idx_visits_visited_at" ON "public"."visits" USING "btree" ("visited_at");



CREATE INDEX "idx_visits_visitor_id" ON "public"."visits" USING "btree" ("visitor_id");



CREATE UNIQUE INDEX "platform_broadcasts_one_active" ON "public"."platform_broadcasts" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "users_username_business_idx" ON "public"."users" USING "btree" ("username", COALESCE("business_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE OR REPLACE TRIGGER "set_active_devices_user_id" BEFORE INSERT ON "public"."active_devices" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_app_events_user_id" BEFORE INSERT ON "public"."app_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_business_info_created_by" BEFORE INSERT ON "public"."business_info" FOR EACH ROW EXECUTE FUNCTION "public"."set_business_created_by"();



CREATE OR REPLACE TRIGGER "set_credit_sales_user_id" BEFORE INSERT ON "public"."credit_sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_customer_receipts_user_id" BEFORE INSERT ON "public"."customer_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_customers_user_id" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_expenses_user_id" BEFORE INSERT ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_loans_user_id" BEFORE INSERT ON "public"."loans" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_notifications_user_id" BEFORE INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_reminders_user_id" BEFORE INSERT ON "public"."reminders" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_sales_user_id" BEFORE INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_stock_user_id" BEFORE INSERT ON "public"."stock" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_tasks_user_id" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_user_feedback_user_id" BEFORE INSERT ON "public"."user_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_user_setups_user_id" BEFORE INSERT ON "public"."user_setups" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_users_created_by" BEFORE INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_created_by_on_insert"();



CREATE OR REPLACE TRIGGER "set_userupdate_user_id" BEFORE INSERT ON "public"."userupdate" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "set_visits_user_id" BEFORE INSERT ON "public"."visits" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id_on_insert"();



CREATE OR REPLACE TRIGGER "trg_emit_credit" AFTER INSERT ON "public"."credit_sales" FOR EACH ROW EXECUTE FUNCTION "public"."emit_business_event"();



CREATE OR REPLACE TRIGGER "trg_emit_dashboard_prefs_change" AFTER UPDATE ON "public"."business_info" FOR EACH ROW EXECUTE FUNCTION "public"."emit_dashboard_prefs_change"();



CREATE OR REPLACE TRIGGER "trg_emit_receipt" AFTER INSERT ON "public"."customer_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."emit_business_event"();



CREATE OR REPLACE TRIGGER "trg_emit_sale" AFTER INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."emit_business_event"();



CREATE OR REPLACE TRIGGER "trg_emit_stock" AFTER UPDATE ON "public"."stock" FOR EACH ROW EXECUTE FUNCTION "public"."emit_business_event"();



CREATE OR REPLACE TRIGGER "trg_emit_supermarket_settings_change" AFTER UPDATE ON "public"."business_info" FOR EACH ROW EXECUTE FUNCTION "public"."emit_supermarket_settings_change"();



CREATE OR REPLACE TRIGGER "trg_emit_task" AFTER INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."emit_business_event"();



CREATE OR REPLACE TRIGGER "trg_emit_user_role_change" AFTER UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."emit_user_role_change"();



CREATE OR REPLACE TRIGGER "update_active_devices_updated_at" BEFORE UPDATE ON "public"."active_devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_app_events_updated_at" BEFORE UPDATE ON "public"."app_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expenses_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sales_updated_at" BEFORE UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_history_updated_at" BEFORE UPDATE ON "public"."stock_history" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_feedback_updated_at" BEFORE UPDATE ON "public"."user_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_setups_updated_at" BEFORE UPDATE ON "public"."user_setups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_userupdate_updated_at" BEFORE UPDATE ON "public"."userupdate" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_visits_updated_at" BEFORE UPDATE ON "public"."visits" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."active_devices"
    ADD CONSTRAINT "active_devices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business_info"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."active_devices"
    ADD CONSTRAINT "active_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."app_events"
    ADD CONSTRAINT "app_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."business_info"
    ADD CONSTRAINT "business_info_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."credit_sales"
    ADD CONSTRAINT "credit_sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."customer_receipts"
    ADD CONSTRAINT "customer_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."loans"
    ADD CONSTRAINT "loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business_info"("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."password_reset_attempts"
    ADD CONSTRAINT "password_reset_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_codes"
    ADD CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock"
    ADD CONSTRAINT "stock_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business_info"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_setups"
    ADD CONSTRAINT "user_setups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."userupdate"
    ADD CONSTRAINT "userupdate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



CREATE POLICY "Allow anon insert" ON "public"."userupdate" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon select" ON "public"."app_events" FOR SELECT USING (true);



CREATE POLICY "Allow anon select" ON "public"."userupdate" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous select" ON "public"."visits" FOR SELECT USING (true);



CREATE POLICY "Allow public read feedback" ON "public"."user_feedback" FOR SELECT USING (true);



CREATE POLICY "Block direct delete on active_devices" ON "public"."active_devices" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on business_info" ON "public"."business_info" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on credit_sales" ON "public"."credit_sales" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on customer_receipts" ON "public"."customer_receipts" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on customers" ON "public"."customers" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on expenses" ON "public"."expenses" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on loans" ON "public"."loans" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on notes" ON "public"."notes" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on notifications" ON "public"."notifications" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on push_subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on reminders" ON "public"."reminders" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on sales" ON "public"."sales" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on stock" ON "public"."stock" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on stock_history" ON "public"."stock_history" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on tasks" ON "public"."tasks" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on user_backups" ON "public"."user_backups" FOR DELETE USING (false);



CREATE POLICY "Block direct delete on users" ON "public"."users" FOR DELETE USING (false);



CREATE POLICY "Block direct insert on active_devices" ON "public"."active_devices" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on business_info" ON "public"."business_info" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on credit_sales" ON "public"."credit_sales" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on customer_receipts" ON "public"."customer_receipts" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on customers" ON "public"."customers" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on expenses" ON "public"."expenses" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on loans" ON "public"."loans" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on notes" ON "public"."notes" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on notifications" ON "public"."notifications" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on push_subscriptions" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on reminders" ON "public"."reminders" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on sales" ON "public"."sales" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on stock" ON "public"."stock" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on stock_history" ON "public"."stock_history" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on tasks" ON "public"."tasks" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on user_backups" ON "public"."user_backups" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct insert on users" ON "public"."users" FOR INSERT WITH CHECK (false);



CREATE POLICY "Block direct select on active_devices" ON "public"."active_devices" FOR SELECT USING (false);



CREATE POLICY "Block direct select on business_info" ON "public"."business_info" FOR SELECT USING (false);



CREATE POLICY "Block direct select on credit_sales" ON "public"."credit_sales" FOR SELECT USING (false);



CREATE POLICY "Block direct select on customer_receipts" ON "public"."customer_receipts" FOR SELECT USING (false);



CREATE POLICY "Block direct select on customers" ON "public"."customers" FOR SELECT USING (false);



CREATE POLICY "Block direct select on expenses" ON "public"."expenses" FOR SELECT USING (false);



CREATE POLICY "Block direct select on loans" ON "public"."loans" FOR SELECT USING (false);



CREATE POLICY "Block direct select on notes" ON "public"."notes" FOR SELECT USING (false);



CREATE POLICY "Block direct select on notifications" ON "public"."notifications" FOR SELECT USING (false);



CREATE POLICY "Block direct select on push_subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (false);



CREATE POLICY "Block direct select on reminders" ON "public"."reminders" FOR SELECT USING (false);



CREATE POLICY "Block direct select on sales" ON "public"."sales" FOR SELECT USING (false);



CREATE POLICY "Block direct select on stock" ON "public"."stock" FOR SELECT USING (false);



CREATE POLICY "Block direct select on stock_history" ON "public"."stock_history" FOR SELECT USING (false);



CREATE POLICY "Block direct select on tasks" ON "public"."tasks" FOR SELECT USING (false);



CREATE POLICY "Block direct select on user_backups" ON "public"."user_backups" FOR SELECT USING (false);



CREATE POLICY "Block direct select on users" ON "public"."users" FOR SELECT USING (false);



CREATE POLICY "Block direct update on active_devices" ON "public"."active_devices" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on business_info" ON "public"."business_info" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on credit_sales" ON "public"."credit_sales" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on customer_receipts" ON "public"."customer_receipts" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on customers" ON "public"."customers" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on expenses" ON "public"."expenses" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on loans" ON "public"."loans" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on notes" ON "public"."notes" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on notifications" ON "public"."notifications" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on push_subscriptions" ON "public"."push_subscriptions" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on reminders" ON "public"."reminders" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on sales" ON "public"."sales" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on stock" ON "public"."stock" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on stock_history" ON "public"."stock_history" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on tasks" ON "public"."tasks" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on user_backups" ON "public"."user_backups" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Block direct update on users" ON "public"."users" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."active_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "active_devices_delete" ON "public"."active_devices" FOR DELETE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "active_devices_delete_blocked" ON "public"."active_devices" FOR DELETE USING (false);



CREATE POLICY "active_devices_insert" ON "public"."active_devices" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "active_devices_select" ON "public"."active_devices" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "active_devices_update" ON "public"."active_devices" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."app_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_info" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_info_delete_blocked" ON "public"."business_info" FOR DELETE USING (false);



CREATE POLICY "business_info_insert" ON "public"."business_info" FOR INSERT WITH CHECK ((("id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "business_info_select" ON "public"."business_info" FOR SELECT USING ((("id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "business_info_update" ON "public"."business_info" FOR UPDATE USING ((("id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."credit_sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_sales_delete_blocked" ON "public"."credit_sales" FOR DELETE USING (false);



CREATE POLICY "credit_sales_insert" ON "public"."credit_sales" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "credit_sales_select" ON "public"."credit_sales" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "credit_sales_update" ON "public"."credit_sales" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."customer_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_receipts_delete_blocked" ON "public"."customer_receipts" FOR DELETE USING (false);



CREATE POLICY "customer_receipts_insert" ON "public"."customer_receipts" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "customer_receipts_select" ON "public"."customer_receipts" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "customer_receipts_update" ON "public"."customer_receipts" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_delete" ON "public"."customers" FOR DELETE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "customers_delete_blocked" ON "public"."customers" FOR DELETE USING (false);



CREATE POLICY "customers_insert" ON "public"."customers" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "customers_select" ON "public"."customers" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "customers_update" ON "public"."customers" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."device_clear_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_delete_blocked" ON "public"."expenses" FOR DELETE USING (false);



CREATE POLICY "expenses_insert" ON "public"."expenses" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "expenses_select" ON "public"."expenses" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "expenses_update" ON "public"."expenses" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."loans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loans_delete_blocked" ON "public"."loans" FOR DELETE USING (false);



CREATE POLICY "loans_insert" ON "public"."loans" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "loans_select" ON "public"."loans" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "loans_update" ON "public"."loans" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_delete" ON "public"."notes" FOR DELETE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "notes_delete_blocked" ON "public"."notes" FOR DELETE USING (false);



CREATE POLICY "notes_insert" ON "public"."notes" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "notes_select" ON "public"."notes" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "notes_update" ON "public"."notes" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_blocked" ON "public"."notifications" FOR DELETE USING (false);



CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."password_reset_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_insert_app_events" ON "public"."app_events" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "public_insert_user_feedback" ON "public"."user_feedback" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "public_insert_user_setups" ON "public"."user_setups" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "public_insert_userupdate" ON "public"."userupdate" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "public_insert_visits" ON "public"."visits" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_delete" ON "public"."push_subscriptions" FOR DELETE USING (("user_id" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "push_subscriptions_insert" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("user_id" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "push_subscriptions_select" ON "public"."push_subscriptions" FOR SELECT USING (("user_id" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "push_subscriptions_update" ON "public"."push_subscriptions" FOR UPDATE USING (("user_id" = "current_setting"('app.current_user_id'::"text", true))) WITH CHECK (("user_id" = "current_setting"('app.current_user_id'::"text", true)));



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reminders_delete" ON "public"."reminders" FOR DELETE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "reminders_delete_blocked" ON "public"."reminders" FOR DELETE USING (false);



CREATE POLICY "reminders_insert" ON "public"."reminders" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "reminders_select" ON "public"."reminders" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "reminders_update" ON "public"."reminders" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_delete_blocked" ON "public"."sales" FOR DELETE USING (false);



CREATE POLICY "sales_insert" ON "public"."sales" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "sales_select" ON "public"."sales" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "sales_update" ON "public"."sales" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "service_role_only" ON "public"."device_clear_challenges" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only" ON "public"."email_verifications" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only" ON "public"."password_reset_attempts" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only" ON "public"."password_reset_codes" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only" ON "public"."password_reset_tokens" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only" ON "public"."rate_limits" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only" ON "public"."verified_emails" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only_business_events" ON "public"."business_events" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "service_role_only_user_sessions" ON "public"."user_sessions" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."session_revoke_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_delete_blocked" ON "public"."stock" FOR DELETE USING (false);



ALTER TABLE "public"."stock_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_history_delete_blocked" ON "public"."stock_history" FOR DELETE USING (false);



CREATE POLICY "stock_history_insert" ON "public"."stock_history" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "stock_history_select" ON "public"."stock_history" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "stock_history_update" ON "public"."stock_history" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "stock_history_update_blocked" ON "public"."stock_history" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "stock_insert" ON "public"."stock" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "stock_select" ON "public"."stock" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "stock_update" ON "public"."stock" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_delete" ON "public"."tasks" FOR DELETE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "tasks_delete_blocked" ON "public"."tasks" FOR DELETE USING (false);



CREATE POLICY "tasks_insert" ON "public"."tasks" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "tasks_select" ON "public"."tasks" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "tasks_update" ON "public"."tasks" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_insert" ON "public"."transactions" FOR INSERT WITH CHECK ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "transactions_select" ON "public"."transactions" FOR SELECT USING ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "us_select" ON "public"."user_setups" FOR SELECT USING (true);



ALTER TABLE "public"."user_backups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_backups_insert" ON "public"."user_backups" FOR INSERT WITH CHECK ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "user_backups_select" ON "public"."user_backups" FOR SELECT USING ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "user_backups_update" ON "public"."user_backups" FOR UPDATE USING ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true))) WITH CHECK ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true)));



ALTER TABLE "public"."user_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_setups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_setups_insert" ON "public"."user_setups" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "user_setups_select" ON "public"."user_setups" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "user_setups_update" ON "public"."user_setups" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete_blocked" ON "public"."users" FOR DELETE USING (false);



CREATE POLICY "users_insert" ON "public"."users" FOR INSERT WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "users_insert_blocked" ON "public"."users" FOR INSERT WITH CHECK (false);



CREATE POLICY "users_select" ON "public"."users" FOR SELECT USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



CREATE POLICY "users_update" ON "public"."users" FOR UPDATE USING ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true))) WITH CHECK ((("business_id")::"text" = "current_setting"('app.current_business_id'::"text", true)));



ALTER TABLE "public"."userupdate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verified_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visits" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."sales";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."stock";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




































































































































































































































REVOKE ALL ON FUNCTION "public"."activate_license_secure"("p_user_id" "uuid", "p_business_id" "uuid", "p_business_name" "text", "p_business_email" "text", "p_business_phone" "text", "p_owner_name" "text", "p_currency" "text", "p_language" "text", "p_plan" "text", "p_interval" "text", "p_amount" numeric, "p_reference" "text", "p_payment_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_license_secure"("p_user_id" "uuid", "p_business_id" "uuid", "p_business_name" "text", "p_business_email" "text", "p_business_phone" "text", "p_owner_name" "text", "p_currency" "text", "p_language" "text", "p_plan" "text", "p_interval" "text", "p_amount" numeric, "p_reference" "text", "p_payment_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_session"("p_token" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_session"("p_token" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_session_user"("p_token" "text", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_session_user"("p_token" "text", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_email_exists_secure"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_email_exists_secure"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_username_exists_secure"("p_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_username_exists_secure"("p_username" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_ephemeral_tables"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_ephemeral_tables"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_sessions"("p_retention_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"("p_retention_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."clear_active_devices_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_active_devices_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."clear_completed_tasks_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_completed_tasks_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "text", "p_business_id" "uuid", "p_vapid_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "text", "p_business_id" "uuid", "p_vapid_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_active_device_secure"("p_business_id" "uuid", "p_fingerprint" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_active_device_secure"("p_business_id" "uuid", "p_fingerprint" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_active_device_secure"("p_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_active_device_secure"("p_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_note_secure"("p_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_note_secure"("p_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_reminder_secure"("p_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_reminder_secure"("p_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_stock_secure"("p_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_stock_secure"("p_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_task_secure"("p_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_task_secure"("p_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_user_secure"("p_username" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_user_secure"("p_username" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."emit_business_event"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."emit_business_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."emit_dashboard_prefs_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."emit_dashboard_prefs_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."emit_supermarket_settings_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."emit_supermarket_settings_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."emit_user_role_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."emit_user_role_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fix_business_rls"("tbl_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fix_business_rls"("tbl_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_active_device_fingerprints_secure"("p_business_id" "uuid", "p_seven_days_ago" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_active_device_fingerprints_secure"("p_business_id" "uuid", "p_seven_days_ago" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_active_devices_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_active_devices_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_profile_secure"("p_username" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_profile_secure"("p_username" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_all_customers_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_all_customers_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_app_events_for_dashboard"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_app_events_for_dashboard"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_app_events_for_dashboard"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_events_for_dashboard"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_available_usernames_secure"("p_usernames" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_available_usernames_secure"("p_usernames" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_business_info_by_id_secure"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_business_info_by_id_secure"("p_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."business_info" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_business_info_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_business_info_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_credit_sale_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_credit_sale_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."credit_sales" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_credit_sales_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_credit_sales_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_customer_receipt_secure"("p_receipt_id" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_customer_receipt_secure"("p_receipt_id" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_customer_receipts_list_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_customer_receipts_list_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_customer_transactions_secure"("p_customer_name" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_customer_transactions_secure"("p_customer_name" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_dashboard_data_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_dashboard_data_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_exchange_products_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_exchange_products_secure"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_expenses_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_expenses_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_filtered_combined_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text", "p_customer_name" "text", "p_date" "date", "p_status" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_filtered_combined_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text", "p_customer_name" "text", "p_date" "date", "p_status" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_filtered_credit_sales_secure"("p_business_id" "uuid", "p_customer_name" "text", "p_date" "date", "p_status" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_filtered_credit_sales_secure"("p_business_id" "uuid", "p_customer_name" "text", "p_date" "date", "p_status" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_filtered_customer_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text", "p_customer_name" "text", "p_date" "date", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_filtered_customer_receipts_secure"("p_business_id" "uuid", "p_receipt_id" "text", "p_customer_name" "text", "p_date" "date", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_filtered_sales_receipts_secure"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_filtered_sales_receipts_secure"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_grouped_subcategories"("p_business_id" "uuid", "p_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_grouped_subcategories"("p_business_id" "uuid", "p_year" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_loan_by_id_secure"("p_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_loan_by_id_secure"("p_id" "uuid", "p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."loans" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_loans_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_loans_secure"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_notes_secure"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_notes_secure"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_notification_secure"("p_notification_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_notification_secure"("p_notification_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_notifications_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_notifications_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_personal_loans_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_personal_loans_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_product_type"("p_product_id" "uuid", "p_product_name" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_product_type"("p_product_id" "uuid", "p_product_name" "text", "p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."reminders" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_reminders_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_reminders_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_sale_by_id_secure"("p_id" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_sale_by_id_secure"("p_id" "text", "p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_sales_by_date_range_secure"("p_business_id" "uuid", "p_start_date" "text", "p_end_date" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_sales_by_date_range_secure"("p_business_id" "uuid", "p_start_date" "text", "p_end_date" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."stock" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_stock_for_business"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_stock_for_business"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."stock_history" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_stock_history_secure"("p_business_id" "uuid", "p_start_date" "text", "p_end_date" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_stock_history_secure"("p_business_id" "uuid", "p_start_date" "text", "p_end_date" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_subcategory_analytics"("p_business_id" "uuid", "p_subcategory" "text", "p_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_subcategory_analytics"("p_business_id" "uuid", "p_subcategory" "text", "p_year" integer) TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_tasks_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_tasks_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_transaction_detail_secure"("p_id" "text", "p_type" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_transaction_detail_secure"("p_id" "text", "p_type" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_by_email_secure"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_by_email_secure"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_by_id_secure"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_by_id_secure"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_by_singlebyourytid_secure"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_by_singlebyourytid_secure"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_by_username_secure"("p_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_by_username_secure"("p_username" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_feedback_for_dashboard"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_feedback_for_dashboard"("p_limit" integer, "p_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_feedback_for_dashboard"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_feedback_for_dashboard"("p_limit" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_profile_secure"("p_username" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_profile_secure"("p_username" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_secure"("p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_secure"("p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_setups_for_dashboard"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_setups_for_dashboard"("p_limit" integer, "p_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_setups_for_dashboard"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_setups_for_dashboard"("p_limit" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_updates_for_dashboard"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_updates_for_dashboard"("p_limit" integer, "p_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_updates_for_dashboard"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_updates_for_dashboard"("p_limit" integer, "p_offset" integer) TO "authenticated";



GRANT ALL ON TABLE "public"."users" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_users_by_role_secure"("p_business_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_users_by_role_secure"("p_business_id" "uuid", "p_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_users_for_business_secure"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_users_for_business_secure"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_business_info_secure"("p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_business_info_secure"("p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_credit_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_credit_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_customer_receipt_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_customer_receipt_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_expense_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_expense_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_loan_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_loan_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_notification_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_notification_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_reminder_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_reminder_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_sale_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_sales_bulk_secure"("p_records" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_sales_bulk_secure"("p_records" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_stock_history_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_stock_history_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_stock_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_stock_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_task_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_task_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."logout_all_sessions_secure"("p_token" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."logout_all_sessions_secure"("p_token" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_notification_read_secure"("p_notification_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_notification_read_secure"("p_notification_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_supermarket_checkout"("p_sales" "jsonb", "p_stock_updates" "jsonb", "p_history_inserts" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_supermarket_checkout"("p_sales" "jsonb", "p_stock_updates" "jsonb", "p_history_inserts" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_customer_suggestions_secure"("p_search_term" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_customer_suggestions_secure"("p_search_term" "text", "p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_customers_secure"("p_search_term" "text", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_customers_secure"("p_search_term" "text", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_business_created_by"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_business_created_by"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_created_by_on_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_created_by_on_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_current_context"("p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_current_context"("p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_current_user"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_current_user"("user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_id_on_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_id_on_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_business_info_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_business_info_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_credit_sale_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_credit_sale_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_customer_receipt_secure"("p_receipt_id" "text", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_customer_receipt_secure"("p_receipt_id" "text", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_loan_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_loan_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_reminder_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_reminder_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_advance_payment" numeric, "p_amount_paid" numeric, "p_balance_due" numeric, "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_sales_by_receipt_id_secure"("p_receipt_id" "text", "p_advance_payment" numeric, "p_amount_paid" numeric, "p_balance_due" numeric, "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_stock_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_stock_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_updated_at_column"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_user_profile_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_user_profile_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_user_role_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_user_role_secure"("p_username" "text", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_user_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_user_secure"("p_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_active_device_secure"("p_business_id" "uuid", "p_device_fingerprint" "text", "p_device_name" "text", "p_last_active" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_active_device_secure"("p_business_id" "uuid", "p_device_fingerprint" "text", "p_device_name" "text", "p_last_active" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_note_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_note_secure"("p_record" "jsonb", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "uuid", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_push_subscription_secure"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text", "p_user_id" "uuid", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_user_backup_secure"("p_user_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_user_backup_secure"("p_user_id" "uuid", "p_record" "jsonb", "p_business_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."active_devices" TO "service_role";



GRANT ALL ON TABLE "public"."app_events" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."app_events" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."app_events" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."app_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."business_events" TO "anon";
GRANT ALL ON TABLE "public"."business_events" TO "authenticated";
GRANT ALL ON TABLE "public"."business_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."business_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."business_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."business_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customer_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."device_clear_challenges" TO "anon";
GRANT ALL ON TABLE "public"."device_clear_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."device_clear_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."email_verifications" TO "anon";
GRANT ALL ON TABLE "public"."email_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_attempts" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_codes" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_codes" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."platform_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."platform_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."session_revoke_log" TO "anon";
GRANT ALL ON TABLE "public"."session_revoke_log" TO "authenticated";
GRANT ALL ON TABLE "public"."session_revoke_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."session_revoke_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."session_revoke_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."session_revoke_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_backups" TO "service_role";



GRANT ALL ON TABLE "public"."user_feedback" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."user_feedback" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."user_feedback" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."user_feedback_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_feedback_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_feedback_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_setups" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."user_setups" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."user_setups" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."user_setups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_setups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_setups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."userupdate" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."userupdate" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."userupdate" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."userupdate_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."userupdate_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."userupdate_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."verified_emails" TO "anon";
GRANT ALL ON TABLE "public"."verified_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."verified_emails" TO "service_role";



GRANT ALL ON TABLE "public"."visits" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."visits" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."visits" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."visits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."visits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."visits_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "public_insert_app_events" on "public"."app_events";

drop policy "service_role_only_business_events" on "public"."business_events";

drop policy "service_role_only" on "public"."device_clear_challenges";

drop policy "service_role_only" on "public"."email_verifications";

drop policy "service_role_only" on "public"."password_reset_attempts";

drop policy "service_role_only" on "public"."password_reset_codes";

drop policy "service_role_only" on "public"."password_reset_tokens";

drop policy "service_role_only" on "public"."rate_limits";

drop policy "public_insert_user_feedback" on "public"."user_feedback";

drop policy "service_role_only_user_sessions" on "public"."user_sessions";

drop policy "public_insert_user_setups" on "public"."user_setups";

drop policy "public_insert_userupdate" on "public"."userupdate";

drop policy "service_role_only" on "public"."verified_emails";

drop policy "public_insert_visits" on "public"."visits";

revoke delete on table "public"."active_devices" from "anon";

revoke insert on table "public"."active_devices" from "anon";

revoke references on table "public"."active_devices" from "anon";

revoke select on table "public"."active_devices" from "anon";

revoke trigger on table "public"."active_devices" from "anon";

revoke truncate on table "public"."active_devices" from "anon";

revoke update on table "public"."active_devices" from "anon";

revoke delete on table "public"."active_devices" from "authenticated";

revoke insert on table "public"."active_devices" from "authenticated";

revoke references on table "public"."active_devices" from "authenticated";

revoke select on table "public"."active_devices" from "authenticated";

revoke trigger on table "public"."active_devices" from "authenticated";

revoke truncate on table "public"."active_devices" from "authenticated";

revoke update on table "public"."active_devices" from "authenticated";

revoke delete on table "public"."app_events" from "anon";

revoke references on table "public"."app_events" from "anon";

revoke trigger on table "public"."app_events" from "anon";

revoke truncate on table "public"."app_events" from "anon";

revoke update on table "public"."app_events" from "anon";

revoke delete on table "public"."app_events" from "authenticated";

revoke references on table "public"."app_events" from "authenticated";

revoke trigger on table "public"."app_events" from "authenticated";

revoke truncate on table "public"."app_events" from "authenticated";

revoke update on table "public"."app_events" from "authenticated";

revoke delete on table "public"."business_info" from "anon";

revoke insert on table "public"."business_info" from "anon";

revoke references on table "public"."business_info" from "anon";

revoke select on table "public"."business_info" from "anon";

revoke trigger on table "public"."business_info" from "anon";

revoke truncate on table "public"."business_info" from "anon";

revoke update on table "public"."business_info" from "anon";

revoke delete on table "public"."business_info" from "authenticated";

revoke insert on table "public"."business_info" from "authenticated";

revoke references on table "public"."business_info" from "authenticated";

revoke select on table "public"."business_info" from "authenticated";

revoke trigger on table "public"."business_info" from "authenticated";

revoke truncate on table "public"."business_info" from "authenticated";

revoke update on table "public"."business_info" from "authenticated";

revoke delete on table "public"."credit_sales" from "anon";

revoke insert on table "public"."credit_sales" from "anon";

revoke references on table "public"."credit_sales" from "anon";

revoke select on table "public"."credit_sales" from "anon";

revoke trigger on table "public"."credit_sales" from "anon";

revoke truncate on table "public"."credit_sales" from "anon";

revoke update on table "public"."credit_sales" from "anon";

revoke delete on table "public"."credit_sales" from "authenticated";

revoke insert on table "public"."credit_sales" from "authenticated";

revoke references on table "public"."credit_sales" from "authenticated";

revoke select on table "public"."credit_sales" from "authenticated";

revoke trigger on table "public"."credit_sales" from "authenticated";

revoke truncate on table "public"."credit_sales" from "authenticated";

revoke update on table "public"."credit_sales" from "authenticated";

revoke delete on table "public"."customer_receipts" from "anon";

revoke insert on table "public"."customer_receipts" from "anon";

revoke references on table "public"."customer_receipts" from "anon";

revoke select on table "public"."customer_receipts" from "anon";

revoke trigger on table "public"."customer_receipts" from "anon";

revoke truncate on table "public"."customer_receipts" from "anon";

revoke update on table "public"."customer_receipts" from "anon";

revoke delete on table "public"."customer_receipts" from "authenticated";

revoke insert on table "public"."customer_receipts" from "authenticated";

revoke references on table "public"."customer_receipts" from "authenticated";

revoke select on table "public"."customer_receipts" from "authenticated";

revoke trigger on table "public"."customer_receipts" from "authenticated";

revoke truncate on table "public"."customer_receipts" from "authenticated";

revoke update on table "public"."customer_receipts" from "authenticated";

revoke delete on table "public"."customers" from "anon";

revoke insert on table "public"."customers" from "anon";

revoke references on table "public"."customers" from "anon";

revoke select on table "public"."customers" from "anon";

revoke trigger on table "public"."customers" from "anon";

revoke truncate on table "public"."customers" from "anon";

revoke update on table "public"."customers" from "anon";

revoke delete on table "public"."customers" from "authenticated";

revoke insert on table "public"."customers" from "authenticated";

revoke references on table "public"."customers" from "authenticated";

revoke select on table "public"."customers" from "authenticated";

revoke trigger on table "public"."customers" from "authenticated";

revoke truncate on table "public"."customers" from "authenticated";

revoke update on table "public"."customers" from "authenticated";

revoke delete on table "public"."expenses" from "anon";

revoke insert on table "public"."expenses" from "anon";

revoke references on table "public"."expenses" from "anon";

revoke select on table "public"."expenses" from "anon";

revoke trigger on table "public"."expenses" from "anon";

revoke truncate on table "public"."expenses" from "anon";

revoke update on table "public"."expenses" from "anon";

revoke delete on table "public"."expenses" from "authenticated";

revoke insert on table "public"."expenses" from "authenticated";

revoke references on table "public"."expenses" from "authenticated";

revoke select on table "public"."expenses" from "authenticated";

revoke trigger on table "public"."expenses" from "authenticated";

revoke truncate on table "public"."expenses" from "authenticated";

revoke update on table "public"."expenses" from "authenticated";

revoke delete on table "public"."loans" from "anon";

revoke insert on table "public"."loans" from "anon";

revoke references on table "public"."loans" from "anon";

revoke select on table "public"."loans" from "anon";

revoke trigger on table "public"."loans" from "anon";

revoke truncate on table "public"."loans" from "anon";

revoke update on table "public"."loans" from "anon";

revoke delete on table "public"."loans" from "authenticated";

revoke insert on table "public"."loans" from "authenticated";

revoke references on table "public"."loans" from "authenticated";

revoke select on table "public"."loans" from "authenticated";

revoke trigger on table "public"."loans" from "authenticated";

revoke truncate on table "public"."loans" from "authenticated";

revoke update on table "public"."loans" from "authenticated";

revoke delete on table "public"."notes" from "anon";

revoke insert on table "public"."notes" from "anon";

revoke references on table "public"."notes" from "anon";

revoke select on table "public"."notes" from "anon";

revoke trigger on table "public"."notes" from "anon";

revoke truncate on table "public"."notes" from "anon";

revoke update on table "public"."notes" from "anon";

revoke delete on table "public"."notes" from "authenticated";

revoke insert on table "public"."notes" from "authenticated";

revoke references on table "public"."notes" from "authenticated";

revoke select on table "public"."notes" from "authenticated";

revoke trigger on table "public"."notes" from "authenticated";

revoke truncate on table "public"."notes" from "authenticated";

revoke update on table "public"."notes" from "authenticated";

revoke delete on table "public"."notifications" from "anon";

revoke insert on table "public"."notifications" from "anon";

revoke references on table "public"."notifications" from "anon";

revoke select on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke update on table "public"."notifications" from "anon";

revoke delete on table "public"."notifications" from "authenticated";

revoke insert on table "public"."notifications" from "authenticated";

revoke references on table "public"."notifications" from "authenticated";

revoke select on table "public"."notifications" from "authenticated";

revoke trigger on table "public"."notifications" from "authenticated";

revoke truncate on table "public"."notifications" from "authenticated";

revoke update on table "public"."notifications" from "authenticated";

revoke delete on table "public"."push_subscriptions" from "anon";

revoke insert on table "public"."push_subscriptions" from "anon";

revoke references on table "public"."push_subscriptions" from "anon";

revoke select on table "public"."push_subscriptions" from "anon";

revoke trigger on table "public"."push_subscriptions" from "anon";

revoke truncate on table "public"."push_subscriptions" from "anon";

revoke update on table "public"."push_subscriptions" from "anon";

revoke delete on table "public"."push_subscriptions" from "authenticated";

revoke insert on table "public"."push_subscriptions" from "authenticated";

revoke references on table "public"."push_subscriptions" from "authenticated";

revoke select on table "public"."push_subscriptions" from "authenticated";

revoke trigger on table "public"."push_subscriptions" from "authenticated";

revoke truncate on table "public"."push_subscriptions" from "authenticated";

revoke update on table "public"."push_subscriptions" from "authenticated";

revoke delete on table "public"."reminders" from "anon";

revoke insert on table "public"."reminders" from "anon";

revoke references on table "public"."reminders" from "anon";

revoke select on table "public"."reminders" from "anon";

revoke trigger on table "public"."reminders" from "anon";

revoke truncate on table "public"."reminders" from "anon";

revoke update on table "public"."reminders" from "anon";

revoke delete on table "public"."reminders" from "authenticated";

revoke insert on table "public"."reminders" from "authenticated";

revoke references on table "public"."reminders" from "authenticated";

revoke select on table "public"."reminders" from "authenticated";

revoke trigger on table "public"."reminders" from "authenticated";

revoke truncate on table "public"."reminders" from "authenticated";

revoke update on table "public"."reminders" from "authenticated";

revoke delete on table "public"."sales" from "anon";

revoke insert on table "public"."sales" from "anon";

revoke references on table "public"."sales" from "anon";

revoke select on table "public"."sales" from "anon";

revoke trigger on table "public"."sales" from "anon";

revoke truncate on table "public"."sales" from "anon";

revoke update on table "public"."sales" from "anon";

revoke delete on table "public"."sales" from "authenticated";

revoke insert on table "public"."sales" from "authenticated";

revoke references on table "public"."sales" from "authenticated";

revoke select on table "public"."sales" from "authenticated";

revoke trigger on table "public"."sales" from "authenticated";

revoke truncate on table "public"."sales" from "authenticated";

revoke update on table "public"."sales" from "authenticated";

revoke delete on table "public"."stock" from "anon";

revoke insert on table "public"."stock" from "anon";

revoke references on table "public"."stock" from "anon";

revoke select on table "public"."stock" from "anon";

revoke trigger on table "public"."stock" from "anon";

revoke truncate on table "public"."stock" from "anon";

revoke update on table "public"."stock" from "anon";

revoke delete on table "public"."stock" from "authenticated";

revoke insert on table "public"."stock" from "authenticated";

revoke references on table "public"."stock" from "authenticated";

revoke select on table "public"."stock" from "authenticated";

revoke trigger on table "public"."stock" from "authenticated";

revoke truncate on table "public"."stock" from "authenticated";

revoke update on table "public"."stock" from "authenticated";

revoke delete on table "public"."stock_history" from "anon";

revoke insert on table "public"."stock_history" from "anon";

revoke references on table "public"."stock_history" from "anon";

revoke select on table "public"."stock_history" from "anon";

revoke trigger on table "public"."stock_history" from "anon";

revoke truncate on table "public"."stock_history" from "anon";

revoke update on table "public"."stock_history" from "anon";

revoke delete on table "public"."stock_history" from "authenticated";

revoke insert on table "public"."stock_history" from "authenticated";

revoke references on table "public"."stock_history" from "authenticated";

revoke select on table "public"."stock_history" from "authenticated";

revoke trigger on table "public"."stock_history" from "authenticated";

revoke truncate on table "public"."stock_history" from "authenticated";

revoke update on table "public"."stock_history" from "authenticated";

revoke delete on table "public"."tasks" from "anon";

revoke insert on table "public"."tasks" from "anon";

revoke references on table "public"."tasks" from "anon";

revoke select on table "public"."tasks" from "anon";

revoke trigger on table "public"."tasks" from "anon";

revoke truncate on table "public"."tasks" from "anon";

revoke update on table "public"."tasks" from "anon";

revoke delete on table "public"."tasks" from "authenticated";

revoke insert on table "public"."tasks" from "authenticated";

revoke references on table "public"."tasks" from "authenticated";

revoke select on table "public"."tasks" from "authenticated";

revoke trigger on table "public"."tasks" from "authenticated";

revoke truncate on table "public"."tasks" from "authenticated";

revoke update on table "public"."tasks" from "authenticated";

revoke delete on table "public"."transactions" from "anon";

revoke insert on table "public"."transactions" from "anon";

revoke references on table "public"."transactions" from "anon";

revoke select on table "public"."transactions" from "anon";

revoke trigger on table "public"."transactions" from "anon";

revoke truncate on table "public"."transactions" from "anon";

revoke update on table "public"."transactions" from "anon";

revoke delete on table "public"."transactions" from "authenticated";

revoke insert on table "public"."transactions" from "authenticated";

revoke references on table "public"."transactions" from "authenticated";

revoke select on table "public"."transactions" from "authenticated";

revoke trigger on table "public"."transactions" from "authenticated";

revoke truncate on table "public"."transactions" from "authenticated";

revoke update on table "public"."transactions" from "authenticated";

revoke delete on table "public"."user_backups" from "anon";

revoke insert on table "public"."user_backups" from "anon";

revoke references on table "public"."user_backups" from "anon";

revoke select on table "public"."user_backups" from "anon";

revoke trigger on table "public"."user_backups" from "anon";

revoke truncate on table "public"."user_backups" from "anon";

revoke update on table "public"."user_backups" from "anon";

revoke delete on table "public"."user_backups" from "authenticated";

revoke insert on table "public"."user_backups" from "authenticated";

revoke references on table "public"."user_backups" from "authenticated";

revoke select on table "public"."user_backups" from "authenticated";

revoke trigger on table "public"."user_backups" from "authenticated";

revoke truncate on table "public"."user_backups" from "authenticated";

revoke update on table "public"."user_backups" from "authenticated";

revoke delete on table "public"."user_feedback" from "anon";

revoke references on table "public"."user_feedback" from "anon";

revoke trigger on table "public"."user_feedback" from "anon";

revoke truncate on table "public"."user_feedback" from "anon";

revoke update on table "public"."user_feedback" from "anon";

revoke delete on table "public"."user_feedback" from "authenticated";

revoke references on table "public"."user_feedback" from "authenticated";

revoke trigger on table "public"."user_feedback" from "authenticated";

revoke truncate on table "public"."user_feedback" from "authenticated";

revoke update on table "public"."user_feedback" from "authenticated";

revoke delete on table "public"."user_setups" from "anon";

revoke references on table "public"."user_setups" from "anon";

revoke trigger on table "public"."user_setups" from "anon";

revoke truncate on table "public"."user_setups" from "anon";

revoke update on table "public"."user_setups" from "anon";

revoke delete on table "public"."user_setups" from "authenticated";

revoke references on table "public"."user_setups" from "authenticated";

revoke trigger on table "public"."user_setups" from "authenticated";

revoke truncate on table "public"."user_setups" from "authenticated";

revoke update on table "public"."user_setups" from "authenticated";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

revoke delete on table "public"."userupdate" from "anon";

revoke references on table "public"."userupdate" from "anon";

revoke trigger on table "public"."userupdate" from "anon";

revoke truncate on table "public"."userupdate" from "anon";

revoke update on table "public"."userupdate" from "anon";

revoke delete on table "public"."userupdate" from "authenticated";

revoke references on table "public"."userupdate" from "authenticated";

revoke trigger on table "public"."userupdate" from "authenticated";

revoke truncate on table "public"."userupdate" from "authenticated";

revoke update on table "public"."userupdate" from "authenticated";

revoke delete on table "public"."visits" from "anon";

revoke references on table "public"."visits" from "anon";

revoke trigger on table "public"."visits" from "anon";

revoke truncate on table "public"."visits" from "anon";

revoke update on table "public"."visits" from "anon";

revoke delete on table "public"."visits" from "authenticated";

revoke references on table "public"."visits" from "authenticated";

revoke trigger on table "public"."visits" from "authenticated";

revoke truncate on table "public"."visits" from "authenticated";

revoke update on table "public"."visits" from "authenticated";


  create policy "public_insert_app_events"
  on "public"."app_events"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "service_role_only_business_events"
  on "public"."business_events"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "service_role_only"
  on "public"."device_clear_challenges"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "service_role_only"
  on "public"."email_verifications"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "service_role_only"
  on "public"."password_reset_attempts"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "service_role_only"
  on "public"."password_reset_codes"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "service_role_only"
  on "public"."password_reset_tokens"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "service_role_only"
  on "public"."rate_limits"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "public_insert_user_feedback"
  on "public"."user_feedback"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "service_role_only_user_sessions"
  on "public"."user_sessions"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "public_insert_user_setups"
  on "public"."user_setups"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "public_insert_userupdate"
  on "public"."userupdate"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "service_role_only"
  on "public"."verified_emails"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



  create policy "public_insert_visits"
  on "public"."visits"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "logos_allow_delete_all"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'logos'::text));



