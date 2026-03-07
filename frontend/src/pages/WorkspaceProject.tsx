import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  getWorkspaceProject,
  getWorkspaceCanvas,
  createCanvasElement,
  deleteCanvasElement,
  getWorkspaceAssets,
  getWorkspaceNotes,
  createWorkspaceNote,
  updateWorkspaceNote,
  deleteWorkspaceNote,
  getWorkspaceWorkflows,
  getWorkspaceMembers,
} from "../api";
import "./WorkspaceProject.css";

type Tab = "canvas" | "assets" | "workflows" | "notes" | "collaboration";

export default function WorkspaceProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<{ id: string; name: string; type: string; status: string; members?: unknown[] } | null>(null);
  const [tab, setTab] = useState<Tab>("canvas");
  const [elements, setElements] = useState<{ id: string; type: string; xPosition: number; yPosition: number; width: number; height: number; content: object | null }[]>([]);
  const [assets, setAssets] = useState<{ id: string; type: string; name: string; url: string }[]>([]);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; author: { firstName: string; lastName: string } | null; updatedAt: string }[]>([]);
  const [workflow, setWorkflow] = useState<{ nodes: unknown[]; connections: unknown[] }>({ nodes: [], connections: [] });
  const [members, setMembers] = useState<{ userId: string; role: string; user: { firstName: string; lastName: string; email: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [addingElement, setAddingElement] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    getWorkspaceProject(projectId)
      .then((p) => { if (!cancelled) setProject(p); })
      .catch(() => { if (!cancelled) navigate("/workspace"); });
    return () => { cancelled = true; };
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [canvasRes, assetsRes, notesRes, workflowsRes, membersRes] = await Promise.all([
          getWorkspaceCanvas(projectId),
          getWorkspaceAssets(projectId),
          getWorkspaceNotes(projectId),
          getWorkspaceWorkflows(projectId),
          getWorkspaceMembers(projectId),
        ]);
        if (!cancelled) {
          setElements(canvasRes.elements);
          setAssets(assetsRes.assets);
          setNotes(notesRes.notes);
          setWorkflow(workflowsRes);
          setMembers(membersRes.members);
        }
      } catch {
        if (!cancelled) setElements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const handleAddElement = async (type: string) => {
    if (!projectId) return;
    setAddingElement(true);
    try {
      const el = await createCanvasElement(projectId, {
        type,
        xPosition: elements.length * 30,
        yPosition: elements.length * 30,
        width: type === "text" || type === "sticky" ? 200 : 100,
        height: type === "text" || type === "sticky" ? 80 : 100,
        content: type === "text" ? { text: "New text" } : type === "sticky" ? { text: "Sticky note", color: "#fef08a" } : {},
      });
      setElements((prev) => [...prev, { ...el, content: el.content || null }]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAddingElement(false);
    }
  };

  const handleDeleteElement = async (elementId: string) => {
    if (!projectId || !confirm("Delete this element?")) return;
    try {
      await deleteCanvasElement(projectId, elementId);
      setElements((prev) => prev.filter((e) => e.id !== elementId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleSaveNote = async () => {
    if (!projectId) return;
    if (editingNoteId) {
      try {
        await updateWorkspaceNote(projectId, editingNoteId, { title: noteTitle, body: noteBody });
        setNotes((prev) =>
          prev.map((n) =>
            n.id === editingNoteId ? { ...n, title: noteTitle, body: noteBody, updatedAt: new Date().toISOString() } : n
          )
        );
        setEditingNoteId(null);
        setNoteTitle("");
        setNoteBody("");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to update");
      }
    } else if (noteTitle.trim()) {
      try {
        const created = await createWorkspaceNote(projectId, { title: noteTitle.trim(), body: noteBody });
        setNotes((prev) => [{ ...created, author: null }, ...prev]);
        setNoteTitle("");
        setNoteBody("");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to create");
      }
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!projectId || !confirm("Delete this note?")) return;
    try {
      await deleteWorkspaceNote(projectId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setNoteTitle("");
        setNoteBody("");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  if (!project) return null;

  return (
    <div className="workspace-project">
      <header className="workspace-project-header">
        <Link to="/workspace" className="workspace-project-back">← Workspace</Link>
        <h1>{project.name}</h1>
        <span className="workspace-project-meta">{project.type} · {project.status}</span>
      </header>

      <nav className="workspace-project-tabs">
        {(["canvas", "assets", "workflows", "notes", "collaboration"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`workspace-project-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <main className="workspace-project-main">
        {tab === "canvas" && (
          <div className="workspace-project-canvas-wrap">
            <div className="workspace-project-canvas-toolbar">
              <span className="workspace-project-canvas-label">Elements</span>
              <button
                type="button"
                onClick={() => handleAddElement("text")}
                disabled={addingElement}
                className="workspace-project-canvas-add"
              >
                + Text
              </button>
              <button type="button" onClick={() => handleAddElement("shape")} disabled={addingElement} className="workspace-project-canvas-add">
                + Shape
              </button>
              <button type="button" onClick={() => handleAddElement("sticky")} disabled={addingElement} className="workspace-project-canvas-add">
                + Sticky
              </button>
              <button type="button" onClick={() => handleAddElement("frame")} disabled={addingElement} className="workspace-project-canvas-add">
                + Frame
              </button>
            </div>
            <div className="workspace-project-canvas-board">
              {loading ? (
                <p className="workspace-project-loading">Loading canvas…</p>
              ) : elements.length === 0 ? (
                <p className="workspace-project-empty">No elements yet. Add text, shapes, stickies, or frames from the toolbar.</p>
              ) : (
                <ul className="workspace-project-element-list">
                  {elements.map((el) => (
                    <li
                      key={el.id}
                      className="workspace-project-element"
                      style={{
                        left: el.xPosition,
                        top: el.yPosition,
                        width: el.width,
                        height: el.height,
                      }}
                    >
                      <span className="workspace-project-element-type">{el.type}</span>
                      {el.content && typeof el.content === "object" && "text" in el.content && (
                        <span className="workspace-project-element-preview">{(el.content as { text?: string }).text || "—"}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteElement(el.id)}
                        className="workspace-project-element-delete"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "assets" && (
          <div className="workspace-project-panel">
            <h2>Asset Library</h2>
            {assets.length === 0 ? (
              <p className="workspace-project-empty">No assets yet. Upload images, documents, or add links from the canvas or future upload UI.</p>
            ) : (
              <ul className="workspace-project-asset-list">
                {assets.map((a) => (
                  <li key={a.id} className="workspace-project-asset-item">
                    <span className="workspace-project-asset-name">{a.name}</span>
                    <span className="workspace-project-asset-type">{a.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "workflows" && (
          <div className="workspace-project-panel">
            <h2>Workflow Builder</h2>
            <p className="workspace-project-empty">
              Trigger → Condition → Action. Visual workflow mapping (execution engine coming later). {workflow.nodes.length} nodes, {workflow.connections.length} connections.
            </p>
          </div>
        )}

        {tab === "notes" && (
          <div className="workspace-project-panel workspace-project-notes">
            <h2>Notes</h2>
            <div className="workspace-project-note-form">
              <input
                type="text"
                placeholder="Note title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="workspace-project-note-title-input"
              />
              <textarea
                placeholder="Body (markdown)"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                className="workspace-project-note-body-input"
                rows={4}
              />
              <button type="button" onClick={handleSaveNote} className="workspace-project-btn workspace-project-btn-primary">
                {editingNoteId ? "Update note" : "Add note"}
              </button>
              {editingNoteId && (
                <button type="button" onClick={() => { setEditingNoteId(null); setNoteTitle(""); setNoteBody(""); }} className="workspace-project-btn">
                  Cancel
                </button>
              )}
            </div>
            <ul className="workspace-project-note-list">
              {notes.map((n) => (
                <li key={n.id} className="workspace-project-note-item">
                  <div className="workspace-project-note-item-header">
                    <h3>{n.title}</h3>
                    {n.author && <span className="workspace-project-note-author">{n.author.firstName} {n.author.lastName}</span>}
                  </div>
                  <p className="workspace-project-note-body-preview">{n.body.slice(0, 120)}{n.body.length > 120 ? "…" : ""}</p>
                  <div className="workspace-project-note-item-actions">
                    <button type="button" onClick={() => { setEditingNoteId(n.id); setNoteTitle(n.title); setNoteBody(n.body); }} className="workspace-project-btn-small">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDeleteNote(n.id)} className="workspace-project-btn-small">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "collaboration" && (
          <div className="workspace-project-panel">
            <h2>Collaboration</h2>
            <p className="workspace-project-meta-p">Owner, Editor, Viewer roles. Invite from Community coming later.</p>
            <ul className="workspace-project-member-list">
              {members.map((m) => (
                <li key={m.userId} className="workspace-project-member-item">
                  <span className="workspace-project-member-name">{m.user.firstName} {m.user.lastName}</span>
                  <span className="workspace-project-member-role">{m.role}</span>
                  <span className="workspace-project-member-email">{m.user.email}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
