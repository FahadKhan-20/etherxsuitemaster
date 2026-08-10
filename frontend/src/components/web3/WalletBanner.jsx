import { motion } from 'framer-motion';
import { useWallet } from '../../context/WalletContext';

const GOLD        = '#E5C76A';
const GOLD_DIM    = 'rgba(229,199,106,0.12)';
const GOLD_BORDER = 'rgba(229,199,106,0.70)';
const BLACK_CARD  = 'rgba(0, 0, 0, 0.97)';

const NET = import.meta.env.VITE_NETWORK;
const NETWORK_LABEL  = NET === 'mainnet' ? 'POLYGON' : NET === 'amoy' ? 'AMOY TESTNET' : 'HARDHAT';
const NETWORK_SYMBOL = NET === 'mainnet' || NET === 'amoy' ? 'MATIC' : 'ETH';

function truncate(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

export default function WalletBanner() {
  const { account, balance, isConnecting, connectError } = useWallet();

  if (isConnecting) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: BLACK_CARD, border: `1px solid ${GOLD_BORDER}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, opacity: 0.6, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#888' }}>Setting up your wallet…</span>
      </motion.div>
    );
  }

  if (account) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: BLACK_CARD, border: `1px solid ${GOLD_BORDER}`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E', flexShrink: 0 }} />
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#F0E0B0' }}>
          {truncate(account)}
        </span>
        <span style={{
          background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`,
          borderRadius: 20, padding: '2px 10px', fontSize: 11,
          color: GOLD, fontWeight: 700, letterSpacing: '0.06em',
        }}>
          {NETWORK_LABEL}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
          {balance || '…'} {NETWORK_SYMBOL}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: 16 }}
    >
      {connectError && (
        <div style={{
          padding: '8px 14px', background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
          fontSize: 12, color: '#f87171',
        }}>
          ⚠ {connectError}
        </div>
      )}
    </motion.div>
  );
}
