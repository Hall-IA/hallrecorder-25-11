/*
  # Add Pending Downgrade Support

  1. Changes
    - Add `pending_downgrade_plan` column to `user_subscriptions` table
    - This column tracks scheduled downgrades that take effect at next billing cycle
    - NULL means no pending change, 'starter' or 'unlimited' means scheduled change
  
  2. Purpose
    - Support upgrade/downgrade business rules:
      - Upgrades: immediate with proration
      - Downgrades: scheduled for next billing cycle
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'pending_downgrade_plan'
  ) THEN
    ALTER TABLE user_subscriptions 
    ADD COLUMN pending_downgrade_plan text CHECK (pending_downgrade_plan IN ('starter', 'unlimited'));
  END IF;
END $$;