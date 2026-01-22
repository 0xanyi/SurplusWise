import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bell, Palette, Globe, Shield, Database, Target } from "lucide-react";
import { CategoryManagement } from "@/components/dashboard/category-management";
import { BudgetManagement } from "@/components/dashboard/budget-management";

function SettingsCard({
  icon: Icon,
  title,
  children,
  comingSoon = false,
}: {
  icon: typeof User;
  title: string;
  children?: React.ReactNode;
  comingSoon?: boolean;
}) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {comingSoon ? (
          <div className="text-center py-10">
            <div className="size-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Icon className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Coming Soon</p>
            <p className="text-sm text-muted-foreground mt-1">{children}</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences and application settings
        </p>
      </div>

      <div className="grid gap-6">
        {/* Currency Settings */}
        <SettingsCard icon={Globe} title="Currency Settings">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Default Currency</p>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">£</span>
                </div>
                <div>
                  <p className="font-medium">British Pound (GBP)</p>
                  <p className="text-xs text-muted-foreground">
                    All amounts are displayed in pounds
                  </p>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground pt-2 border-t">
              <p className="font-medium text-foreground mb-2">Future Features:</p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary/60" />
                  Multi-currency support
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary/60" />
                  Automatic currency conversion
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary/60" />
                  Custom exchange rates
                </li>
              </ul>
            </div>
          </div>
        </SettingsCard>

        {/* Budget Management */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="size-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Budget Management</h2>
          </div>
          <BudgetManagement />
        </div>

        {/* Categories Management */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="size-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Categories Management</h2>
          </div>
          <CategoryManagement />
        </div>

        {/* Coming Soon Cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          <SettingsCard icon={User} title="Profile Settings" comingSoon>
            Update your profile information and preferences
          </SettingsCard>

          <SettingsCard icon={Bell} title="Notifications" comingSoon>
            Configure notification preferences and reminders
          </SettingsCard>

          <SettingsCard icon={Database} title="Data Management" comingSoon>
            Export, backup, and manage your financial data
          </SettingsCard>

          <SettingsCard icon={Shield} title="Security & Privacy" comingSoon>
            Manage security settings and privacy options
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
