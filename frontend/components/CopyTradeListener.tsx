import { useState } from "react";
import { useAlchemyCopyTradeMonitor, type CreatorActivity } from "@/hooks/useAlchemyCopyTradeMonitor";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePrivy } from "@privy-io/react-auth";
import { truncateAddress } from "@/lib/utils";
import { Bell } from "lucide-react";
import { getTelegramUsersForCreator, sendTelegramMessage, formatTelegramNotification } from "@/services/telegramService";

// Common router addresses on Base
const COMMON_ROUTERS = [
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Uniswap v3 Router 2 on Base
  "0xba12222222228d8ba445958a75a0704d566bf2c8", // Balancer Vault
  "0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC", // Base Universal Router
];

export function CopyTradeListener() {
  const { user } = usePrivy();
  const [followedCreators, setFollowedCreators] = useLocalStorage<string[]>("zoracle-followed-creators", []);
  const [watchedAddresses, setWatchedAddresses] = useLocalStorage<string[]>("zoracle-watched-addresses", []);
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage<boolean>("zoracle-notifications-enabled", true);
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useLocalStorage<boolean>("zoracle-telegram-notifications", true);
  
  // Only enable monitoring if user is logged in and notifications are enabled
  const isEnabled = !!user && notificationsEnabled;

  // Show creator activity notification and send Telegram notification
  const handleCreatorActivity = async (activity: CreatorActivity) => {
    // Only show UI notifications if enabled
    if (notificationsEnabled) {
      const truncatedFrom = truncateAddress(activity.from);
      const truncatedAsset = activity.asset.length > 8 
        ? `${activity.asset.slice(0, 6)}...` 
        : activity.asset;
      
      toast.custom((id) => (
        <div className="p-4 bg-background border border-border rounded-lg shadow-lg flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-full">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                Creator Activity Detected
              </p>
              <p className="text-sm text-muted-foreground">
                {truncatedFrom} interacted with {truncatedAsset}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <a 
              href={`https://basescan.org/tx/${activity.hash}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary/80 underline"
            >
              View Transaction
            </a>
            <a
              href={`/token/${activity.asset}`}
              className="text-xs text-primary hover:text-primary/80 underline ml-2"
            >
              View Token
            </a>
          </div>
        </div>
      ), {
        duration: 6000,
        position: "top-right",
      });
    }
    
    // Send Telegram notifications if enabled
    if (telegramNotificationsEnabled) {
      try {
        // Get all Telegram users following this creator
        const telegramUsers = getTelegramUsersForCreator(activity.from);
        if (telegramUsers.length > 0) {
          // Format notification message
          const message = formatTelegramNotification(activity);
          
          // Send to each Telegram user
          await Promise.all(
            telegramUsers.map(user => 
              sendTelegramMessage(user.chatId, message)
            )
          );
          
          console.log(`Sent Telegram notifications to ${telegramUsers.length} users for creator ${activity.from}`);
        }
      } catch (error) {
        console.error("Error sending Telegram notifications:", error);
      }
    }
  };

  // Use the hook when component mounts if monitoring is enabled
  useAlchemyCopyTradeMonitor({
    creatorAddresses: isEnabled ? followedCreators : [],
    onActivityDetected: handleCreatorActivity,
    pollingInterval: 15000, // poll every 15 seconds
  });

  // Component doesn't render anything visible
  return null;
}

export default CopyTradeListener; 