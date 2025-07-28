import { useState, useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MessageCircle, Link2, ExternalLink, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { truncateAddress } from "@/lib/utils";
import { Separator } from "./ui/separator";
import { storeTelegramUser, removeTelegramUser, getAllTelegramUsers, TelegramUser } from "@/services/telegramService";

export default function TelegramConnectSettings() {
  const { user } = usePrivy();
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useLocalStorage<boolean>("zoracle-telegram-notifications", true);
  const [followedCreators, setFollowedCreators] = useLocalStorage<string[]>("zoracle-followed-creators", []);
  const [chatId, setChatId] = useState("");
  const [username, setUsername] = useState("");
  const [connectedTelegramUsers, setConnectedTelegramUsers] = useState<TelegramUser[]>([]);
  const [copied, setCopied] = useState(false);

  const botUsername = "usezoraclebot";
  const startCommand = "/start";
  const botUrl = `https://t.me/${botUsername}?start=${user?.wallet?.address || "connect"}`;
  
  // Load connected Telegram users
  useEffect(() => {
    const loadTelegramUsers = () => {
      const users = getAllTelegramUsers();
      setConnectedTelegramUsers(users);
    };
    
    loadTelegramUsers();
    // Refresh every 30 seconds to pick up new connections
    const interval = setInterval(loadTelegramUsers, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Connect Telegram user
  const handleConnectTelegram = () => {
    if (!chatId || !username) {
      toast.error("Please enter both Telegram chat ID and username");
      return;
    }

    storeTelegramUser(chatId, username, followedCreators);
    toast.success("Telegram account connected successfully");
    
    // Refresh the connected users list
    setConnectedTelegramUsers(getAllTelegramUsers());
    
    // Clear the form
    setChatId("");
    setUsername("");
  };

  // Disconnect Telegram user
  const handleDisconnectTelegram = (chatId: string) => {
    removeTelegramUser(chatId);
    toast.success("Telegram account disconnected");
    setConnectedTelegramUsers(getAllTelegramUsers());
  };

  // Copy bot start command
  const copyStartCommand = () => {
    navigator.clipboard.writeText(`/start ${user?.wallet?.address || ""}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Command copied to clipboard");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span>Telegram Notifications</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="telegram-notifications" className="text-sm">Enabled</Label>
            <Switch
              id="telegram-notifications"
              checked={telegramNotificationsEnabled}
              onCheckedChange={setTelegramNotificationsEnabled}
            />
          </div>
        </CardTitle>
        <CardDescription>
          Receive creator activity notifications directly in your Telegram
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Connection instructions */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Connect your Telegram</h3>
            <ol className="list-decimal list-inside text-sm space-y-2 text-muted-foreground ml-2">
              <li>Open our Zoracle bot in Telegram: <a href={botUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 inline-flex">
                @{botUsername} <ExternalLink className="h-3 w-3" />
              </a></li>
              <li>Start the bot and send this command:
                <div className="flex items-center mt-1 gap-2">
                  <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                    /start {user?.wallet?.address || "your_wallet_address"}
                  </code>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyStartCommand}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </li>
              <li>The bot will send you a confirmation message with your chat ID</li>
              <li>Enter your chat ID and Telegram username below</li>
            </ol>
          </div>

          <Separator />

          {/* Connect form */}
          <div>
            <h3 className="font-medium mb-3">Add Telegram Account</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="chat-id">Telegram Chat ID</Label>
                <Input 
                  id="chat-id" 
                  placeholder="e.g. 123456789" 
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="username">Telegram Username</Label>
                <Input 
                  id="username" 
                  placeholder="e.g. @username (without @)" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace('@', ''))}
                />
              </div>
            </div>
            <Button className="mt-4" onClick={handleConnectTelegram}>
              <Link2 className="mr-2 h-4 w-4" />
              Connect Telegram
            </Button>
          </div>

          <Separator />

          {/* Connected accounts */}
          <div>
            <h3 className="font-medium mb-3">Connected Accounts</h3>
            {connectedTelegramUsers.length === 0 ? (
              <div className="text-center p-6 text-muted-foreground text-sm">
                No Telegram accounts connected yet
              </div>
            ) : (
              <div className="space-y-2">
                {connectedTelegramUsers.map((telegramUser) => (
                  <div key={telegramUser.chatId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">@{telegramUser.username}</div>
                      <div className="text-xs text-muted-foreground">
                        Chat ID: {telegramUser.chatId}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Following {telegramUser.followedCreators.length} creators
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      onClick={() => handleDisconnectTelegram(telegramUser.chatId)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="border-t pt-4 text-xs text-muted-foreground">
        <p>Your Telegram chat ID is used solely for sending notifications about creator activity you've opted to follow.</p>
      </CardFooter>
    </Card>
  );
} 