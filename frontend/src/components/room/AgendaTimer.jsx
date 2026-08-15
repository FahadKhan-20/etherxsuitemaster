/**
 * Meeting Agenda with optional timers.
 * Host can add topics before/during the meeting.
 * Host/presenter can start and mark topics as completed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Play,
  Pause,
  SkipForward,
  Trash2,
  CheckCircle2,
  Clock,
  AlarmClock,
  Check,
} from "lucide-react";

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtTime(s) {
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

const PRESETS = [
  { label: "2m", mins: 2 },
  { label: "5m", mins: 5 },
  { label: "10m", mins: 10 },
  { label: "15m", mins: 15 },
  { label: "30m", mins: 30 },
];

export default function AgendaTimer({ isHost = false }) {
  const [items, setItems] = useState([
    { id: 1, title: "Project Update", mins: 5, done: false },
    { id: 2, title: "UI Discussion", mins: 10, done: false },
    { id: 3, title: "Deployment", mins: 5, done: false },
  ]);

  const [currentIdx, setCurrentIdx] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMins, setNewMins] = useState(5);
  const [overtime, setOvertime] = useState(false);

  const intervalRef = useRef(null);

  // Timer
  useEffect(() => {
    clearInterval(intervalRef.current);

    if (!running) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 0) {
          setOvertime(true);
          return prev - 1;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [running]);

  // Start a topic
  const startItem = useCallback(
    (idx) => {
      if (!items[idx]) return;

      setCurrentIdx(idx);
      setRemaining(items[idx].mins * 60);
      setRunning(true);
      setOvertime(false);
    },
    [items]
  );

  // Mark current topic as completed
  const completeCurrentItem = () => {
    if (currentIdx === null) return;

    setItems((prev) =>
      prev.map((item, index) =>
        index === currentIdx ? { ...item, done: true } : item
      )
    );

    setRunning(false);
    clearInterval(intervalRef.current);
  };

  // Move to next topic
  const nextItem = () => {
    if (currentIdx === null) {
      const firstPending = items.findIndex((item) => !item.done);

      if (firstPending !== -1) {
        startItem(firstPending);
      }

      return;
    }

    // Mark current topic completed
    setItems((prev) =>
      prev.map((item, index) =>
        index === currentIdx ? { ...item, done: true } : item
      )
    );

    const nextIndex = items.findIndex(
      (item, index) => index > currentIdx && !item.done
    );

    if (nextIndex !== -1) {
      startItem(nextIndex);
    } else {
      setRunning(false);
      setCurrentIdx(null);
      setRemaining(0);
    }
  };

  // Pause / Resume
  const togglePause = () => {
    setRunning((previous) => !previous);
  };

  // Add agenda item
  const addItem = () => {
    if (!newTitle.trim()) return;

    const newItem = {
      id: Date.now(),
      title: newTitle.trim(),
      mins: newMins,
      done: false,
    };

    setItems((previous) => [...previous, newItem]);

    setNewTitle("");
    setNewMins(5);
  };

  // Remove agenda item
  const removeItem = (id) => {
    const index = items.findIndex((item) => item.id === id);

    if (index === currentIdx) {
      setCurrentIdx(null);
      setRunning(false);
      setRemaining(0);
    }

    setItems((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  // Progress
  const completedCount = items.filter((item) => item.done).length;
  const totalCount = items.length;

  const progressPct =
    totalCount > 0
      ? (completedCount / totalCount) * 100
      : 0;

  const isOvertime = overtime && remaining < 0;

  const displayTime = isOvertime
    ? `-${fmtTime(Math.abs(remaining))}`
    : fmtTime(Math.max(0, remaining));

  const timerColor = isOvertime
    ? "#F87171"
    : remaining < 60
      ? "#FBBF24"
      : "#34D399";

  return (
    <div style={{ fontFamily: "Geist, Inter, sans-serif" }}>
      <style>{`
        .agenda-item {
          padding: 10px 12px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .agenda-item.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }

        .agenda-item.done {
          opacity: 0.55;
        }

        .ag-input {
          width: 100%;
          padding: 8px 12px;
          background: var(--surface-2);
          border: 1px solid var(--border-strong);
          border-radius: 9px;
          color: var(--text);
          font-size: 13px;
          outline: none;
        }

        .ag-input:focus {
          border-color: var(--accent);
        }

        .ag-preset-btn {
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-2);
          font-size: 11px;
          cursor: pointer;
        }

        .ag-preset-btn:hover,
        .ag-preset-btn.sel {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            Meeting Agenda
          </span>

          <span
            style={{
              fontSize: 11,
              color: "var(--text-3)",
            }}
          >
            {completedCount}/{totalCount} Completed
          </span>
        </div>

        <div
          style={{
            height: 6,
            background: "var(--surface-3)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "var(--accent)",
              transition: "width 0.5s",
            }}
          />
        </div>
      </div>

      {/* Current Topic */}
      {currentIdx !== null && items[currentIdx] && (
        <div
          style={{
            padding: 16,
            background: "var(--surface-2)",
            border: `2px solid ${timerColor}44`,
            borderRadius: 14,
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 5,
            }}
          >
            {isOvertime ? "OVERTIME" : "NOW DISCUSSING"}
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            {items[currentIdx].title}
          </div>

          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: timerColor,
            }}
          >
            {displayTime}
          </div>

          {isHost && (
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <button onClick={togglePause}>
                {running ? (
                  <>
                    <Pause size={14} /> Pause
                  </>
                ) : (
                  <>
                    <Play size={14} /> Resume
                  </>
                )}
              </button>

              <button onClick={completeCurrentItem}>
                <Check size={14} /> Complete
              </button>

              <button onClick={nextItem}>
                <SkipForward size={14} /> Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Agenda Topics */}
      <div style={{ marginBottom: 14 }}>
        {items.length === 0 && (
          <div
            style={{
              padding: 15,
              textAlign: "center",
              color: "var(--text-3)",
            }}
          >
            No agenda topics added yet.
          </div>
        )}

        {items.map((item, index) => (
          <div
            key={item.id}
            className={`agenda-item ${
              index === currentIdx ? "active" : ""
            } ${item.done ? "done" : ""}`}
          >
            {item.done ? (
              <CheckCircle2
                size={18}
                style={{ color: "#34D399", flexShrink: 0 }}
              />
            ) : (
              <Clock
                size={18}
                style={{
                  color: "var(--text-3)",
                  flexShrink: 0,
                }}
              />
            )}

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                {index + 1}. {item.title}
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                }}
              >
                {item.mins} minutes
              </div>
            </div>

            {isHost &&
              currentIdx === null &&
              !item.done && (
                <button
                  onClick={() => startItem(index)}
                  style={{
                    padding: "5px 10px",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 7,
                    cursor: "pointer",
                  }}
                >
                  Start
                </button>
              )}

            {isHost && (
              <button
                onClick={() => removeItem(item.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-3)",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Topic - Host only */}
      {isHost && (
        <div
          style={{
            padding: 14,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 10,
              color: "var(--text)",
            }}
          >
            Add Agenda Topic
          </div>

          <input
            className="ag-input"
            placeholder="Example: Project Update"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 10,
              marginBottom: 10,
            }}
          >
            {PRESETS.map((preset) => (
              <button
                key={preset.mins}
                className={`ag-preset-btn ${
                  newMins === preset.mins ? "sel" : ""
                }`}
                onClick={() => setNewMins(preset.mins)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            onClick={addItem}
            disabled={!newTitle.trim()}
            style={{
              width: "100%",
              padding: 10,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              fontWeight: 700,
              cursor: newTitle.trim()
                ? "pointer"
                : "not-allowed",
              opacity: newTitle.trim() ? 1 : 0.5,
            }}
          >
            <Plus size={15} /> Add Topic
          </button>
        </div>
      )}

      {/* Start Agenda */}
      {isHost &&
        currentIdx === null &&
        items.some((item) => !item.done) && (
          <button
            onClick={() => {
              const firstPending = items.findIndex(
                (item) => !item.done
              );

              if (firstPending !== -1) {
                startItem(firstPending);
              }
            }}
            style={{
              marginTop: 10,
              width: "100%",
              padding: 11,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <AlarmClock size={16} /> Start Agenda
          </button>
        )}
    </div>
  );
}