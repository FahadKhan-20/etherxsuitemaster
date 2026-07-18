import { createContext, useCallback, useContext, useMemo } from 'react';
import { BrowserProvider, JsonRpcSigner, formatUnits } from 'ethers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Web3AuthProvider,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useWeb3AuthUser,
  useAuthTokenInfo,
} from '@web3auth/modal/react';
import { WagmiProvider as Web3AuthWagmiProvider } from '@web3auth/modal/react/wagmi';
import { WEB3AUTH_NETWORK, WALLET_CONNECTORS } from '@web3auth/modal';
import { useAccount, useBalance, useConfig, useWalletClient } from 'wagmi';
import { getConnection } from 'wagmi/actions';

const AMOY_CHAIN_ID = 80002;

const web3AuthContextConfig = {
  web3AuthOptions: {
    clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID,
    web3AuthNetwork:
      import.meta.env.VITE_NETWORK === 'mainnet'
        ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
        : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    modalConfig: {
      connectors: {
        [WALLET_CONNECTORS.AUTH]: {
          showOnModal: true,
          loginMethods: {
            google: { showOnModal: true },
            email_passwordless: { showOnModal: true },
            discord: { showOnModal: true },
            facebook: { showOnModal: false },
            twitter: { showOnModal: false },
            reddit: { showOnModal: false },
            twitch: { showOnModal: false },
            apple: { showOnModal: false },
            line: { showOnModal: false },
            github: { showOnModal: false },
            kakao: { showOnModal: false },
            linkedin: { showOnModal: false },
            wechat: { showOnModal: false },
            farcaster: { showOnModal: false },
            // NOTE: 'weibo' was in the original plan but is not a valid
            // AUTH_CONNECTION_TYPE in the installed SDK (11.3.0) — omitted.
          },
        },
      },
      // Wallet-first login (MetaMask etc.) stays visible — only the AUTH
      // (social/email) connector's method list is restricted above.
    },
  },
};

const queryClient = new QueryClient();

// Converts wagmi's viem WalletClient into an ethers v6 JsonRpcSigner, so the
// rest of the app (useMeetingContract, useMeetingNFT, VerifiedChat) keeps
// using ethers exactly as it did with the old MetaMask/embedded-wallet flow.
function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient;
  const network = { chainId: chain.id, name: chain.name };
  const provider = new BrowserProvider(transport, network);
  return new JsonRpcSigner(provider, account.address);
}

const WalletContext = createContext(null);

function WalletBridge({ children }) {
  const { connect, isConnected, loading: isConnecting, connectorName, error: connectRawError } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { getAuthTokenInfo } = useAuthTokenInfo();
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: balanceData } = useBalance({ address, query: { enabled: Boolean(address) } });
  const wagmiConfig = useConfig();

  const connectError = connectRawError?.message || null;

  const provider = useMemo(() => {
    if (!walletClient) return null;
    return new BrowserProvider(walletClient.transport, { chainId: walletClient.chain.id, name: walletClient.chain.name });
  }, [walletClient]);

  const signer = useMemo(() => {
    if (!walletClient) return null;
    return walletClientToSigner(walletClient);
  }, [walletClient]);

  const login = useCallback(async () => {
    // connect() resolves to a Connection object (or null if the user cancels
    // the modal) that carries connectorName directly — reading it from the
    // resolved value (rather than the useWeb3AuthConnect() hook's state)
    // avoids a stale-closure read, since this callback's own closure was
    // captured on the render *before* the connection happened.
    const connection = await connect();
    if (!connection) return null;

    // getAuthTokenInfo() resolves the idToken string itself (not an
    // { idToken } wrapper — see @web3auth/no-modal/react's useAuthTokenInfo).
    const idToken = await getAuthTokenInfo();

    // Read the freshly-connected address directly from the wagmi config
    // store rather than the `address` destructured above, which is a
    // snapshot from the render that created this callback and would still
    // be null immediately after a first-time connect.
    const { address: connectedAddress } = getConnection(wagmiConfig);

    if (!idToken || !connectedAddress) return null;
    // connectorName carries which login method was used (e.g. 'google',
    // 'email_passwordless', 'discord', or an external-wallet connector name
    // like 'metamask') — Login.jsx maps it to authProvider's four valid
    // values before sending it to POST /api/auth/web3auth.
    return { idToken, walletAddress: connectedAddress, connectorName: connection.connectorName };
  }, [connect, getAuthTokenInfo, wagmiConfig]);

  const logout = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const value = useMemo(() => ({
    account: address || null,
    chainId: chainId || AMOY_CHAIN_ID,
    // wagmi v3's useBalance() data has no `.formatted` field (just
    // { decimals, symbol, value: bigint }) — format it via ethers.
    balance: balanceData ? formatUnits(balanceData.value, balanceData.decimals) : '',
    provider,
    signer,
    isConnecting,
    connectError,
    isReady: isConnected,
    userInfo: userInfo || null,
    connectorName,
    login,
    logout,
  }), [address, chainId, balanceData, provider, signer, isConnecting, connectError, isConnected, userInfo, connectorName, login, logout]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function WalletProvider({ children }) {
  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      <QueryClientProvider client={queryClient}>
        <Web3AuthWagmiProvider>
          <WalletBridge>{children}</WalletBridge>
        </Web3AuthWagmiProvider>
      </QueryClientProvider>
    </Web3AuthProvider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
