import { useState, useRef, useEffect, useCallback } from "react";

const TRUTH_MODES = {
  brutal: { label: "Brutal", icon: "🔒", color: "#c45a3c", desc: "Raw. Private. Encrypted." },
  clean: { label: "Clean", icon: "🌿", color: "#4a6741", desc: "Family-friendly legacy." },
  fiction: { label: "Fiction", icon: "✨", color: "#d4963a", desc: "Based on a true story." },
};

const ENTITY_TYPES = [
  { type: "person", icon: "👤", label: "Person" },
  { type: "pet", icon: "🐾", label: "Pet / Companion" },
  { type: "place", icon: "📍", label: "Place" },
  { type: "job", icon: "💼", label: "Job / Career" },
  { type: "hobby", icon: "🎸", label: "Hobby / Passion" },
  { type: "relationship", icon: "❤️", label: "Relationship" },
  { type: "belief", icon: "🙏", label: "Belief / Faith" },
  { type: "fear", icon: "😨", label: "Fear / Phobia" },
  { type: "loss", icon: "🕊️", label: "Loss / Death" },
  { type: "influence", icon: "⚡", label: "Influence" },
  { type: "anthem", icon: "🎵", label: "Song / Anthem" },
  { type: "event", icon: "📰", label: "Historical Event" },
  { type: "object", icon: "🧸", label: "Object / Thing" },
  { type: "milestone", icon: "⭐", label: "Milestone / First" },
];

const PROMPTS = [
  { cat: "Belief", text: "Did you grow up with a religion, or without one? What did you believe at age 10?" },
  { cat: "First cry", text: "When was the first time you cried not because you fell, but because your heart hurt?" },
  { cat: "First death", text: "Who was the first person, pet, or creature you remember losing?" },
  { cat: "Anthem", text: "What song was playing during a moment that changed everything?" },
  { cat: "Pivot", text: "Tell me about a decision that split your life into before and after." },
  { cat: "Influence", text: "Not all influences are people. A book, a song, a car accident. What shifted something inside you?" },
  { cat: "Dark side", text: "What's the one thing you've never told anyone because you're ashamed?" },
  { cat: "Joy", text: "When were you most purely, unreservedly happy? Describe that moment." },
  { cat: "Fought against", text: "What did you fight against that everyone else accepted?" },
  { cat: "Changed belief", text: "What belief did you hold fiercely that you later abandoned? What broke it?" },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getEmotionFromText(text) {
  const lower = text.toLowerCase();
  if (/joy|happy|laugh|love|beautiful|wonderful|amazing|celebrate/.test(lower)) return { emoji: "😊", label: "joy" };
  if (/sad|cry|tears|miss|lost|gone|died|death|funeral/.test(lower)) return { emoji: "😢", label: "sadness" };
  if (/angry|hate|furious|rage|fight|scream/.test(lower)) return { emoji: "😤", label: "anger" };
  if (/afraid|fear|scared|terror|nightmare|dark/.test(lower)) return { emoji: "😨", label: "fear" };
  if (/shock|surprise|sudden|unexpected|never expected/.test(lower)) return { emoji: "😲", label: "shock" };
  if (/proud|achieve|accomplish|won|victory/.test(lower)) return { emoji: "💪", label: "pride" };
  if (/regret|should have|wish I|mistake|guilt/.test(lower)) return { emoji: "😔", label: "regret" };
  if (/grateful|thank|blessed|fortune|lucky/.test(lower)) return { emoji: "🙏", label: "gratitude" };
  return { emoji: "💭", label: "reflection" };
}

export default function IauthrApp() {
  const [view, setView] = useState("home");
  const [sparks, setSparks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("iauthr_sparks") || "[]"); } catch { return []; }
  });
  const [entities, setEntities] = useState(() => {
    try { return JSON.parse(localStorage.getItem("iauthr_entities") || "[]"); } catch { return []; }
  });
  const [globalTruth, setGlobalTruth] = useState(() => localStorage.getItem("iauthr_truth") || "clean");
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [showTagging, setShowTagging] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [showTextMode, setShowTextMode] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [filterEntity, setFilterEntity] = useState(null);
  const [showPrompt, setShowPrompt] = useState(null);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityType, setNewEntityType] = useState("person");
  const [showNewEntity, setShowNewEntity] = useState(false);
  const timerRef = useRef(null);
  const mediaRef = useRef(null);

  useEffect(() => { localStorage.setItem("iauthr_sparks", JSON.stringify(sparks)); }, [sparks]);
  useEffect(() => { localStorage.setItem("iauthr_entities", JSON.stringify(entities)); }, [entities]);
  useEffect(() => { localStorage.setItem("iauthr_truth", globalTruth); }, [globalTruth]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = new MediaRecorder(stream);
      mediaRef.current.start();
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (e) {
      setShowTextMode(true);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRef.current && isRecording) {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);
      setIsRecording(false);
      const newSpark = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        text: `[Voice memo — ${formatTime(recordTime)}]`,
        type: "voice",
        truthMode: globalTruth,
        entityIds: [],
        emotion: { emoji: "🎙️", label: "voice" },
      };
      setSparks(prev => [newSpark, ...prev]);
      setShowTagging(newSpark.id);
    }
  }, [isRecording, recordTime, globalTruth]);

  const addTextSpark = useCallback(() => {
    if (!textInput.trim()) return;
    const emotion = getEmotionFromText(textInput);
    const newSpark = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      text: textInput.trim(),
      type: "text",
      truthMode: globalTruth,
      entityIds: [],
      emotion,
    };
    setSparks(prev => [newSpark, ...prev]);
    setTextInput("");
    setShowTextMode(false);
    setShowTagging(newSpark.id);
  }, [textInput, globalTruth]);

  const addPromptSpark = useCallback((prompt) => {
    setShowPrompt(null);
    setShowTextMode(true);
    setTextInput(`[${prompt.cat}] `);
  }, []);

  const toggleEntityOnSpark = useCallback((sparkId, entityId) => {
    setSparks(prev => prev.map(s => {
      if (s.id !== sparkId) return s;
      const has = s.entityIds.includes(entityId);
      return { ...s, entityIds: has ? s.entityIds.filter(e => e !== entityId) : [...s.entityIds, entityId] };
    }));
  }, []);

  const addEntity = useCallback(() => {
    if (!newEntityName.trim()) return;
    const ent = {
      id: Date.now().toString(),
      name: newEntityName.trim(),
      type: newEntityType,
      createdAt: Date.now(),
    };
    setEntities(prev => [...prev, ent]);
    setNewEntityName("");
    setShowNewEntity(false);
  }, [newEntityName, newEntityType]);

  const deleteEntity = useCallback((id) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    setSparks(prev => prev.map(s => ({ ...s, entityIds: s.entityIds.filter(eid => eid !== id) })));
    if (selectedEntity === id) setSelectedEntity(null);
  }, [selectedEntity]);

  const deleteSpark = useCallback((id) => {
    setSparks(prev => prev.filter(s => s.id !== id));
    if (showTagging === id) setShowTagging(null);
  }, [showTagging]);

  const getEntityById = (id) => entities.find(e => e.id === id);
  const getEntityIcon = (type) => ENTITY_TYPES.find(t => t.type === type)?.icon || "📌";
  const sparkCount = (entityId) => sparks.filter(s => s.entityIds.includes(entityId)).length;

  const filteredSparks = filterEntity
    ? sparks.filter(s => s.entityIds.includes(filterEntity))
    : sparks;

  const groupedByMonth = {};
  filteredSparks.forEach(s => {
    const key = new Date(s.timestamp).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!groupedByMonth[key]) groupedByMonth[key] = [];
    groupedByMonth[key].push(s);
  });

  // Styles
  const css = {
    app: { fontFamily: "'DM Sans', -apple-system, sans-serif", background: "#0a0a0a", color: "#f4f0e8", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", overflow: "hidden" },
    nav: { display: "flex", justifyContent: "space-around", padding: "12px 0", borderTop: "1px solid rgba(244,240,232,0.06)", position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)", zIndex: 50 },
    navBtn: (active) => ({ background: "none", border: "none", color: active ? "#c45a3c" : "#6b7280", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 12px", letterSpacing: "0.05em" }),
    navIcon: { fontSize: 20 },
    page: { paddingBottom: 80, paddingTop: 16 },
    header: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 400, padding: "16px 20px 8px", letterSpacing: "-0.02em" },
    subheader: { fontSize: 13, color: "#6b7280", padding: "0 20px 20px", fontWeight: 300, lineHeight: 1.6 },
    card: { margin: "0 16px 8px", padding: "16px 18px", background: "rgba(244,240,232,0.03)", border: "1px solid rgba(244,240,232,0.06)", transition: "background 0.2s" },
    label: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c45a3c", marginBottom: 12 },
    btn: { background: "#c45a3c", color: "#f4f0e8", border: "none", padding: "10px 20px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.03em", width: "100%" },
    btnGhost: { background: "none", color: "#f4f0e8", border: "1px solid rgba(244,240,232,0.15)", padding: "8px 16px", fontFamily: "'DM Sans', sans-serif", fontSize: 12, cursor: "pointer" },
    input: { width: "100%", padding: "10px 14px", background: "rgba(244,240,232,0.05)", border: "1px solid rgba(244,240,232,0.1)", color: "#f4f0e8", fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" },
    truthPill: (mode, active) => ({ padding: "8px 14px", background: active ? TRUTH_MODES[mode].color + "22" : "rgba(244,240,232,0.03)", border: `1px solid ${active ? TRUTH_MODES[mode].color : "rgba(244,240,232,0.08)"}`, color: active ? TRUTH_MODES[mode].color : "#6b7280", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif" }),
    chip: (active) => ({ padding: "6px 12px", background: active ? "rgba(196,90,60,0.15)" : "rgba(244,240,232,0.04)", border: `1px solid ${active ? "#c45a3c" : "rgba(244,240,232,0.08)"}`, color: active ? "#f4f0e8" : "#6b7280", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }),
  };

  // HOME VIEW
  const HomeView = () => (
    <div style={css.page}>
      {/* Truth mode bar */}
      <div style={{ padding: "8px 20px", display: "flex", gap: 6 }}>
        {Object.keys(TRUTH_MODES).map(m => (
          <button key={m} style={css.truthPill(m, globalTruth === m)} onClick={() => setGlobalTruth(m)}>
            {TRUTH_MODES[m].icon} {TRUTH_MODES[m].label}
          </button>
        ))}
      </div>

      {/* BIG RED BUTTON */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px 40px" }}>
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          style={{
            width: 160, height: 160, borderRadius: "50%",
            background: isRecording
              ? "radial-gradient(circle, #e05a40 0%, #8b2d1a 100%)"
              : "radial-gradient(circle, #c45a3c 0%, #7a3525 100%)",
            border: isRecording ? "3px solid #ff8a70" : "3px solid rgba(244,240,232,0.1)",
            cursor: "pointer",
            boxShadow: isRecording
              ? "0 0 60px rgba(196,90,60,0.6), 0 0 120px rgba(196,90,60,0.3)"
              : "0 0 40px rgba(196,90,60,0.2)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s",
            animation: isRecording ? "pulse 1.5s infinite" : "none",
          }}
        >
          <span style={{ fontSize: 36 }}>{isRecording ? "⏹" : "🎙️"}</span>
          <span style={{ fontSize: 12, color: "#f4f0e8", marginTop: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, opacity: 0.9 }}>
            {isRecording ? formatTime(recordTime) : "Hold to record"}
          </span>
        </button>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 20, textAlign: "center", fontWeight: 300, lineHeight: 1.6 }}>
          Tap and hold to capture a memory.<br/>Or switch to text below.
        </p>
      </div>

      {/* Text mode toggle */}
      <div style={{ padding: "0 20px" }}>
        {showTextMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="What's on your mind? A memory, a name, a feeling..."
              style={{ ...css.input, minHeight: 100, resize: "vertical", lineHeight: 1.6 }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={css.btn} onClick={addTextSpark}>Save spark</button>
              <button style={css.btnGhost} onClick={() => { setShowTextMode(false); setTextInput(""); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button style={{ ...css.btnGhost, width: "100%", padding: "12px" }} onClick={() => setShowTextMode(true)}>
            ✏️ Write instead
          </button>
        )}
      </div>

      {/* Gentle prompt */}
      <div style={{ padding: "24px 20px 0" }}>
        <div style={css.label}>Need a spark?</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
          {PROMPTS.slice(0, 5).map((p, i) => (
            <button key={i} style={{ ...css.chip(false), flexShrink: 0, padding: "8px 14px" }} onClick={() => addPromptSpark(p)}>
              {p.cat}
            </button>
          ))}
          <button style={{ ...css.chip(false), flexShrink: 0 }} onClick={() => setShowPrompt(true)}>More →</button>
        </div>
      </div>

      {/* Recent sparks */}
      {sparks.length > 0 && (
        <div style={{ padding: "24px 0 0" }}>
          <div style={{ ...css.label, padding: "0 20px" }}>Recent sparks ({sparks.length})</div>
          {sparks.slice(0, 3).map(s => (
            <SparkCard key={s.id} spark={s} />
          ))}
          {sparks.length > 3 && (
            <button style={{ ...css.btnGhost, margin: "8px 16px", fontSize: 12 }} onClick={() => setView("sparks")}>
              View all {sparks.length} sparks →
            </button>
          )}
        </div>
      )}

      {/* Prompt modal */}
      {showPrompt && (
        <Modal onClose={() => setShowPrompt(null)} title="Inspirational Prompts">
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
            No bars held. Tap any prompt to start writing.
          </p>
          {PROMPTS.map((p, i) => (
            <button key={i} onClick={() => addPromptSpark(p)} style={{ ...css.card, margin: "0 0 6px", display: "block", width: "100%", cursor: "pointer", textAlign: "left", borderLeft: "2px solid rgba(196,90,60,0.4)" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c45a3c", marginBottom: 4 }}>{p.cat}</div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#e8e2d6", lineHeight: 1.5 }}>{p.text}</div>
            </button>
          ))}
        </Modal>
      )}

      {/* Tagging modal */}
      {showTagging && <TaggingModal sparkId={showTagging} onClose={() => setShowTagging(null)} />}

      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
    </div>
  );

  // SPARK CARD
  const SparkCard = ({ spark, showActions = false }) => {
    const mode = TRUTH_MODES[spark.truthMode];
    const linkedEntities = spark.entityIds.map(getEntityById).filter(Boolean);
    return (
      <div style={{ ...css.card, borderLeft: `2px solid ${mode.color}44` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 300 }}>{formatDate(spark.timestamp)}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>{spark.emotion.emoji}</span>
            <span style={{ fontSize: 10, color: mode.color }}>{mode.icon}</span>
          </div>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#e8e2d6", fontWeight: 300, marginBottom: linkedEntities.length > 0 ? 10 : 0 }}>
          {spark.text}
        </p>
        {linkedEntities.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {linkedEntities.map(e => (
              <span key={e.id} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(196,90,60,0.1)", color: "#c45a3c", display: "inline-flex", alignItems: "center", gap: 3 }}>
                {getEntityIcon(e.type)} {e.name}
              </span>
            ))}
          </div>
        )}
        {showActions && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={{ ...css.chip(false), fontSize: 10 }} onClick={() => setShowTagging(spark.id)}>Tag entities</button>
            <button style={{ ...css.chip(false), fontSize: 10, color: "#c45a3c" }} onClick={() => deleteSpark(spark.id)}>Delete</button>
          </div>
        )}
      </div>
    );
  };

  // TAGGING MODAL
  const TaggingModal = ({ sparkId, onClose }) => {
    const spark = sparks.find(s => s.id === sparkId);
    if (!spark) return null;
    return (
      <Modal onClose={onClose} title="Tag Entities">
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
          Link this spark to people, pets, places, fears, beliefs — anything meaningful.
        </p>
        <div style={{ background: "rgba(244,240,232,0.03)", padding: 12, marginBottom: 16, borderLeft: "2px solid #c45a3c44" }}>
          <p style={{ fontSize: 13, color: "#e8e2d6", fontWeight: 300, lineHeight: 1.5 }}>{spark.text}</p>
        </div>
        {entities.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {entities.map(e => (
              <button key={e.id} style={css.chip(spark.entityIds.includes(e.id))} onClick={() => toggleEntityOnSpark(sparkId, e.id)}>
                {getEntityIcon(e.type)} {e.name}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>No entities yet. Create one below.</p>
        )}
        <button style={{ ...css.btnGhost, width: "100%", marginBottom: 8 }} onClick={() => { setShowNewEntity(true); }}>
          + Create new entity
        </button>
        <button style={{ ...css.btn, marginTop: 4 }} onClick={onClose}>Done</button>
      </Modal>
    );
  };

  // SPARKS VIEW
  const SparksView = () => (
    <div style={css.page}>
      <h1 style={css.header}>Spark Queue</h1>
      <p style={css.subheader}>
        {sparks.length} spark{sparks.length !== 1 ? "s" : ""} captured. Raw, unorganised, unjudged.
      </p>
      {sparks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>⚡</p>
          <p style={{ fontSize: 14, fontWeight: 300 }}>No sparks yet. Go home and record one.</p>
        </div>
      ) : (
        sparks.map(s => <SparkCard key={s.id} spark={s} showActions />)
      )}
    </div>
  );

  // TIMELINE VIEW
  const TimelineView = () => (
    <div style={css.page}>
      <h1 style={css.header}>Timeline</h1>
      <p style={css.subheader}>Your life as dots. Each one a memory.</p>
      {/* Entity filter */}
      {entities.length > 0 && (
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          <button style={css.chip(!filterEntity)} onClick={() => setFilterEntity(null)}>All</button>
          {entities.map(e => (
            <button key={e.id} style={css.chip(filterEntity === e.id)} onClick={() => setFilterEntity(filterEntity === e.id ? null : e.id)}>
              {getEntityIcon(e.type)} {e.name}
            </button>
          ))}
        </div>
      )}
      {Object.keys(groupedByMonth).length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
          <p style={{ fontSize: 14, fontWeight: 300 }}>No memories yet in your timeline.</p>
        </div>
      ) : (
        Object.entries(groupedByMonth).map(([month, items]) => (
          <div key={month}>
            <div style={{ padding: "16px 20px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "#6b7280" }}>{month}</div>
            {/* Dot row */}
            <div style={{ padding: "0 20px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {items.map(s => (
                <div key={s.id} title={s.text.slice(0, 50)} style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: TRUTH_MODES[s.truthMode].color,
                  opacity: 0.7,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => setShowTagging(s.id)}
                />
              ))}
            </div>
            {items.map(s => <SparkCard key={s.id} spark={s} showActions />)}
          </div>
        ))
      )}
      {showTagging && <TaggingModal sparkId={showTagging} onClose={() => setShowTagging(null)} />}
    </div>
  );

  // ENTITIES VIEW
  const EntitiesView = () => (
    <div style={css.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 8px" }}>
        <h1 style={{ ...css.header, padding: 0 }}>Entities</h1>
        <button style={css.btnGhost} onClick={() => setShowNewEntity(true)}>+ New</button>
      </div>
      <p style={css.subheader}>People, pets, places, fears, beliefs — the characters in your story.</p>

      {entities.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🧩</p>
          <p style={{ fontSize: 14, fontWeight: 300 }}>No entities yet. Create one to start linking memories.</p>
          <button style={{ ...css.btn, marginTop: 16, width: "auto", padding: "10px 24px" }} onClick={() => setShowNewEntity(true)}>Create first entity</button>
        </div>
      ) : (
        <>
          {selectedEntity ? (
            <EntityDetail id={selectedEntity} onBack={() => setSelectedEntity(null)} />
          ) : (
            entities.map(e => (
              <button key={e.id} onClick={() => setSelectedEntity(e.id)} style={{ ...css.card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", width: "calc(100% - 32px)", textAlign: "left" }}>
                <span style={{ fontSize: 28 }}>{getEntityIcon(e.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#f4f0e8" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {ENTITY_TYPES.find(t => t.type === e.type)?.label || e.type} · {sparkCount(e.id)} spark{sparkCount(e.id) !== 1 ? "s" : ""}
                  </div>
                </div>
                <span style={{ fontSize: 18, color: "#6b7280" }}>›</span>
              </button>
            ))
          )}
        </>
      )}

      {showNewEntity && (
        <Modal onClose={() => setShowNewEntity(false)} title="New Entity">
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.5 }}>
            A person, pet, place, fear, belief — anything that holds meaning in your story.
          </p>
          <input style={{ ...css.input, marginBottom: 10 }} placeholder="Name (e.g., Brandy, Chicago, Basement fear)" value={newEntityName} onChange={e => setNewEntityName(e.target.value)} autoFocus />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {ENTITY_TYPES.map(t => (
              <button key={t.type} style={css.chip(newEntityType === t.type)} onClick={() => setNewEntityType(t.type)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <button style={css.btn} onClick={addEntity} disabled={!newEntityName.trim()}>Create entity</button>
        </Modal>
      )}
    </div>
  );

  // ENTITY DETAIL
  const EntityDetail = ({ id, onBack }) => {
    const entity = getEntityById(id);
    if (!entity) return null;
    const linkedSparks = sparks.filter(s => s.entityIds.includes(id));
    return (
      <div>
        <button onClick={onBack} style={{ ...css.btnGhost, margin: "0 16px 16px", fontSize: 12 }}>← Back</button>
        <div style={{ padding: "0 20px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 40 }}>{getEntityIcon(entity.type)}</span>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 400 }}>{entity.name}</h2>
            <p style={{ fontSize: 12, color: "#6b7280" }}>
              {ENTITY_TYPES.find(t => t.type === entity.type)?.label} · {linkedSparks.length} spark{linkedSparks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ padding: "0 16px 8px", display: "flex", gap: 8 }}>
          <button style={{ ...css.btnGhost, fontSize: 11, color: "#c45a3c", borderColor: "#c45a3c33" }} onClick={() => deleteEntity(id)}>Delete entity</button>
        </div>
        {linkedSparks.length === 0 ? (
          <p style={{ padding: "24px 20px", fontSize: 13, color: "#6b7280", fontWeight: 300 }}>No sparks linked yet. Record a memory and tag it.</p>
        ) : (
          linkedSparks.map(s => <SparkCard key={s.id} spark={s} showActions />)
        )}
        {showTagging && <TaggingModal sparkId={showTagging} onClose={() => setShowTagging(null)} />}
      </div>
    );
  };

  // SETTINGS VIEW
  const SettingsView = () => (
    <div style={css.page}>
      <h1 style={css.header}>Settings</h1>
      <p style={css.subheader}>Your story, your rules.</p>

      <div style={{ ...css.card }}>
        <div style={css.label}>Default truth mode</div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(TRUTH_MODES).map(m => (
            <button key={m} style={css.truthPill(m, globalTruth === m)} onClick={() => setGlobalTruth(m)}>
              {TRUTH_MODES[m].icon} {TRUTH_MODES[m].label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>{TRUTH_MODES[globalTruth].desc}</p>
      </div>

      <div style={{ ...css.card }}>
        <div style={css.label}>Stats</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><span style={{ fontSize: 28, fontWeight: 300, color: "#c45a3c" }}>{sparks.length}</span><br/><span style={{ fontSize: 11, color: "#6b7280" }}>Total sparks</span></div>
          <div><span style={{ fontSize: 28, fontWeight: 300, color: "#4a6741" }}>{entities.length}</span><br/><span style={{ fontSize: 11, color: "#6b7280" }}>Entities</span></div>
          <div><span style={{ fontSize: 28, fontWeight: 300, color: "#d4963a" }}>{sparks.filter(s => s.truthMode === "brutal").length}</span><br/><span style={{ fontSize: 11, color: "#6b7280" }}>Brutal entries</span></div>
          <div><span style={{ fontSize: 28, fontWeight: 300, color: "#6b7280" }}>{sparks.filter(s => s.type === "voice").length}</span><br/><span style={{ fontSize: 11, color: "#6b7280" }}>Voice memos</span></div>
        </div>
      </div>

      <div style={{ ...css.card }}>
        <div style={css.label}>About</div>
        <p style={{ fontSize: 13, color: "#e8e2d6", fontWeight: 300, lineHeight: 1.7 }}>
          <strong style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>iauthr</strong> — Your life. Your voice. Your rules.
        </p>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.6 }}>
          Short-form is killing humanity. Storytelling created humanity. Let's repair humanity. Tell your story.
        </p>
      </div>

      <div style={{ padding: "16px" }}>
        <button style={{ ...css.btn, background: "#7a3525" }} onClick={() => {
          if (confirm("Export all sparks as JSON?")) {
            const blob = new Blob([JSON.stringify({ sparks, entities }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "iauthr-export.json"; a.click();
          }
        }}>
          Export all data (JSON)
        </button>
      </div>
    </div>
  );

  // MODAL
  function Modal({ children, onClose, title }) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: "#111", width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", padding: "24px 20px 32px", borderTop: "2px solid #c45a3c" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 400 }}>{title}</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>×</button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div style={css.app}>
      {view === "home" && <HomeView />}
      {view === "sparks" && <SparksView />}
      {view === "timeline" && <TimelineView />}
      {view === "entities" && <EntitiesView />}
      {view === "settings" && <SettingsView />}

      {/* Bottom nav */}
      <nav style={css.nav}>
        <button style={css.navBtn(view === "home")} onClick={() => setView("home")}>
          <span style={css.navIcon}>🔴</span>Capture
        </button>
        <button style={css.navBtn(view === "sparks")} onClick={() => setView("sparks")}>
          <span style={css.navIcon}>⚡</span>Sparks
        </button>
        <button style={css.navBtn(view === "timeline")} onClick={() => setView("timeline")}>
          <span style={css.navIcon}>📅</span>Timeline
        </button>
        <button style={css.navBtn(view === "entities")} onClick={() => setView("entities")}>
          <span style={css.navIcon}>🧩</span>Entities
        </button>
        <button style={css.navBtn(view === "settings")} onClick={() => setView("settings")}>
          <span style={css.navIcon}>⚙️</span>Settings
        </button>
      </nav>
    </div>
  );
}