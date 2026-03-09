import { BrowserRouter, Routes, Route } from "react-router-dom";

/** Placeholder – frontend UI is being replaced. All routes render this. */
function Placeholder() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", textAlign: "center" }}>
      <h1>Amanah Institute</h1>
      <p>Frontend coming soon. Backend API is ready.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Placeholder />} />
        <Route path="/register" element={<Placeholder />} />
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
