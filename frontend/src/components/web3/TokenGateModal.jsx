import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { useWallet } from '../../context/WalletContext';

const GOLD = '#d4af37';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';
const SURFACE = 'rgba(18,18,22,0.98)';

export default function TokenGateModal({ isOpen, roomCode, onSkip, onGateSet }) {
  const { account } = useWallet();
  const [tokenAddress, setTokenAddress] = useState('');
  const [minBalance, setMinBalance] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSet = async () => {
    if (!tokenAddress.trim()) { setError('Enter a token contract address.'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(tokenAddress.trim())) {
      setError('Invalid Ethereum address format.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/api/rooms/gate', {
        roomCode,
        tokenAddress: tokenAddress.trim(),
        minBalance,
        creatorAddress: account,
      });
      onGateSet();
    } catch {
      setError('Failed to save gate. Proceeding without gate.');
      onSkip();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(9,11,11,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              background: SURFACE,
              border: `1px solid ${GOLD_BORDER}`,
              borderRadius: 16,
              padding: 32,
              width: '100%',
              maxWidth: 400,
              position: 'relative',
            }}
          >
            <button
              onClick={onSkip}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <ShieldCheck size={20} color={GOLD} />
              <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, color: '#f0e6d3', margin: 0 }}>
                Token-gate this room?
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
              Only wallets holding your token can join. Free — just a balance check.
            </p>

            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Token contract address (ERC-20 or NFT)
            </label>
            <input
              value={tokenAddress}
              onChange={e => { setTokenAddress(e.target.value); setError(''); }}
              placeholder="0x..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${GOLD_BORDER}`,
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, color: '#fff', outline: 'none',
                fontFamily: 'monospace', marginBottom: 12,
              }}
            />

            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Minimum balance required
            </label>
            <input
              type="number"
              min="1"
              value={minBalance}
              onChange={e => setMinBalance(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${GOLD_BORDER}`,
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, color: '#fff', outline: 'none',
                fontFamily: 'Inter, sans-serif', marginBottom: 16,
              }}
            />

            {error && (
              <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</p>
            )}

            <button
              onClick={handleSet}
              disabled={saving}
              style={{
                width: '100%',
                background: saving ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg,#d4af37,#b8860b)',
                border: 'none', color: '#000',
                fontWeight: 700, fontSize: 14,
                padding: 13, borderRadius: 10, cursor: saving ? 'wait' : 'pointer',
                marginBottom: 10,
              }}
            >
              {saving ? 'Saving…' : 'Set gate & start meeting'}
            </button>
            <button
              onClick={onSkip}
              style={{
                width: '100%', background: 'transparent', border: 'none',
                color: '#666', fontSize: 13, cursor: 'pointer', padding: 8,
              }}
            >
              Skip — open room without gate
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
