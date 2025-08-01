// src/hooks/useAnkrCopyTradeMonitor.ts
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ethers } from "ethers";

// ENV or config
const ANKR_ENDPOINT = import.meta.env.VITE_ANKR_ENDPOINT || 
  'https://rpc.ankr.com/base/b39a19f9ecf66252bf862fe6948021cd1586009ee97874655f46481cfbf3f129';
const BASE_NETWORK = 'base'; // Base mainnet

// Create provider
const provider = new ethers.providers.JsonRpcProvider(ANKR_ENDPOINT);

export interface CreatorActivity {
  from: string;
  to: string;
  asset: string;
  amount: string;
  hash: string;
  timestamp?: string;
}

/**
 * Hook to monitor creator activity for copy trading using Ankr RPC
 * Polls for new blocks and transactions to detect token activity
 */
export function useAnkrCopyTradeMonitor({
  creatorAddresses,
  onActivityDetected,
  pollingInterval = 15000,
}: {
  creatorAddresses: string[];
  onActivityDetected: (activity: CreatorActivity) => void;
  pollingInterval?: number;
}) {
  const lastCheckedBlock = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    if (!creatorAddresses.length) return;

    // Initialize by getting the latest block
    const initialize = async () => {
      try {
        const latestBlock = await provider.getBlockNumber();
        lastCheckedBlock.current = latestBlock - 20; // Start checking from 20 blocks ago
        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing block monitoring:", error);
        // Retry after a delay
        setTimeout(initialize, 5000);
      }
    };

    if (!isInitialized) {
      initialize();
    }

    const pollActivity = async () => {
      if (!isInitialized) return;
      
      try {
        const latestBlock = await provider.getBlockNumber();
        
        // Skip if no new blocks
        if (lastCheckedBlock.current === latestBlock) return;
        
        // Limit the number of blocks to process at once
        const fromBlock = Math.max(
          lastCheckedBlock.current ?? (latestBlock - 20), 
          latestBlock - 50
        );
        
        // Process blocks in batches to avoid rate limiting
        for (let blockNumber = fromBlock + 1; blockNumber <= latestBlock; blockNumber++) {
          try {
            const block = await provider.getBlock(blockNumber, true);
            if (!block || !block.transactions || block.transactions.length === 0) continue;

            // Filter transactions involving watched addresses
            for (const tx of block.transactions) {
              for (const creator of creatorAddresses) {
                if (tx.from?.toLowerCase() === creator.toLowerCase()) {
                  // Get transaction details
                  const txDetails = await provider.getTransaction(tx.hash);
                  if (!txDetails) continue;
                  
                  // Get receipt to check token transfers
                  const receipt = await provider.getTransactionReceipt(tx.hash);
                  if (!receipt) continue;
                  
                  // Extract basic activity data
                  const activity: CreatorActivity = {
                    from: tx.from || "",
                    to: tx.to || "",
                    asset: "ETH", // Default to ETH, will be updated for tokens
                    amount: ethers.utils.formatEther(tx.value),
                    hash: tx.hash,
                    timestamp: new Date(block.timestamp * 1000).toISOString(),
                  };
                  
                  // If this is a token transfer, try to identify the token
                  if (receipt.logs && receipt.logs.length > 0) {
                    // Check for Transfer event signature
                    const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
                    const transferLog = receipt.logs.find(log => 
                      log.topics[0] === transferTopic &&
                      log.topics.length >= 3
                    );
                    
                    if (transferLog) {
                      // Get token contract address
                      const tokenAddress = transferLog.address;
                      
                      try {
                        // Try to get token info
                        const tokenContract = new ethers.Contract(
                          tokenAddress,
                          [
                            "function symbol() view returns (string)",
                            "function decimals() view returns (uint8)",
                          ],
                          provider
                        );
                        
                        const symbol = await tokenContract.symbol();
                        const decimals = await tokenContract.decimals();
                        
                        // Parse value from the log
                        const data = transferLog.data;
                        const value = ethers.BigNumber.from(data);
                        
                        activity.asset = symbol;
                        activity.amount = ethers.utils.formatUnits(value, decimals);
                      } catch (err) {
                        console.warn("Could not get token info:", err);
                        // Keep ETH as default asset
                      }
                    }
                  }
                  
                  onActivityDetected(activity);
                }
              }
            }
          } catch (blockError) {
            console.error(`Error processing block ${blockNumber}:`, blockError);
            // Continue with next block
          }
        }
        
        lastCheckedBlock.current = latestBlock;
      } catch (err) {
        console.error("Error polling creator activity:", err);
      }
    };

    const interval = setInterval(pollActivity, pollingInterval);
    if (isInitialized) pollActivity(); // run immediately if initialized

    return () => clearInterval(interval);
  }, [creatorAddresses, pollingInterval, onActivityDetected, isInitialized]);
}

/**
 * Hook to track ERC20 token purchases (buys)
 * Detects when ETH is sent to DEX routers
 */
export function useAnkrTokenPurchaseMonitor({
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
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    if (!watchedAddresses.length) return;

    // Initialize by getting the latest block
    const initialize = async () => {
      try {
        const latestBlock = await provider.getBlockNumber();
        lastCheckedBlock.current = latestBlock - 20;
        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing block monitoring:", error);
        setTimeout(initialize, 5000);
      }
    };

    if (!isInitialized) {
      initialize();
    }

    const pollPurchases = async () => {
      if (!isInitialized) return;
      
      try {
        const latestBlock = await provider.getBlockNumber();
        
        if (lastCheckedBlock.current === latestBlock) return;
        
        const fromBlock = Math.max(
          lastCheckedBlock.current ?? (latestBlock - 20), 
          latestBlock - 50
        );
        
        for (let blockNumber = fromBlock + 1; blockNumber <= latestBlock; blockNumber++) {
          try {
            const block = await provider.getBlock(blockNumber, true);
            if (!block || !block.transactions || block.transactions.length === 0) continue;

            // Look for transactions from watched addresses to router addresses
            for (const tx of block.transactions) {
              if (watchedAddresses.some(addr => addr.toLowerCase() === tx.from?.toLowerCase()) &&
                  routerAddresses.some(router => router.toLowerCase() === tx.to?.toLowerCase())) {
                
                const purchase: CreatorActivity = {
                  from: tx.from || "",
                  to: tx.to || "",
                  asset: "ETH",
                  amount: ethers.utils.formatEther(tx.value),
                  hash: tx.hash,
                  timestamp: new Date(block.timestamp * 1000).toISOString(),
                };
                
                onPurchaseDetected(purchase);
                
                // Also check for token transfers in the same block from DEX to the user
                // This indicates which token they purchased
                try {
                  const receipt = await provider.getTransactionReceipt(tx.hash);
                  if (receipt?.logs) {
                    const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
                    const transfers = receipt.logs.filter(log => 
                      log.topics[0] === transferTopic &&
                      log.topics.length >= 3
                    );
                    
                    for (const transferLog of transfers) {
                      const toAddress = "0x" + transferLog.topics[2].slice(26);
                      
                      if (watchedAddresses.some(addr => 
                        addr.toLowerCase() === toAddress.toLowerCase())) {
                        
                        // This is a token transfer to our watched address
                        try {
                          const tokenContract = new ethers.Contract(
                            transferLog.address,
                            [
                              "function symbol() view returns (string)",
                              "function decimals() view returns (uint8)",
                            ],
                            provider
                          );
                          
                          const symbol = await tokenContract.symbol();
                          const decimals = await tokenContract.decimals();
                          const value = ethers.BigNumber.from(transferLog.data);
                          
                          // This is the token they purchased
                          const tokenPurchase: CreatorActivity = {
                            from: tx.to || "", // Router address
                            to: toAddress,
                            asset: symbol,
                            amount: ethers.utils.formatUnits(value, decimals),
                            hash: tx.hash,
                            timestamp: new Date(block.timestamp * 1000).toISOString(),
                          };
                          
                          onPurchaseDetected(tokenPurchase);
                        } catch (err) {
                          console.warn("Could not get token info:", err);
                        }
                      }
                    }
                  }
                } catch (receiptError) {
                  console.warn("Error getting receipt:", receiptError);
                }
              }
            }
          } catch (blockError) {
            console.error(`Error processing block ${blockNumber}:`, blockError);
          }
        }
        
        lastCheckedBlock.current = latestBlock;
      } catch (err) {
        console.error("Error polling token purchases:", err);
      }
    };

    const interval = setInterval(pollPurchases, pollingInterval);
    if (isInitialized) pollPurchases();

    return () => clearInterval(interval);
  }, [watchedAddresses, routerAddresses, pollingInterval, onPurchaseDetected, isInitialized]);
}