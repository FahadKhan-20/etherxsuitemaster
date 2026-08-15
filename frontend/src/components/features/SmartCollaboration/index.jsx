import React, { useState } from "react";
import "./SmartCollaboration.css";

const tools = [
  {
    id: "whiteboard",
    name: "AI Whiteboard",
    icon: "✏️",
    description: "Draw diagrams and collaborate on a shared whiteboard.",
  },
  {
    id: "notes",
    name: "Collaborative Notes",
    icon: "📝",
    description: "Create and edit meeting notes together.",
  },
  {
    id: "mindmap",
    name: "Mind Map",
    icon: "🧠",
    description: "Organize ideas visually with a mind map.",
  },
  {
    id: "sticky",
    name: "Sticky Notes",
    icon: "📌",
    description: "Create quick notes and ideas.",
  },
  {
    id: "tasks",
    name: "Task Board",
    icon: "✅",
    description: "Manage meeting tasks and assignments.",
  },
  {
    id: "code",
    name: "Code Collaboration",
    icon: "💻",
    description: "Collaborate on code in real time.",
  },
];

function SmartCollaboration() {
  const [activeTool, setActiveTool] = useState("whiteboard");

  const selectedTool = tools.find((tool) => tool.id === activeTool);

  return (
    <div className="smart-collaboration">
      {/* Header */}
      <div className="smart-collaboration-header">
        <div>
          <h1>Smart Collaboration</h1>
          <p>
            Collaborate with your meeting participants using powerful
            workspace tools.
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="smart-collaboration-layout">
        {/* Sidebar */}
        <aside className="collaboration-sidebar">
          <h3>Tools</h3>

          {tools.map((tool) => (
            <button
              key={tool.id}
              className={`collaboration-tool ${
                activeTool === tool.id ? "active" : ""
              }`}
              onClick={() => setActiveTool(tool.id)}
            >
              <span className="tool-icon">{tool.icon}</span>

              <span className="tool-info">
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
              </span>
            </button>
          ))}
        </aside>

        {/* Workspace */}
        <main className="collaboration-workspace">
          <div className="workspace-header">
            <div>
              <h2>
                {selectedTool.icon} {selectedTool.name}
              </h2>

              <p>{selectedTool.description}</p>
            </div>

            <div className="connection-status">
              <span className="status-dot"></span>
              Connected
            </div>
          </div>

          <div className="workspace-content">
            {activeTool === "whiteboard" && (
              <div className="empty-workspace">
                <div className="large-icon">✏️</div>

                <h2>AI Whiteboard</h2>

                <p>
                  Your collaborative whiteboard will be available here.
                </p>

                <button className="primary-button">
                  Create Whiteboard
                </button>
              </div>
            )}

            {activeTool === "notes" && (
              <div className="empty-workspace">
                <div className="large-icon">📝</div>

                <h2>Collaborative Notes</h2>

                <p>
                  Start taking notes with your meeting participants.
                </p>

                <button className="primary-button">
                  Start Notes
                </button>
              </div>
            )}

            {activeTool === "mindmap" && (
              <div className="empty-workspace">
                <div className="large-icon">🧠</div>

                <h2>Mind Map</h2>

                <p>
                  Create a visual representation of your ideas.
                </p>

                <button className="primary-button">
                  Create Mind Map
                </button>
              </div>
            )}

            {activeTool === "sticky" && (
              <div className="empty-workspace">
                <div className="large-icon">📌</div>

                <h2>Sticky Notes</h2>

                <p>
                  Add ideas, reminders and discussion points.
                </p>

                <button className="primary-button">
                  Add Sticky Note
                </button>
              </div>
            )}

            {activeTool === "tasks" && (
              <div className="empty-workspace">
                <div className="large-icon">✅</div>

                <h2>Task Board</h2>

                <p>
                  Create and manage tasks for your team.
                </p>

                <button className="primary-button">
                  Create Task
                </button>
              </div>
            )}

            {activeTool === "code" && (
              <div className="empty-workspace">
                <div className="large-icon">💻</div>

                <h2>Code Collaboration</h2>

                <p>
                  Work together on code with your team.
                </p>

                <button className="primary-button">
                  Open Code Editor
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default SmartCollaboration;