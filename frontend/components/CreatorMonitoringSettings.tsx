import { useState, useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Bell, BellOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { truncateAddress } from "@/lib/utils";
import { Separator } from "./ui/separator";

export default function CreatorMonitoringSettings() {
  const [followedCreators, setFollowedCreators] = useLocalStorage<string[]>("zoracle-followed-creators", []);
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage<boolean>("zoracle-notifications-enabled", true);
  const [newAddress, setNewAddress] = useState("");
  const [error, setError] = useState("");

  // Validate Ethereum address
  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Add new creator address to follow
  const handleAddCreator = () => {
    const trimmedAddress = newAddress.trim();

    if (!validateAddress(trimmedAddress)) {
      setError("Please enter a valid Ethereum address");
      return;
    }

    if (followedCreators.includes(trimmedAddress.toLowerCase())) {
      setError("This creator is already being monitored");
      return;
    }

    setFollowedCreators([...followedCreators, trimmedAddress.toLowerCase()]);
    setNewAddress("");
    setError("");
    toast.success("Creator added to monitoring list");
  };

  // Remove creator from following list
  const handleRemoveCreator = (address: string) => {
    setFollowedCreators(followedCreators.filter(a => a !== address));
    toast.success("Creator removed from monitoring list");
  };

  // Toggle notifications
  const handleToggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    toast.success(`Notifications ${!notificationsEnabled ? 'enabled' : 'disabled'}`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <span>Creator Activity Monitoring</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="notifications" className="text-sm">Notifications</Label>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={handleToggleNotifications}
            />
          </div>
        </CardTitle>
        <CardDescription>
          Follow creator wallet addresses to get notified when they mint or buy tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add new creator form */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter creator wallet address (0x...)"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className={error ? "border-red-500" : ""}
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <Button onClick={handleAddCreator} size="sm">
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Creator
            </Button>
          </div>

          <Separator />

          {/* List of followed creators */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              Monitored Creators ({followedCreators.length})
            </h3>
            {followedCreators.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No creator addresses are being monitored
              </div>
            ) : (
              <ul className="space-y-2">
                {followedCreators.map((address) => (
                  <li 
                    key={address} 
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {truncateAddress(address)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCreator(address)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Explanation */}
          <div className="mt-6 text-sm text-muted-foreground border-t pt-4">
            <p className="mb-2">
              <strong>How it works:</strong> When a monitored creator mints new tokens or interacts with existing tokens, you'll receive a notification.
            </p>
            <p>
              This feature uses the Alchemy API to track on-chain activity every 15 seconds.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 