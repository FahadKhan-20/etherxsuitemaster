import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';

export function useEnsName(address) {
  const { provider } = useWallet();
  const [ensName, setEnsName] = useState(null);

  useEffect(() => {
    if (!provider || !address) { setEnsName(null); return; }
    let cancelled = false;
    provider.lookupAddress(address)
      .then((name) => { if (!cancelled) setEnsName(name || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [provider, address]);

  return ensName;
}
