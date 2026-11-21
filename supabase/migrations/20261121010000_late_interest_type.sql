-- Step 33 (H10): late interest is its own movement type, apart from regular interest, because R9 applies it first.
-- Separate migration: a new enum value cannot be used in the transaction that adds it.
alter type public.transaction_type add value if not exists 'late_interest' after 'interest';
