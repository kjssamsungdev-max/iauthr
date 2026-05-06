-- IAUTHR D1 Schema v1.0
-- Entity-graph memoir engine with truth versioning

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  default_truth_mode TEXT DEFAULT 'clean' CHECK(default_truth_mode IN ('brutal','clean','fiction')),
  settings TEXT DEFAULT '{}', -- JSON: nudge_frequency, triggers, preferences
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Memos (sparks)
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TEXT DEFAULT (datetime('now')),
  transcript TEXT,
  audio_key TEXT, -- R2 object key
  location_lat REAL,
  location_lng REAL,
  location_name TEXT,
  truth_mode TEXT DEFAULT 'clean' CHECK(truth_mode IN ('brutal','clean','fiction')),
  is_private INTEGER DEFAULT 0, -- 1 = brutal/encrypted, never synced
  emotion_primary TEXT, -- joy, sadness, anger, fear, etc.
  emotion_emoji TEXT,
  emotion_score REAL DEFAULT 0.5, -- 0-1 intensity
  parent_memo_id TEXT REFERENCES memos(id), -- for truth versions
  version_type TEXT DEFAULT 'original' CHECK(version_type IN ('original','clean','fiction','edit')),
  chapter_id TEXT REFERENCES chapters(id),
  ai_summary TEXT, -- Claude-generated 1-line summary
  ai_themes TEXT DEFAULT '[]', -- JSON array of detected themes
  ai_suggested_followup TEXT, -- Claude-suggested next prompt
  word_count INTEGER DEFAULT 0,
  duration_seconds INTEGER, -- for voice memos
  source TEXT DEFAULT 'text' CHECK(source IN ('text','voice','prompt','trigger')),
  prompt_id TEXT, -- which prompt triggered this
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_memos_user ON memos(user_id);
CREATE INDEX idx_memos_recorded ON memos(recorded_at);
CREATE INDEX idx_memos_truth ON memos(truth_mode);
CREATE INDEX idx_memos_chapter ON memos(chapter_id);
CREATE INDEX idx_memos_emotion ON memos(emotion_primary);

-- Entities (people, pets, places, fears, beliefs, etc.)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- person, pet, place, job, hobby, relationship, belief, fear, loss, influence, anthem, event, object, milestone, custom
  subtype TEXT, -- user-defined refinement (e.g., "stuffed animal", "phobia")
  life_born TEXT, -- date or year entity "started"
  life_died TEXT, -- date or year entity "ended"
  emotional_weight REAL DEFAULT 0.5, -- 0-1
  significance TEXT DEFAULT 'medium' CHECK(significance IN ('low','medium','high','critical')),
  life_scale_events TEXT DEFAULT '[]', -- JSON array of {event, date, note}
  metadata TEXT DEFAULT '{}', -- JSON: breed, job_title, religion_name, etc.
  photo_key TEXT, -- R2 key for entity photo
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_entities_user ON entities(user_id);
CREATE INDEX idx_entities_type ON entities(type);

-- Memo-Entity junction (many-to-many)
CREATE TABLE IF NOT EXISTS memo_entities (
  memo_id TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  confidence REAL DEFAULT 1.0, -- 1.0 = manual tag, <1.0 = AI-suggested
  confirmed INTEGER DEFAULT 1, -- 0 = AI suggestion pending user confirm
  PRIMARY KEY (memo_id, entity_id)
);

CREATE INDEX idx_me_memo ON memo_entities(memo_id);
CREATE INDEX idx_me_entity ON memo_entities(entity_id);

-- Entity relationships (self-referencing graph)
CREATE TABLE IF NOT EXISTS entity_relationships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id_1 TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entity_id_2 TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- owned_by, lived_in, friend_of, worked_at, married_to, feared_at, etc.
  strength REAL DEFAULT 0.5,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_er_user ON entity_relationships(user_id);
CREATE INDEX idx_er_e1 ON entity_relationships(entity_id_1);
CREATE INDEX idx_er_e2 ON entity_relationships(entity_id_2);

-- Chapters (assembled from memos)
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  chapter_order INTEGER DEFAULT 0,
  truth_mode TEXT DEFAULT 'clean',
  cliffhanger TEXT, -- AI-suggested chapter ending
  echo_theme TEXT, -- thematic thread (e.g., "betrayal", "faith")
  entity_focus_id TEXT REFERENCES entities(id), -- if chapter is about one entity
  narrative_arc TEXT, -- rebel, pivot, belief_shift, etc.
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','review','final','published')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_chapters_user ON chapters(user_id);

-- Prompts library
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL, -- belief, first_cry, first_death, transformation, influence, anthem, dark, joy, pivot, etc.
  text TEXT NOT NULL,
  followup_text TEXT, -- deeper prompt after answer
  life_stage TEXT, -- childhood, teen, young_adult, midlife, elder
  emotional_weight TEXT DEFAULT 'medium',
  is_system INTEGER DEFAULT 1, -- 1 = built-in, 0 = user-created
  sort_order INTEGER DEFAULT 0
);

-- Agent logs (track all Claude API calls)
CREATE TABLE IF NOT EXISTS agent_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL, -- entity_extractor, emotion_detector, narrative_steerer, chapter_assembler, cliffhanger_generator, echo_tracker
  input_memo_id TEXT REFERENCES memos(id),
  input_text TEXT,
  output_text TEXT,
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_al_user ON agent_logs(user_id);
CREATE INDEX idx_al_type ON agent_logs(agent_type);

-- Books (assembled manuscripts)
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  truth_mode TEXT DEFAULT 'clean',
  dedication TEXT, -- "For Mom" or "For the dog who saw me through"
  cover_template TEXT,
  cover_photo_key TEXT,
  isbn TEXT,
  amazon_asin TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','formatting','review','published')),
  word_count INTEGER DEFAULT 0,
  epub_key TEXT, -- R2 key for generated EPUB
  pdf_key TEXT, -- R2 key for generated PDF
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_books_user ON books(user_id);

-- Triggers (user-configured real-world triggers)
CREATE TABLE IF NOT EXISTS triggers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('location','photo','news','contact','date','entity_mention')),
  config TEXT NOT NULL, -- JSON: {lat, lng, radius} or {date: "11-11"} or {keyword: "Vietnam"}
  prompt_text TEXT, -- what to ask when triggered
  entity_id TEXT REFERENCES entities(id), -- optional linked entity
  is_active INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_triggers_user ON triggers(user_id);
