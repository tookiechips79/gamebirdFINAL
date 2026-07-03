import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';
import { LogOut } from 'lucide-react';

export default function UserBar() {
  const { users, currentUser, setCurrentUser, addUser } = useUser();
  const { isAdmin, setIsAdmin } = useGame();
  const navigate = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const [newName, setNewName] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showPanel && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: r.bottom + 4,
        right: window.innerWidth - r.right,
      });
    }
  }, [showPanel]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const u = addUser(newName.trim());
    setCurrentUser(u);
    setNewName('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    if (isAdmin) setIsAdmin(false);
    navigate('/login');
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        ref={btnRef}
        className="btn btn-ghost px-3 py-1.5 text-xs flex items-center gap-2"
        onClick={() => { if (isAdmin) setShowPanel(v => !v); else if (!currentUser) navigate('/login'); }}
        style={{ cursor: (!currentUser || isAdmin) ? 'pointer' : 'default', color: isAdmin ? '#000' : undefined }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: currentUser ? 'var(--green)' : 'var(--text)' }} />
        <span className="truncate max-w-[80px]" style={{ color: isAdmin ? '#000' : undefined }}>{currentUser ? currentUser.name : isAdmin ? 'ADMIN' : 'SIGN IN'}</span>
        {currentUser && (
          <span className="mono" style={{ color: isAdmin ? '#000' : 'var(--gold)' }}>{currentUser.credits}</span>
        )}
        {isAdmin && <span style={{ color: '#000' }}>{showPanel ? '▲' : '▼'}</span>}
      </button>
      {(currentUser || isAdmin) && (
        <button
          onClick={handleLogout}
          className="btn btn-ghost p-1.5"
          title="Log out"
          style={{ color: isAdmin ? '#000' : 'rgba(255,255,255,0.4)' }}
        >
          <LogOut size={14} />
        </button>
      )}

      {showPanel && isAdmin && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
          <div
            className="hud-panel z-50 py-1"
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              right: dropdownPos.right,
              width: 260,
              maxHeight: 'calc(100dvh - 80px)',
              overflowY: 'auto',
            }}
          >
          {users.map(u => (
            <button
              key={u.id}
              className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-[rgba(0,229,255,0.05)] transition-colors"
              onClick={() => { setCurrentUser(u); setShowPanel(false); }}
            >
              <div className="flex items-center gap-2">
                {u.isAdmin && <span className="text-xs" style={{ color: 'var(--gold)' }}>★</span>}
                <span className={currentUser?.id === u.id ? 'neon-cyan font-bold' : ''}>{u.name}</span>
              </div>
              <span className="mono text-xs" style={{ color: 'var(--gold)' }}>{u.credits}</span>
            </button>
          ))}
          <div className="border-t border-[var(--border)] mt-1 pt-1 px-3 pb-2 flex gap-2">
            <input
              className="flex-1 bg-transparent border-b border-[var(--border)] px-1 py-1 text-xs outline-none placeholder:text-[var(--text)]"
              placeholder="New player name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button className="btn btn-cyan px-2 py-1 text-xs" onClick={handleAdd}>+</button>
          </div>
          <div className="px-3 pb-1">
            <button
              className="btn btn-ghost w-full text-xs py-1"
              onClick={() => { setIsAdmin(false); setShowPanel(false); }}
            >
              EXIT ADMIN MODE
            </button>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
