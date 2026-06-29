import { createRoot } from 'react-dom/client';
import App from './App';

// Unlock audio context and prime all sounds on first user gesture
const soundFiles = ['/hover.mp3', '/keypad.mp3', '/keytype.mp3', '/bet-click.mp3'];
const primedSounds = soundFiles.map(src => {
  const a = new Audio(src);
  a.volume = 0;
  return a;
});

document.addEventListener('click', () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  ctx.resume().catch(() => {});
  primedSounds.forEach(a => {
    a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = 1; }).catch(() => {});
  });
}, { once: true });

// Global keytype sound on all text inputs
const keytypeSound = new Audio('/keytype.mp3');
document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (el.matches('input, textarea')) {
    keytypeSound.currentTime = 0;
    keytypeSound.play().catch(() => {});
  }
}, { passive: true });

createRoot(document.getElementById('root')!).render(<App />);
