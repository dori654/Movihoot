import { Routes, Route } from 'react-router-dom';
import HostDashboard from './pages/HostDashboard';
import Lobby from './pages/Lobby';
import Questionnaire from './pages/Questionnaire';
import Results from './pages/Results';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HostDashboard />} />
      <Route path="/join" element={<Lobby />} />
      <Route path="/q" element={<Questionnaire />} />
      <Route path="/results" element={<Results />} />
    </Routes>
  );
}
