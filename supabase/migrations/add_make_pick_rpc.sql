-- RPC function to make a draft pick in a single atomic transaction
-- This replaces multiple sequential queries with one database call

CREATE OR REPLACE FUNCTION make_draft_pick(
  p_session_id UUID,
  p_player_id UUID,
  p_card_id INTEGER,
  p_pick_time_seconds INTEGER DEFAULT 0,
  p_was_auto_pick BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_player RECORD;
  v_new_hand INTEGER[];
  v_all_picked BOOLEAN;
  v_player_count INTEGER;
  v_picked_count INTEGER;
BEGIN
  -- Lock the session row to prevent race conditions
  SELECT * INTO v_session
  FROM draft_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Session not found');
  END IF;

  IF v_session.status != 'in_progress' THEN
    RETURN json_build_object('success', false, 'error', 'Session not in progress');
  END IF;

  -- Lock the player row
  SELECT * INTO v_player
  FROM draft_players
  WHERE id = p_player_id AND session_id = p_session_id
  FOR UPDATE;

  IF v_player IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Player not found');
  END IF;

  IF v_player.pick_made THEN
    RETURN json_build_object('success', false, 'error', 'Pick already made this round');
  END IF;

  -- Verify card is in hand
  IF NOT (p_card_id = ANY(v_player.current_hand)) THEN
    RETURN json_build_object('success', false, 'error', 'Card not in hand');
  END IF;

  -- Insert pick record (will fail on unique constraint if already exists)
  BEGIN
    INSERT INTO draft_picks (
      session_id,
      player_id,
      card_id,
      pack_number,
      pick_number,
      pick_time_seconds,
      was_auto_pick
    ) VALUES (
      p_session_id,
      p_player_id,
      p_card_id,
      v_session.current_pack,
      v_session.current_pick,
      p_pick_time_seconds,
      p_was_auto_pick
    );
  EXCEPTION WHEN unique_violation THEN
    -- If it's a duplicate pick record for this player/round, that's fine
    -- If it's a duplicate card_id, return error
    IF SQLERRM LIKE '%card_id%' THEN
      RETURN json_build_object('success', false, 'error', 'Card already picked');
    END IF;
    -- Otherwise continue - pick was already recorded
  END;

  -- Remove card from hand and mark pick as made
  v_new_hand := array_remove(v_player.current_hand, p_card_id);

  UPDATE draft_players
  SET current_hand = v_new_hand, pick_made = true
  WHERE id = p_player_id;

  -- Check if all players have picked
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE pick_made = true)
  INTO v_player_count, v_picked_count
  FROM draft_players
  WHERE session_id = p_session_id;

  v_all_picked := (v_player_count = v_picked_count);

  RETURN json_build_object(
    'success', true,
    'all_picked', v_all_picked,
    'pack_number', v_session.current_pack,
    'pick_number', v_session.current_pick,
    'remaining_hand', v_new_hand
  );
END;
$$;

-- Grant execute permission to authenticated users and anon (for guests)
GRANT EXECUTE ON FUNCTION make_draft_pick TO authenticated;
GRANT EXECUTE ON FUNCTION make_draft_pick TO anon;

-- RPC function to pass packs after all players have picked
-- Separate function so we can call it independently or check bots first
CREATE OR REPLACE FUNCTION pass_draft_packs(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_settings JSONB;
  v_pack_size INTEGER;
  v_burned_per_pack INTEGER;
  v_direction TEXT;
  v_player_count INTEGER;
  v_current_pick INTEGER;
  v_current_pack INTEGER;
  v_cards_per_player INTEGER;
  v_total_picks INTEGER;
  v_hands_to_pass JSON;
BEGIN
  -- Lock session
  SELECT * INTO v_session
  FROM draft_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Session not found');
  END IF;

  v_settings := v_session.settings;
  v_pack_size := (v_settings->>'packSize')::INTEGER;
  v_burned_per_pack := COALESCE((v_settings->>'burnedPerPack')::INTEGER, 0);
  v_cards_per_player := (v_settings->>'cardsPerPlayer')::INTEGER;
  v_direction := v_session.direction;
  v_current_pick := v_session.current_pick;
  v_current_pack := v_session.current_pack;

  -- Get player count
  SELECT COUNT(*) INTO v_player_count
  FROM draft_players
  WHERE session_id = p_session_id;

  -- Calculate picks per pack (accounting for burned cards)
  -- picks_per_pack = pack_size - burned_per_pack
  -- But we need to handle when hand is empty

  v_total_picks := v_cards_per_player;

  -- Check if we need to move to next pack or complete the draft
  -- Pack is done when current_pick reaches picks_per_pack
  IF v_current_pick >= (v_pack_size - v_burned_per_pack) THEN
    -- Check if draft is complete
    IF v_current_pack * (v_pack_size - v_burned_per_pack) >= v_total_picks THEN
      -- Draft complete!
      UPDATE draft_sessions
      SET status = 'completed'
      WHERE id = p_session_id;

      RETURN json_build_object('success', true, 'status', 'completed');
    END IF;

    -- Move to next pack
    UPDATE draft_sessions
    SET
      current_pack = current_pack + 1,
      current_pick = 1,
      direction = CASE WHEN direction = 'left' THEN 'right' ELSE 'left' END
    WHERE id = p_session_id;

    -- Clear hands and reset pick_made for new pack
    -- (hands will be dealt by the client or another function)
    UPDATE draft_players
    SET pick_made = false
    WHERE session_id = p_session_id;

    RETURN json_build_object(
      'success', true,
      'status', 'next_pack',
      'new_pack', v_current_pack + 1
    );
  END IF;

  -- Pass hands to next player based on direction
  -- Collect all hands first
  WITH player_hands AS (
    SELECT
      id,
      seat_position,
      current_hand,
      CASE
        WHEN v_direction = 'left' THEN
          COALESCE(
            LAG(current_hand) OVER (ORDER BY seat_position),
            (SELECT current_hand FROM draft_players WHERE session_id = p_session_id ORDER BY seat_position DESC LIMIT 1)
          )
        ELSE
          COALESCE(
            LEAD(current_hand) OVER (ORDER BY seat_position),
            (SELECT current_hand FROM draft_players WHERE session_id = p_session_id ORDER BY seat_position ASC LIMIT 1)
          )
      END as new_hand
    FROM draft_players
    WHERE session_id = p_session_id
    ORDER BY seat_position
  )
  UPDATE draft_players dp
  SET
    current_hand = ph.new_hand,
    pick_made = false
  FROM player_hands ph
  WHERE dp.id = ph.id;

  -- Increment pick number
  UPDATE draft_sessions
  SET current_pick = current_pick + 1
  WHERE id = p_session_id;

  RETURN json_build_object(
    'success', true,
    'status', 'passed',
    'new_pick', v_current_pick + 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pass_draft_packs TO authenticated;
GRANT EXECUTE ON FUNCTION pass_draft_packs TO anon;
