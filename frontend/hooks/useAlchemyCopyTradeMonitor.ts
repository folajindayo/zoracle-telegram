// src/hooks/useAlchemyCopyTradeMonitor.ts
import { useEffect, useRef } from "react";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

// ENV or config
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || 'demo'; // Replace with your key
const BASE_NETWORK = Network.BASE_MAINNET; // or BASE_GOERLI for testing

// Alchemy SDK setup
const alchemy = new Alchemy({
  apiKey: ALCHEMY_API_KEY,
  network: BASE_NETWORK,
});

export interface CreatorActivity {
  from: string;
  to: string;
  asset: string;
  amount: string;
  hash: string;
  timestamp?: string;
}

/**
 * Hook to monitor creator activity for copy trading
 * Polls Alchemy API to detect new token mints or purchases by creators
 */
export function useAlchemyCopyTradeMonitor({
  creatorAddresses,
  onActivityDetected,
  pollingInterval = 15000,
}: {
  creatorAddresses: string[];
  onActivityDetected: (activity: CreatorActivity) => void;
  pollingInterval?: number;
}) {
  const lastCheckedBlock = useRef<number | null>(null);

  useEffect(() => {
    if (!creatorAddresses.length) return;

    const pollActivity = async () => {
      try {
        const latestBlock = await alchemy.core.getBlockNumber();

        // Start from recent blocks if first check, otherwise from last checked block
        const fromBlock = lastCheckedBlock.current ?? latestBlock - 20;

        for (const creator of creatorAddresses) {
          // Get ERC20 transfers from the creator
          const transfers = await alchemy.core.getAssetTransfers({
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${latestBlock.toString(16)}`,
            fromAddress: creator,
            category: [AssetTransfersCategory.ERC20],
            maxCount: 20,
          });

          for (const tx of transfers.transfers) {
            // Get the block timestamp if available
            let timestamp: string | undefined = undefined;
            try {
              if (tx.blockNum) {
                const blockData = await alchemy.core.getBlock(tx.blockNum);
                timestamp = new Date(Number(blockData.timestamp) * 1000).toISOString();
              }
            } catch (e) {
              console.error("Error fetching block timestamp:", e);
            }

            const activity: CreatorActivity = {
              from: tx.from || "",
              to: tx.to || "",
              asset: tx.asset || "",
              amount: tx.value?.toString() || "0",
              hash: tx.hash,
              timestamp,
            };

            onActivityDetected(activity);
          }
        }

        lastCheckedBlock.current = latestBlock;
      } catch (err) {
        console.error("Error polling creator activity:", err);
      }
    };

    const interval = setInterval(pollActivity, pollingInterval);
    pollActivity(); // run immediately

    return () => clearInterval(interval);
  }, [creatorAddresses, pollingInterval, onActivityDetected]);
}

/**
 * Hook to track ERC20 token purchases (buys)
 * Detects when ETH is sent to Uniswap or other DEX routers
 */
export function useAlchemyTokenPurchaseMonitor({
  watchedAddresses,
  routerAddresses,
  onPurchaseDetected,
  pollingInterval = 15000,
}: {
  watchedAddresses: string[];
  routerAddresses: string[];
  onPurchaseDetected: (purchase: CreatorActivity) => void;
  pollingInterval?: number;
}) {
  const lastCheckedBlock = useRef<number | null>(null);

  useEffect(() => {
    if (!watchedAddresses.length) return;

    const pollPurchases = async () => {
      try {
        const latestBlock = await alchemy.core.getBlockNumber();
        const fromBlock = lastCheckedBlock.current ?? latestBlock - 20;

        for (const address of watchedAddresses) {
          // Check ETH sent to routers (likely buys)
          for (const router of routerAddresses) {
            const ethTransfers = await alchemy.core.getAssetTransfers({
              fromBlock: `0x${fromBlock.toString(16)}`,
              toBlock: `0x${latestBlock.toString(16)}`,
              fromAddress: address,
              toAddress: router,
              category: [AssetTransfersCategory.EXTERNAL],
              maxCount: 10,
            });

            for (const tx of ethTransfers.transfers) {
              // Get the block timestamp if available
              let timestamp: string | undefined = undefined;
              try {
                if (tx.blockNum) {
                  const blockData = await alchemy.core.getBlock(tx.blockNum);
                  timestamp = new Date(Number(blockData.timestamp) * 1000).toISOString();
                }
              } catch (e) {
                console.error("Error fetching block timestamp:", e);
              }

              onPurchaseDetected({
                from: tx.from || "",
                to: tx.to || "",
                asset: "ETH",
                amount: tx.value?.toString() || "0",
                hash: tx.hash,
                timestamp,
              });
            }
          }

          // Check incoming ERC20 tokens (received from purchases)
          const tokenTransfers = await alchemy.core.getAssetTransfers({
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${latestBlock.toString(16)}`,
            toAddress: address,
            category: [AssetTransfersCategory.ERC20],
            maxCount: 10,
          });

          for (const tx of tokenTransfers.transfers) {
            // Get the block timestamp if available
            let timestamp: string | undefined = undefined;
            try {
              if (tx.blockNum) {
                const blockData = await alchemy.core.getBlock(tx.blockNum);
                timestamp = new Date(Number(blockData.timestamp) * 1000).toISOString();
              }
            } catch (e) {
              console.error("Error fetching block timestamp:", e);
            }

            onPurchaseDetected({
              from: tx.from || "",
              to: tx.to || "",
              asset: tx.asset || "",
              amount: tx.value?.toString() || "0",
              hash: tx.hash,
              timestamp,
            });
          }
        }

        lastCheckedBlock.current = latestBlock;
      } catch (err) {
        console.error("Error polling token purchases:", err);
      }
    };

    const interval = setInterval(pollPurchases, pollingInterval);
    pollPurchases(); // run immediately

    return () => clearInterval(interval);
  }, [watchedAddresses, routerAddresses, pollingInterval, onPurchaseDetected]);
} 