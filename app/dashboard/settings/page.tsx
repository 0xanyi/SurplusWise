import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bell, Palette, Globe, Shield, Database, Target } from "lucide-react";
import { CategoryManagement } from "@/components/dashboard/category-management";
import { BudgetManagement } from "@/components/dashboard/budget-management";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences and application settings
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>Currency Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Default Currency</p>
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted">
                  <span className="text-2xl">£</span>
                  <div>
                    <p className="font-medium">British Pound (GBP)</p>
                    <p className="text-xs text-muted-foreground">
                      All amounts are displayed in pounds
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Future Features:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Multi-currency support</li>
                  <li>Automatic currency conversion</li>
                  <li>Custom exchange rates</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Management - Now Active */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Budget Management</h2>
          </div>
          <BudgetManagement />
        </div>

        {/* Categories Management - Now Active */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Categories Management</h2>
          </div>
          <CategoryManagement />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                Update your profile information and preferences
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                Configure notification preferences and reminders
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>Data Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                Export, backup, and manage your financial data
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Security & Privacy</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                Manage security settings and privacy options
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
