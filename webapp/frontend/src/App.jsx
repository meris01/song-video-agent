import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import VideoLibrary from "./pages/VideoLibrary";
import SongMatcher from "./pages/SongMatcher";
import RenderStudio from "./pages/RenderStudio";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/videos" element={<VideoLibrary />} />
        <Route path="/match" element={<SongMatcher />} />
        <Route path="/render" element={<RenderStudio />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
