-- Update contact email in welcome email body from support@ to info@
-- The support@ mailbox is being closed; info@ is the single contact address.
UPDATE intro_messages
SET
  body_markdown = REPLACE(
    body_markdown,
    'support@branhamsermons.ai',
    'info@branhamsermons.ai'
  ),
  updated_at = now()
WHERE body_markdown LIKE '%support@branhamsermons.ai%';
