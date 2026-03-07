import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getWorkspaceHome,
  createWorkspaceProject,
  getWorkspaceTemplates,
} from "../api";
import "./WorkspaceHome.css";

type HomeData = {
  recentProjects: { id: string; name: string; type: string; status: string; updatedAt: string }[];
  sharedWithMe: { id: string; name: string; type: string; role: string; ownerWorkspace: string; updatedAt: string }[];
  recommendedTemplates: { id: string; slug: string; name: string; description: string | null; type: string }[];
};

export default function WorkspaceHome() {
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData | null>(null);
  const [templates, setTemplates] = useState<{ id: string; slug: string; name: string; description: string | null; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<"canvas" | "branding_board" | "business_model" | "marketing_funnel" | "workflow_map">("canvas");
  const [createTemplateId, setCreateTemplateId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getWorkspaceHome(), getWorkspaceTemplates()])
      .then(([home, t]) => {
        if (!cancelled) {
          setData(home);
          setTemplates(t.templates);
        }
      })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCreateBlank = async () => {
    const name = createName.trim() || "Untitled project";
    setCreating(true);
    try {
      const project = await createWorkspaceProject({
        name,
        type: createType,
        templateId: createTemplateId || undefined,
      });
      navigate(`/workspace/project/${project.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromTemplate = async (templateId: string, templateName: string) => {
    setCreating(true);
    try {
      const project = await createWorkspaceProject({
        name: `${templateName} – ${new Date().toLocaleDateString()}`,
        type: "canvas",
        templateId,
      });
      navigate(`/workspace/project/${project.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="workspace-home">
        <div className="workspace-home-loading">Loading workspace…</div>
      </div>
    );
  }

  return (
    <div className="workspace-home">
      <header className="workspace-home-header">
        <h1>Workspace</h1>
        <p className="workspace-home-subtitle">Business execution canvas – brainstorm, brand, plan, and collaborate.</p>
      </header>

      <section className="workspace-home-section">
        <h2>Recent Projects</h2>
        {data?.recentProjects?.length ? (
          <ul className="workspace-home-project-list">
            {data.recentProjects.map((p) => (
              <li key={p.id}>
                <Link to={`/workspace/project/${p.id}`} className="workspace-home-project-card">
                  <span className="workspace-home-project-name">{p.name}</span>
                  <span className="workspace-home-project-meta">{p.type} · {p.status}</span>
                  <span className="workspace-home-project-date">{new Date(p.updatedAt).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="workspace-home-empty">No projects yet. Create one below.</p>
        )}
      </section>

      <section className="workspace-home-section">
        <h2>Create New Project</h2>
        <div className="workspace-home-create">
          <input
            type="text"
            placeholder="Project name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="workspace-home-input"
          />
          <select
            value={createType}
            onChange={(e) => setCreateType(e.target.value as typeof createType)}
            className="workspace-home-select"
          >
            <option value="canvas">Blank canvas</option>
            <option value="branding_board">Branding board</option>
            <option value="business_model">Business model</option>
            <option value="marketing_funnel">Marketing funnel</option>
            <option value="workflow_map">Workflow map</option>
          </select>
          <select
            value={createTemplateId}
            onChange={(e) => setCreateTemplateId(e.target.value)}
            className="workspace-home-select"
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateBlank}
            disabled={creating}
            className="workspace-home-btn workspace-home-btn-primary"
          >
            {creating ? "Creating…" : "Create project"}
          </button>
        </div>
      </section>

      <section className="workspace-home-section">
        <h2>Recommended Templates</h2>
        <div className="workspace-home-templates">
          {templates.map((t) => (
            <div key={t.id} className="workspace-home-template-card">
              <h3>{t.name}</h3>
              {t.description && <p>{t.description}</p>}
              <button
                type="button"
                onClick={() => handleCreateFromTemplate(t.id, t.name)}
                disabled={creating}
                className="workspace-home-btn workspace-home-btn-outline"
              >
                Use template
              </button>
            </div>
          ))}
        </div>
        {templates.length === 0 && <p className="workspace-home-empty">No templates available.</p>}
      </section>

      {data?.sharedWithMe?.length ? (
        <section className="workspace-home-section">
          <h2>Shared with me</h2>
          <ul className="workspace-home-project-list">
            {data.sharedWithMe.map((p) => (
              <li key={p.id}>
                <Link to={`/workspace/project/${p.id}`} className="workspace-home-project-card">
                  <span className="workspace-home-project-name">{p.name}</span>
                  <span className="workspace-home-project-meta">{p.role} · {p.ownerWorkspace}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
