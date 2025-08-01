/**
 * Utilities from ethers.js
 * This file re-exports functions from ethers to avoid directly importing from 'ethers/lib/utils'
 */
import { ethers } from 'ethers';

// Re-export formatEther, parseEther, formatUnits, and parseUnits
export const formatEther = ethers.utils.formatEther;
export const parseEther = ethers.utils.parseEther;
export const formatUnits = ethers.utils.formatUnits;
export const parseUnits = ethers.utils.parseUnits;

// Add any other ethers/lib/utils functions you need here