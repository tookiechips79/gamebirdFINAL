import React, { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { User } from '@/types';

function UserRow({ user }: { user: User }) {
  const { addCredits, deleteUser, updateMembership } = useUser();
  const [custom, setCustom] = useState('');

  const isPremium = user.membership?.tier === 'premium' && !user.membership?.cancelledAt;

  const activateMembership = () => {
    updateMembership(user.id, { tier: 'premium', startDate: Date.now(), renewsAt: Date.now() + 365 * 24 * 60 * 60 * 1000 });
  };

  const revokeMembership = () => {
    if (confirm(`Revoke premium for ${user.name}?`))
      updateMembership(user.id, { tier: 'premium', startDate: user.membership?.startDate ?? Date.now(), cancelledAt: Date.now() });
  };

  return (
    <div style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Name + balance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>{user.name}</span>
          {user.referredBy && (
            <div style={{ color: '#FFD700', fontSize: 10, fontFamily: 'monospace', marginTop: 2, letterSpacing: 1 }}>
              BONUS: {user.referredBy}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#FFD700', fontWeight: 900, fontSize: 18, fontFamily: 'monospace' }}>{user.credits}</span>
          <button onClick={() => confirm(`Delete ${user.name}?`) && deleteUser(user.id)} style={{ background: 'none', border: '1px solid #ff0040', color: '#ff0040', padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>DEL</button>
        </div>
      </div>

      {/* Quick add */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[100, 200, 500, 1000].map(n => (
          <button key={n} onClick={() => addCredits(user.id, n)}
            style={{ flex: 1, background: '#00ff41', border: 'none', color: '#000', fontWeight: 900, fontSize: 12, padding: '8px 0', cursor: 'pointer' }}>
            +{n}
          </button>
        ))}
      </div>

      {/* Quick remove */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[100, 200, 500].map(n => (
          <button key={n} onClick={() => addCredits(user.id, -n)}
            style={{ flex: 1, background: 'none', border: '1px solid #ff0040', color: '#ff0040', fontWeight: 900, fontSize: 12, padding: '8px 0', cursor: 'pointer' }}>
            -{n}
          </button>
        ))}
        <button onClick={() => confirm(`Zero out ${user.name}?`) && addCredits(user.id, -user.credits)}
          style={{ flex: 1, background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#888', fontWeight: 700, fontSize: 11, padding: '8px 0', cursor: 'pointer' }}>
          ZERO
        </button>
      </div>

      {/* Membership */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: isPremium ? '#00ff41' : '#888', letterSpacing: 1 }}>
          {isPremium ? '★ PREMIUM' : 'FREE'}
        </span>
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          <button
            onClick={activateMembership}
            disabled={isPremium}
            style={{ flex: 1, background: isPremium ? 'rgba(0,255,65,0.08)' : '#00ff41', border: '1px solid #00ff41', color: isPremium ? '#00ff41' : '#000', fontWeight: 900, fontSize: 11, padding: '6px 0', cursor: isPremium ? 'default' : 'pointer', opacity: isPremium ? 0.4 : 1 }}
          >
            ACTIVATE
          </button>
          <button
            onClick={revokeMembership}
            disabled={!isPremium}
            style={{ flex: 1, background: 'none', border: '1px solid #ff0040', color: '#ff0040', fontWeight: 900, fontSize: 11, padding: '6px 0', cursor: !isPremium ? 'default' : 'pointer', opacity: !isPremium ? 0.3 : 1 }}
          >
            REVOKE
          </button>
        </div>
      </div>

      {/* Custom */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="number" placeholder="Custom amount" value={custom} onChange={e => setCustom(e.target.value)}
          style={{ flex: 1, background: '#111', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 10px', fontSize: 12, outline: 'none' }} />
        <button onClick={() => { const n = parseInt(custom); if (n > 0) { addCredits(user.id, n); setCustom(''); } }}
          style={{ background: '#00e5ff', border: 'none', color: '#000', fontWeight: 900, fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}>ADD</button>
        <button onClick={() => { const n = parseInt(custom); if (n > 0) { addCredits(user.id, -n); setCustom(''); } }}
          style={{ background: 'none', border: '1px solid #ff0040', color: '#ff0040', fontWeight: 900, fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}>SUB</button>
      </div>
    </div>
  );
}

export default function UserManager({ onClose }: { onClose: () => void }) {
  const { users, addUser } = useUser();
  const [newName, setNewName] = useState('');
  const [newCredits, setNewCredits] = useState('1000');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addUser(newName.trim(), false, parseInt(newCredits) || 1000);
    setNewName('');
    setNewCredits('1000');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#050510', borderBottom: '1px solid rgba(0,229,255,0.3)', position: 'sticky', top: 0, zIndex: 1 }}>
        <span style={{ color: '#00e5ff', fontWeight: 900, fontSize: 16, letterSpacing: 3, textTransform: 'uppercase' }}>User Manager</span>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕ CLOSE</button>
      </div>

      {/* User list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
        {users.filter(u => !u.isAdmin).map(u => <UserRow key={u.id} user={u} />)}
        {users.filter(u => !u.isAdmin).length === 0 && (
          <div style={{ color: '#555', textAlign: 'center', padding: 40, fontSize: 13 }}>NO PLAYERS YET</div>
        )}
      </div>

      {/* Add player — sticky at bottom */}
      <div style={{ position: 'sticky', bottom: 0, background: '#050510', borderTop: '1px solid rgba(0,229,255,0.3)', padding: '12px 16px', display: 'flex', gap: 8 }}>
        <input placeholder="Player name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1, background: '#111', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
        <input type="number" placeholder="1000" value={newCredits} onChange={e => setNewCredits(e.target.value)}
          style={{ width: 80, background: '#111', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none' }} />
        <button onClick={handleAdd}
          style={{ background: '#00e5ff', border: 'none', color: '#000', fontWeight: 900, fontSize: 13, padding: '8px 18px', cursor: 'pointer' }}>+ ADD</button>
      </div>
    </div>
  );
}
