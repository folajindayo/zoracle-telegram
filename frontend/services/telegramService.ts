import { CreatorActivity } from "@/hooks/useAlchemyCopyTradeMonitor";

// Telegram bot token from BotFather
const TELEGRAM_BOT_TOKEN = '7589015271:AAFG5ZW-j_RItRAjrF8e2uhoE1XRxRmXsos';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Interface for telegram users
export interface TelegramUser {
  chatId: string;
  username: string;
  followedCreators: string[];
}

/**
 * Send a notification to a Telegram chat
 * @param chatId - The telegram chat ID to send the message to
 * @param message - The message text to send
 * @returns Promise<boolean> - Whether the message was sent successfully
 */
export async function sendTelegramMessage(chatId: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

/**
 * Format creator activity for Telegram notification
 * @param activity - The creator activity to format
 * @returns string - HTML-formatted message for Telegram
 */
export function formatTelegramNotification(activity: CreatorActivity): string {
  const truncatedFrom = activity.from.slice(0, 6) + '...' + activity.from.slice(-4);
  const truncatedAsset = activity.asset.length > 8 
    ? `${activity.asset.slice(0, 6)}...${activity.asset.slice(-4)}` 
    : activity.asset;
  
  return `
🚨 <b>Creator Activity Alert</b>

Creator <code>${truncatedFrom}</code> has interacted with token <code>${truncatedAsset}</code>

<b>Transaction:</b> <a href="https://basescan.org/tx/${activity.hash}">View on BaseScan</a>
<b>Token:</b> <a href="https://zoracle.io/token/${activity.asset}">View on Zoracle</a>

<i>This alert is powered by Zoracle Creator Monitoring</i>
`;
}

/**
 * Store a Telegram chat ID with associated creator addresses to monitor
 * @param chatId - The Telegram chat ID
 * @param username - The Telegram username
 * @param creatorAddresses - Array of creator addresses to follow
 */
export function storeTelegramUser(chatId: string, username: string, creatorAddresses: string[] = []): void {
  try {
    // Get existing users
    const storedUsersJson = localStorage.getItem('zoracle-telegram-users');
    const users: TelegramUser[] = storedUsersJson ? JSON.parse(storedUsersJson) : [];
    
    // Check if user already exists
    const existingUserIndex = users.findIndex(user => user.chatId === chatId);
    
    if (existingUserIndex >= 0) {
      // Update existing user
      users[existingUserIndex] = {
        ...users[existingUserIndex],
        username,
        followedCreators: [...new Set([...users[existingUserIndex].followedCreators, ...creatorAddresses])],
      };
    } else {
      // Add new user
      users.push({
        chatId,
        username,
        followedCreators: creatorAddresses,
      });
    }
    
    // Save updated users
    localStorage.setItem('zoracle-telegram-users', JSON.stringify(users));
  } catch (error) {
    console.error('Error storing Telegram user:', error);
  }
}

/**
 * Get all Telegram users who follow a specific creator
 * @param creatorAddress - The creator address to check
 * @returns TelegramUser[] - Array of Telegram users following the creator
 */
export function getTelegramUsersForCreator(creatorAddress: string): TelegramUser[] {
  try {
    const storedUsersJson = localStorage.getItem('zoracle-telegram-users');
    if (!storedUsersJson) return [];
    
    const users: TelegramUser[] = JSON.parse(storedUsersJson);
    return users.filter(user => 
      user.followedCreators.some(addr => addr.toLowerCase() === creatorAddress.toLowerCase())
    );
  } catch (error) {
    console.error('Error getting Telegram users for creator:', error);
    return [];
  }
}

/**
 * Get all stored Telegram users
 * @returns TelegramUser[] - Array of all Telegram users
 */
export function getAllTelegramUsers(): TelegramUser[] {
  try {
    const storedUsersJson = localStorage.getItem('zoracle-telegram-users');
    return storedUsersJson ? JSON.parse(storedUsersJson) : [];
  } catch (error) {
    console.error('Error getting all Telegram users:', error);
    return [];
  }
}

/**
 * Remove a Telegram user
 * @param chatId - The Telegram chat ID to remove
 */
export function removeTelegramUser(chatId: string): void {
  try {
    const storedUsersJson = localStorage.getItem('zoracle-telegram-users');
    if (!storedUsersJson) return;
    
    const users: TelegramUser[] = JSON.parse(storedUsersJson);
    const updatedUsers = users.filter(user => user.chatId !== chatId);
    
    localStorage.setItem('zoracle-telegram-users', JSON.stringify(updatedUsers));
  } catch (error) {
    console.error('Error removing Telegram user:', error);
  }
} 