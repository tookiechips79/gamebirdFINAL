import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Temporarily mute all sounds
(window as any).__MUTE_SOUNDS = true;

createRoot(document.getElementById("root")!).render(<App />);
