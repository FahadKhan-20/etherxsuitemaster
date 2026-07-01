import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider, JsonRpcProvider, Wallet, ethers, formatEther } from 'ethers';
import { getStoredUser } from '../utils/auth';

const AMOY_RPC = import.meta.env.VITE_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';
const AMOY_CHAIN_ID = 80002;
const WALLET_KEY = 'etherx_wallet';

function derivePassword(userId) {
  return ethers.id(userId + 'etherx');
}

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount]           = useState(null);
  const [chainId, setChainId]           = useState(null);
  const [balance, setBalance]           = useState('');
  const [provider, setProvider]         = useState(null);
  const [signer, setSigner]             = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [walletSource, setWalletSource] = useState(null);
  const [isReady, setIsReady]           = useState(false);
  const initialized = useRef(false);

  const amoyProvider = useMemo(() => new JsonRpcProvider(AMOY_RPC), []);

  const refreshBalance = useCallback(async (ethProvider, addr) => {
    try {
      const raw = await ethProvider.getBalance(addr);
      setBalance(parseFloat(formatEther(raw)).toFixed(3));
    } catch {
      setBalance('—');
    }
  }, []);

  const initWallet = useCallback(async () => {
    const user = getStoredUser();
    if (!user?.id) return;
    if (initialized.current) return;
    initialized.current = true;

    setIsConnecting(true);
    setConnectError(null);
    try {
      const password = derivePassword(user.id);
      const stored = localStorage.getItem(WALLET_KEY);

      let wallet;
      let isNew = false;

      if (stored) {
        try {
          wallet = await Wallet.fromEncryptedJson(stored, password);
        } catch {
          localStorage.removeItem(WALLET_KEY);
          wallet = Wallet.createRandom();
          isNew = true;
        }
      } else {
        wallet = Wallet.createRandom();
        isNew = true;
      }

      if (isNew) {
        const encrypted = await wallet.encrypt(password);
        localStorage.setItem(WALLET_KEY, encrypted);
      }

      const connectedWallet = wallet.connect(amoyProvider);
      const address = await connectedWallet.getAddress();

      setProvider(amoyProvider);
      setSigner(connectedWallet);
      setAccount(address);
      setChainId(AMOY_CHAIN_ID);
      setWalletSource('embedded');
      setIsReady(true);

      await refreshBalance(amoyProvider, address);

    } catch (err) {
      setConnectError(err.message || 'Failed to initialize wallet');
      initialized.current = false;
    } finally {
      setIsConnecting(false);
    }
  }, [amoyProvider, refreshBalance]);

  useEffect(() => {
    initWallet();
  }, [initWallet]);

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) { setConnectError('MetaMask not detected.'); return; }
    setIsConnecting(true);
    setConnectError(null);
    try {
      const ethProvider = new BrowserProvider(window.ethereum);
      await ethProvider.send('eth_requestAccounts', []);
      try {
        await ethProvider.send('wallet_switchEthereumChain', [{ chainId: '0x13882' }]);
      } catch (switchErr) {
        if ((switchErr.code ?? switchErr.error?.code) === 4902) {
          await ethProvider.send('wallet_addEthereumChain', [{
            chainId: '0x13882',
            chainName: 'Polygon Amoy',
            rpcUrls: [AMOY_RPC],
            nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          }]);
          await ethProvider.send('wallet_switchEthereumChain', [{ chainId: '0x13882' }]);
        } else throw switchErr;
      }
      const finalProvider = new BrowserProvider(window.ethereum);
      const ethSigner = await finalProvider.getSigner();
      const network = await finalProvider.getNetwork();
      setProvider(finalProvider);
      setSigner(ethSigner);
      setAccount(await ethSigner.getAddress());
      setChainId(Number(network.chainId));
      setWalletSource('metamask');
      setIsReady(true);
      await refreshBalance(finalProvider, await ethSigner.getAddress());
    } catch (err) {
      const code = err.code ?? err.error?.code;
      setConnectError(
        code === 4001   ? 'Connection rejected.' :
        code === -32002 ? 'MetaMask popup already open.' :
        err?.shortMessage ?? err?.message ?? 'Connection failed'
      );
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setAccount(null); setChainId(null); setBalance('');
    setProvider(null); setSigner(null);
    setWalletSource(null); setIsReady(false);
    initialized.current = false;
  }, []);

  useEffect(() => {
    if (walletSource !== 'metamask' || !window.ethereum) return;
    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect();
      else { setAccount(accounts[0]); if (provider) refreshBalance(provider, accounts[0]); }
    };
    const onChainChanged = () => window.location.reload();
    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged', onChainChanged);
    };
  }, [walletSource, provider, disconnect, refreshBalance]);

  const value = useMemo(() => ({
    account, chainId, balance, provider, signer,
    isConnecting, connectError,
    walletSource, isReady,
    initWallet, connectMetaMask, disconnect,
    connect: connectMetaMask,
  }), [account, chainId, balance, provider, signer, isConnecting, connectError,
      walletSource, isReady, initWallet, connectMetaMask, disconnect]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
