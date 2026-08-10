import { useState, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import nftData from '../contracts/MeetingNFT.json';
import { useWallet } from '../context/WalletContext';

export function useMeetingNFT() {
  const { signer } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState(null);

  const contract = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(nftData.address, nftData.abi, signer);
  }, [signer]);

  const mintReceipt = useCallback(async (meetingId, ipfsCid) => {
    if (!contract) { setMintError('Wallet not connected.'); return null; }
    if (!ipfsCid)  { setMintError('No IPFS CID — skipping NFT mint.'); return null; }
    setIsMinting(true); setMintError(null);
    try {
      const tx = await contract.mint(meetingId, ipfsCid);
      const receipt = await tx.wait(1);
      const event = receipt.logs
        .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === 'ReceiptMinted');
      return { tokenId: event ? Number(event.args.tokenId) : null, txHash: receipt.hash };
    } catch (err) {
      setMintError(err.reason || err.shortMessage || err.message || 'Mint failed');
      return null;
    } finally { setIsMinting(false); }
  }, [contract]);

  return { mintReceipt, isMinting, mintError };
}
