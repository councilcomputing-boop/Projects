import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CardBackProvider } from './contexts/CardBackContext';
import { PhoneShell } from './components/PhoneShell';
import { Home } from './pages/Home';
import { SpeedDrill } from './pages/SpeedDrill';
import { ClassicPlay } from './pages/ClassicPlay';
import { Manual } from './pages/Manual';
import { DeckMath } from './pages/DeckMath';
import { Rules } from './pages/Rules';
import { Store } from './pages/Store';
import { CardBacks } from './pages/CardBacks';
import { Profile } from './pages/Profile';

export function App() {
  return (
    <BrowserRouter>
      <CardBackProvider>
        <PhoneShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/manual" element={<Manual />} />
          <Route path="/peek" element={<ClassicPlay allowPeek />} />
          <Route path="/quiz" element={<ClassicPlay allowPeek={false} />} />
          <Route path="/deck-math" element={<DeckMath />} />
          <Route path="/drill" element={<SpeedDrill />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/store" element={<Store />} />
          <Route path="/card-backs" element={<CardBacks />} />
          <Route path="/profile" element={<Profile />} />
          </Routes>
        </PhoneShell>
      </CardBackProvider>
    </BrowserRouter>);

}