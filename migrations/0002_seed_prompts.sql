-- IAUTHR Prompt Library Seed Data
-- Categories: belief, first_cry, first_death, transformation, influence, anthem, dark, joy, pivot, fought_against, changed_belief, shock, politics, mentor

INSERT INTO prompts (id, category, text, followup_text, life_stage, emotional_weight, sort_order) VALUES
-- BELIEF & FAITH
('p001', 'belief', 'Did you grow up with a religion, or without one? What did you believe about God — or not — at age 10?', 'When did you first question that belief? Or when did you feel certain?', 'childhood', 'medium', 1),
('p002', 'belief', 'Tell me about a moment you prayed — or didn''t — and something unexpected happened.', 'Did that change your faith or doubt? How?', NULL, 'high', 2),
('p003', 'belief', 'Have you ever switched religions, or left one? What led to that?', 'What did you gain — or lose — by that change?', NULL, 'high', 3),
('p004', 'belief', 'What do you think happens after death? Has that idea changed over your life?', 'If it changed, what event or person caused the shift?', NULL, 'high', 4),

-- FIRST CRY
('p010', 'first_cry', 'When was the first time you cried not because you fell, but because your heart hurt? What happened?', 'How old were you? Who was there? Did anyone comfort you — or not?', 'childhood', 'high', 1),
('p011', 'first_cry', 'Was there a cry you held in because you felt you shouldn''t show weakness?', 'Looking back, what would you tell your younger self about crying?', NULL, 'high', 2),

-- FIRST DEATH
('p020', 'first_death', 'Who was the first person, pet, or creature you remember losing? How did you find out?', 'How did your body feel? Did you cry? Did you pretend not to care?', 'childhood', 'high', 1),
('p021', 'first_death', 'If you could speak to that being one more time, what would you say?', 'Would you want them to answer? What do you imagine they''d say?', NULL, 'high', 2),

-- TRANSFORMATION (death that changed you)
('p030', 'transformation', 'Some losses break us, then rebuild us. Tell me about a death that changed the direction of your life.', 'What did you do differently after that? Did you become kinder, harder, more daring?', NULL, 'critical', 1),
('p031', 'transformation', 'Did you ever feel relief after a death? If yes, explore that — no judgment.', 'Did you feel guilty for feeling relief? How did you deal with that guilt?', NULL, 'critical', 2),
('p032', 'transformation', 'Was there a death that made you finally chase a dream, or stop chasing one?', 'What did you learn about yourself in the months that followed?', NULL, 'high', 3),

-- INFLUENCE
('p040', 'influence', 'Not all influences are people. A book, a song, a car accident, a random act of kindness. What shifted something inside you?', 'What did you believe before that moment? What did you believe after?', NULL, 'medium', 1),
('p041', 'influence', 'Tell me about a teacher — good or bad — who changed how you see yourself.', 'If they could see you now, what would you want them to know?', NULL, 'medium', 2),
('p042', 'influence', 'Was there a failure that influenced you more than any success?', 'What did that failure make possible that wouldn''t have happened otherwise?', NULL, 'medium', 3),

-- ANTHEM / MUSIC
('p050', 'anthem', 'What song was playing during a moment that changed everything?', 'If you hear that song now, where does your mind go?', NULL, 'medium', 1),
('p051', 'anthem', 'Is there a song that makes you cry every time? Why?', 'Who were you when you first heard it?', NULL, 'medium', 2),
('p052', 'anthem', 'What was the soundtrack of your teenage years? What did that music mean to you then?', 'Does it mean the same thing now?', 'teen', 'medium', 3),

-- DARK / NO BARS HELD
('p060', 'dark', 'What''s the one thing you''ve never told anyone because you''re ashamed?', NULL, NULL, 'critical', 1),
('p061', 'dark', 'When did you feel genuine hate for someone you loved? What caused it?', NULL, NULL, 'critical', 2),
('p062', 'dark', 'What''s a lie you''ve told yourself for years that you''re now ready to stop believing?', NULL, NULL, 'high', 3),

-- JOY
('p070', 'joy', 'When were you most purely, unreservedly happy? Describe that moment in detail.', 'Who was there? What did the air feel like? What sound do you remember?', NULL, 'medium', 1),
('p071', 'joy', 'What is the funniest thing that ever happened to you?', 'Who did you tell first? Do you still laugh about it?', NULL, 'low', 2),

-- PIVOT
('p080', 'pivot', 'Tell me about a decision that split your life into before and after.', 'If you could go back, would you make the same choice?', NULL, 'high', 1),
('p081', 'pivot', 'Was there a moment you almost took a different path? What stopped you?', 'What do you think that other life would have looked like?', NULL, 'high', 2),

-- FOUGHT AGAINST
('p090', 'fought_against', 'What did you fight against that everyone else accepted?', 'Did you win? Did it matter?', NULL, 'high', 1),
('p091', 'fought_against', 'Was there an injustice you witnessed that changed how you see the world?', 'Did you act on it, or did you stay silent? What happened?', NULL, 'high', 2),

-- CHANGED BELIEF
('p100', 'changed_belief', 'What belief did you hold fiercely that you later abandoned? What broke it?', 'How did the people around you react when you changed?', NULL, 'high', 1),
('p101', 'changed_belief', 'Was there something you supported because it was expected, but secretly doubted?', 'When did you finally stop pretending?', NULL, 'medium', 2),

-- HISTORICAL EVENTS
('p110', 'politics', 'Where were you on September 11, 2001? How did that day change you?', 'Did it change what you believed about safety, government, or people?', NULL, 'high', 1),
('p111', 'politics', 'What political event in your lifetime affected you most personally?', 'Did it change how you vote, who you trust, or where you live?', NULL, 'medium', 2),
('p112', 'politics', 'Was there a law that changed that directly affected your life?', 'How did you feel when it happened? Did it feel like progress or loss?', NULL, 'medium', 3),

-- MENTOR
('p120', 'mentor', 'Who believed in you when you didn''t believe in yourself?', 'What did they see that you couldn''t?', NULL, 'medium', 1),
('p121', 'mentor', 'Was there a stranger who changed your life with a single act or sentence?', 'Do they know what they did for you?', NULL, 'medium', 2),

-- SPORTS
('p130', 'sports', 'Is there a sporting moment that made you cry, scream, or feel alive?', 'Who were you watching with? What did it mean beyond the game?', NULL, 'low', 1),

-- SHOCK
('p140', 'shock', 'What was the most shocking news you ever received?', 'How did your body react before your mind caught up?', NULL, 'high', 1),

-- DESPERATION
('p150', 'desperation', 'When were you most desperate? What did you do?', 'Looking back, what kept you going?', NULL, 'critical', 1);
