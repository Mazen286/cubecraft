import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home, DraftSetup, Draft, Results } from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<DraftSetup />} />
        <Route path="/draft" element={<Draft />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
