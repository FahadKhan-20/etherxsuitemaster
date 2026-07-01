import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { pinJSON } from '../../utils/ipfs';

const GOLD = '#d4af37';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';
const SURFACE = 'rgba(18,18,22,0.98)';

export default function MeetingNotesModal({ isOpen, roomCode, onDone }) {
  const [notes, setNotes] = useState('');
  const [pinning, setPinning] = useState(false);
  const [cid, setCid] = useState(null);
  const [error, setError] = useState('');

  const handlePin = async () => {
    if (!notes.trim()) { onDone(); return; }
    setPinning(true);
    setError('');
    try {
      const result = await pinJSON({
        meetingId: roomCode,
        notes: notes.trim(),
        pinnedAt: Date.now(),
      });
      setCid(result);
    } catch {
      setError('Could not pin to IPFS. Notes saved locally.');
      onDone();
    } finally {
      setPinning(false);
    }
  };

  const gatewayUrl = cid
    ? `${import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs'}/${cid}`
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(9,11,11,0.85)',
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
              maxWidth: 440,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <FileText size={20} color={GOLD} />
              <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, color: '#f0e6d3', margin: 0 }}>
                Meeting notes
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              Add notes to pin permanently to IPFS — tamper-proof and decentralised.
            </p>

            {!cid ? (
              <>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Key decisions, action items, summary…"
                  rows={5}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${GOLD_BORDER}`,
                    borderRadius: 8, padding: '12px 14px',
                    fontSize: 13, color: '#f0e6d3', outline: 'none',
                    fontFamily: 'Inter, sans-serif', resize: 'vertical',
                    marginBottom: 16,
                  }}
                />
                {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</p>}
                <button
                  onClick={handlePin}
                  disabled={pinning}
                  style={{
                    width: '100%',
                    background: pinning ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg,#d4af37,#b8860b)',
                    border: 'none', color: '#000',
                    fontWeight: 700, fontSize: 14,
                    padding: 13, borderRadius: 10,
                    cursor: pinning ? 'wait' : 'pointer',
                    marginBottom: 10,
                  }}
                >
                  {pinning ? 'Pinning to IPFS…' : notes.trim() ? 'Pin to IPFS & end meeting' : 'Skip & end meeting'}
                </button>
                <button
                  onClick={onDone}
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    color: '#666', fontSize: 13, cursor: 'pointer', padding: 8,
                  }}
                >
                  End without notes
                </button>
              </>
            ) : (
              <>
                <div style={{
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 10, padding: '14px 16px', marginBottom: 20,
                }}>
                  <p style={{ fontSize: 12, color: '#22c55e', margin: '0 0 4px', fontWeight: 600 }}>Pinned to IPFS</p>
                  <p style={{ fontSize: 11, color: '#888', margin: 0, wordBreak: 'break-all', fontFamily: 'monospace' }}>{cid}</p>
                </div>
                <a
                  href={gatewayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(212,175,55,0.12)',
                    border: `1px solid ${GOLD_BORDER}`,
                    color: GOLD, fontSize: 13, fontWeight: 600,
                    padding: 12, borderRadius: 10,
                    textDecoration: 'none', marginBottom: 10,
                  }}
                >
                  <ExternalLink size={14} />
                  View on IPFS
                </a>
                <button
                  onClick={onDone}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg,#d4af37,#b8860b)',
                    border: 'none', color: '#000',
                    fontWeight: 700, fontSize: 14,
                    padding: 13, borderRadius: 10, cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
