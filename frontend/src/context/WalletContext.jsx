import { createContext, useContext } from 'react';

const AMOY_CHAIN_ID = 80002;

const walletDisabledValue = {
  account: null,
  chainId: AMOY_CHAIN_ID,
  balance: '',
  provider: null,
  signer: null,
  isConnecting: false,
  connectError: null,
  isReady: false,
  userInfo: null,
  connectorName: null,
  login: async () => null,
  logout: async () => {},
  signMessage: async () => '',
};

const WalletContext = createContext(walletDisabledValue);

export function WalletProvider({ children }) {
  return (
    <WalletContext.Provider value={walletDisabledValue}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  return ctx || walletDisabledValue;
}

export default WalletContext;
