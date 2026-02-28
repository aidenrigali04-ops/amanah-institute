export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="dashboard-home" style={{ padding: "24px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: "1.25rem" }}>{title}</h1>
      <p style={{ margin: 0, color: "#666" }}>This section is coming soon.</p>
    </div>
  );
}
