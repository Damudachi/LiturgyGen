-- Sample rows, so a fresh database is not an empty screen.
--
--   npm run db:seed      (node db/run.js db/seed.sql)
--
-- What is NOT here matters as much as what is. The office's Prayers of the
-- Faithful are transcribed from two published books (General Intercessions for
-- Weekday Masses, ST PAULS Philippines) and are copyrighted, so they are never
-- committed. They are loaded separately from server/data/orillo/, which is
-- git-ignored, by the application's own seeder.
--
-- Everything below is either a placeholder written for this tool or an
-- application default. Nothing here is taken from a book, and nothing here
-- names a real person.

-- Idempotent: running this twice must not duplicate rows or overwrite an edit
-- the office has made.

-- ---------------------------------------------------------------------------
-- Settings: the document defaults
-- ---------------------------------------------------------------------------
INSERT INTO settings (key, value) VALUES
  ('includeGospel',          'false'::jsonb),
  ('includeSequence',        'true'::jsonb),
  ('separatePages',          'true'::jsonb),
  ('highlightFirstRefrain',  'true'::jsonb),
  ('repeatPsalmRefrain',     'true'::jsonb),
  ('firstRefrainUppercase',  'true'::jsonb),
  ('appendIntentionSuffix',  'true'::jsonb),
  ('spaceBetweenIntentions', 'true'::jsonb),
  ('font',                   '"Book Antiqua"'::jsonb),
  ('schoolWideIntentions',   '[]'::jsonb),
  ('usePlaceholderPotf',     'false'::jsonb),
  ('providerOrder',          '["usccb","evangelizo"]'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Placeholder prayers
-- ---------------------------------------------------------------------------
-- Written for this tool. They are flagged is_placeholder, which keeps them out
-- of automatic matching: a day the books do not cover prints no prayers and
-- says so, unless the office turns placeholders on in Settings or picks one by
-- hand. The office should never print a prayer they did not choose.

INSERT INTO potf_templates
  (title, season, week, day_of_week, priest_invitation, response_options,
   intentions, priest_conclusion, origin, is_placeholder)
VALUES
  (
    'Placeholder - Ordinary Time',
    'Ordinary Time', NULL, NULL,
    'Let us bring our needs before the Lord, who hears every prayer.',
    '["Lord, hear our prayer."]'::jsonb,
    '[
       "For the Church, that she may be a sign of hope for all people, let us pray to the Lord.",
       "For those who govern, that they may serve the common good, let us pray to the Lord.",
       "For our school community, that our work and study may give glory to God, let us pray to the Lord.",
       "For the sick and the suffering, that they may know God''s comfort, let us pray to the Lord.",
       "For the faithful departed, that they may rest in peace, let us pray to the Lord."
     ]'::jsonb,
    'Father, hear the prayers of your people and grant what we ask in faith. Through Christ our Lord.',
    'placeholder', TRUE
  ),
  (
    'Placeholder - Advent',
    'Advent', NULL, NULL,
    'As we wait in joyful hope, let us place our needs before the Lord.',
    '["Come, Lord Jesus.", "Lord, hear our prayer."]'::jsonb,
    '[
       "For the Church, that she may prepare the way of the Lord, let us pray to the Lord.",
       "For all who wait in darkness, that they may see the light of Christ, let us pray to the Lord.",
       "For our community, that this season may find us watchful, let us pray to the Lord.",
       "For the faithful departed, that they may see the Lord''s face, let us pray to the Lord."
     ]'::jsonb,
    'God of hope, hear the prayers of your waiting people. Through Christ our Lord.',
    'placeholder', TRUE
  ),
  (
    'Placeholder - Lent',
    'Lent', NULL, NULL,
    'Turning back to the Lord with all our heart, let us pray.',
    '["Lord, hear our prayer.", "Have mercy on us, O Lord."]'::jsonb,
    '[
       "For the Church, that this season may renew her, let us pray to the Lord.",
       "For those preparing for baptism, that they may be strengthened, let us pray to the Lord.",
       "For the hungry and the homeless, that we may not pass them by, let us pray to the Lord.",
       "For ourselves, that our fasting may become mercy, let us pray to the Lord."
     ]'::jsonb,
    'Merciful Father, hear the prayers of your people this season. Through Christ our Lord.',
    'placeholder', TRUE
  ),
  (
    'Placeholder - Easter',
    'Easter', NULL, NULL,
    'Rejoicing in the risen Lord, let us bring him our needs.',
    '["Lord, hear our prayer.", "Risen Lord, hear us."]'::jsonb,
    '[
       "For the Church, that she may proclaim the resurrection with joy, let us pray to the Lord.",
       "For the newly baptised, that they may grow in faith, let us pray to the Lord.",
       "For our school community, that we may be witnesses of new life, let us pray to the Lord.",
       "For the faithful departed, that they may share in the resurrection, let us pray to the Lord."
     ]'::jsonb,
    'God of life, hear the prayers of your people. Through Christ our Lord.',
    'placeholder', TRUE
  ),
  (
    'Placeholder - Christmas',
    'Christmas', NULL, NULL,
    'The Word has been made flesh and dwells among us. Let us pray.',
    '["Lord, hear our prayer."]'::jsonb,
    '[
       "For the Church, that she may carry the good news of this season, let us pray to the Lord.",
       "For families, that the peace of Bethlehem may rest on their homes, let us pray to the Lord.",
       "For all who are alone at Christmas, that they may find welcome, let us pray to the Lord.",
       "For the faithful departed, that they may rejoice in the light of Christ, let us pray to the Lord."
     ]'::jsonb,
    'Father, you gave us your Son. Hear the prayers of your people. Through Christ our Lord.',
    'placeholder', TRUE
  )
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- A sample Mass schedule
-- ---------------------------------------------------------------------------
-- Invented dates, so the "our Mass schedule" shortcut has something to expand
-- on a fresh install.

INSERT INTO scheduled_masses (date, label) VALUES
  (DATE '2026-09-02', 'First Wednesday Mass'),
  (DATE '2026-09-04', 'First Friday Mass'),
  (DATE '2026-09-08', 'Nativity of the Blessed Virgin Mary')
ON CONFLICT (date) DO NOTHING;
