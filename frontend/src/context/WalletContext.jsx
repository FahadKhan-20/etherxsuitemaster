import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { BrowserProvider, JsonRpcSigner, formatUnits, hexlify, toUtf8Bytes } from 'ethers';
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
import { useAccount, useBalance, useWalletClient } from 'wagmi';

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
            // NOTE: 'weibo' and 'farcaster' were in the original plan but
            // are not valid AUTH_CONNECTION_TYPEs in the installed SDK
            // (11.3.0) — farcaster support was removed entirely, and any
            // entry for it (even showOnModal: false) makes
            // Web3Auth.filterConnectors() throw a WalletInitializationError
            // during initConnectors(), which silently kills the whole AUTH
            // connector's init and leaves the modal permanently blank with
            // no visible error in the app's own console. Both omitted.
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
  const { userInfo, getUserInfo } = useWeb3AuthUser();
  const { getAuthTokenInfo } = useAuthTokenInfo();
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: balanceData } = useBalance({ address, query: { enabled: Boolean(address) } });

  const connectError = connectRawError?.message || null;

  // The Web3Auth Connection's own EIP-1193 provider, captured at login time so
  // signMessage() can personal_sign without depending on the wagmi bridge
  // being populated (same race we avoid for the address read in login()).
  const w3aProviderRef = useRef(null);

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

    // Read the freshly-connected address directly off the Connection object
    // connect() itself resolved, via its EIP-1193 `ethereumProvider`
    // (@web3auth/no-modal's `Connection` interface:
    // `{ ethereumProvider, solanaWallet, connectorName, connectorNamespace }`,
    // where `ethereumProvider: IProvider` exposes `.request()`).
    //
    // We deliberately do NOT read this via wagmi's `getConnection(wagmiConfig)`
    // store. That store is populated by `Web3AuthWagmiProvider`'s own
    // unawaited `useEffect` (see @web3auth/no-modal/react/wagmi's
    // provider.js), which — on a *later* render commit, after this effect
    // notices `connection` changed — calls `connector.getChainId()` then
    // `connector.getAccounts()` (which itself just calls
    // `ethereumProvider.request({ method: 'eth_accounts' })`, the same call
    // made below) before finally calling `wagmiConfig.setState(...)`.
    // login() never awaits that effect, so there is no happens-before
    // relationship between it completing and a read of the wagmi store —
    // on the very first connect in a session the store can still be empty.
    // Calling eth_accounts directly on the Connection's own provider gets
    // the same data without depending on that effect's timing at all.
    w3aProviderRef.current = connection.ethereumProvider || null;
    const accounts = await connection.ethereumProvider?.request({ method: 'eth_accounts' });
    const connectedAddress = Array.isArray(accounts) ? accounts[0] : undefined;

    if (!idToken || !connectedAddress) return null;

    // connectorName (e.g. 'auth' for every social/email login, or an
    // external-wallet connector name like 'metamask') is too coarse to
    // distinguish *which* social/email method was used — the SDK's AUTH
    // connector reports the literal string 'auth' for all of google /
    // email_passwordless / discord alike. The sub-method instead lives on
    // AuthUserInfo.authConnection (see @web3auth/auth's UserInfo/AuthUserInfo
    // types, and AUTH_CONNECTION in @toruslabs/customauth's enums, whose
    // values are exactly 'google' / 'email_passwordless' / 'discord' / etc.
    // — a 1:1 match with our authProvider enum). External-wallet connectors
    // never go through the AUTH connector, so their getUserInfo() resolves
    // to `{}` (no authConnection field at all) — Login.jsx's mapping falls
    // back to 'wallet' in that case.
    //
    // We fetch it via the hook's getUserInfo() function (which calls
    // web3Auth.getUserInfo() directly) rather than reading the hook's own
    // `userInfo` state, for the same reason `connectedAddress` above isn't
    // read from the wagmi store: that state is populated by a useEffect
    // keyed on `isConnected` that this callback never awaits, so there's no
    // happens-before guarantee it reflects *this* login by the time we get
    // here.
    let authConnection;
    try {
      const freshUserInfo = await getUserInfo();
      authConnection = freshUserInfo?.authConnection;
    } catch {
      // External-wallet connectors and any other edge case that can't
      // resolve user info — leave authConnection undefined so Login.jsx's
      // mapping falls back to 'wallet'.
      authConnection = undefined;
    }

    return {
      idToken,
      walletAddress: connectedAddress,
      connectorName: connection.connectorName,
      authConnection,
    };
  }, [connect, getAuthTokenInfo, getUserInfo]);

  const logout = useCallback(async () => {
    await disconnect();
    w3aProviderRef.current = null;
  }, [disconnect]);

  // Sign a message (the backend's login nonce) with the Web3Auth-embedded
  // wallet via personal_sign. Uses the provider captured at login so it works
  // race-free right after login() resolves. Returns the 0x signature.
  const signMessage = useCallback(async (message, addressForSigning) => {
    const provider = w3aProviderRef.current;
    if (!provider) throw new Error('Wallet provider not ready — please sign in again.');
    const addr = addressForSigning || address;
    return provider.request({
      method: 'personal_sign',
      params: [hexlify(toUtf8Bytes(message)), addr],
    });
  }, [address]);

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
    signMessage,
  }), [address, chainId, balanceData, provider, signer, isConnecting, connectError, isConnected, userInfo, connectorName, login, logout, signMessage]);

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
