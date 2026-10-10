import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { useWallet } from '../../context/WalletContext';

const GOLD = 'var(--c-d4af37)';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';
const SURFACE = 'color-mix(in srgb, var(--c-121216) 98%, transparent)';

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
            background: 'color-mix(in srgb, var(--c-090b0b) 80%, transparent)',
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
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--t-666666)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <ShieldCheck size={20} color={'var(--t-d4af37)'} />
              <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, color: 'var(--t-f0e6d3)', margin: 0 }}>
                Token-gate this room?
              </h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t-888888)', marginBottom: 24 }}>
              Only wallets holding your token can join. Free — just a balance check.
            </p>

            <label style={{ display: 'block', fontSize: 11, color: 'var(--t-888888)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Token contract address (ERC-20 or NFT)
            </label>
            <input
              value={tokenAddress}
              onChange={e => { setTokenAddress(e.target.value); setError(''); }}
              placeholder="0x..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'color-mix(in srgb, var(--c-ffffff) 6%, transparent)',
                border: `1px solid ${GOLD_BORDER}`,
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, color: 'var(--t-ffffff)', outline: 'none',
                fontFamily: 'monospace', marginBottom: 12,
              }}
            />

            <label style={{ display: 'block', fontSize: 11, color: 'var(--t-888888)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Minimum balance required
            </label>
            <input
              type="number"
              min="1"
              value={minBalance}
              onChange={e => setMinBalance(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'color-mix(in srgb, var(--c-ffffff) 6%, transparent)',
                border: `1px solid ${GOLD_BORDER}`,
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, color: 'var(--t-ffffff)', outline: 'none',
                fontFamily: 'Inter, sans-serif', marginBottom: 16,
              }}
            />

            {error && (
              <p style={{ fontSize: 12, color: 'var(--t-f87171)', marginBottom: 12 }}>{error}</p>
            )}

            <button
              onClick={handleSet}
              disabled={saving}
              style={{
                width: '100%',
                background: saving ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg,var(--c-d4af37),var(--c-b8860b))',
                border: 'none', color: 'var(--t-000000)',
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
                color: 'var(--t-666666)', fontSize: 13, cursor: 'pointer', padding: 8,
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
