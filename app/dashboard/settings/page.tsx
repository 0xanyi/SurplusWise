import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bell, Palette, Globe, Shield, Database, Target, LayoutGrid } from "lucide-react";
import { CategoryManagement } from "@/components/dashboard/category-management";
import { BudgetManagement } from "@/components/dashboard/budget-management";

function SettingsCard({
  icon: Icon,
  title,
  children,
  comingSoon = false,
  className = "",
}: {
  icon: any;
  title: string;
  children?: React.ReactNode;
  comingSoon?: boolean;
  className?: string;
}) {
  return (
    <Card className={`border shadow-sm h-full ${className}`}>
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
          <div className="text-center py-8">
            <div className="size-10 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Coming Soon</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">{children}</p>
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
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences, budgets, and categories
        </p>
      </div>

      <div className="grid gap-8">
        {/* Core Management Sections */}
        <div className="space-y-8">
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Target className="size-5 text-primary" />
                    <h2 className="text-xl font-semibold tracking-tight">Budget Management</h2>
                </div>
                <BudgetManagement />
            </section>

            <section>
                <div className="flex items-center gap-2 mb-4">
                    <LayoutGrid className="size-5 text-primary" />
                    <h2 className="text-xl font-semibold tracking-tight">Category Management</h2>
                </div>
                <CategoryManagement />
            </section>
        </div>

        {/* Other Settings Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Currency Settings */}
            <SettingsCard icon={Globe} title="Currency Settings">
            <div className="space-y-4">
                <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Default Currency</p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
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
                <div className="text-sm text-muted-foreground pt-4 border-t border-border/50">
                <p className="font-medium text-foreground mb-2 text-xs uppercase tracking-wider">Coming Soon</p>
                <ul className="space-y-2 text-xs">
                    <li className="flex items-center gap-2">
                    <div className="size-1 rounded-full bg-primary/60" />
                    Multi-currency support
                    </li>
                    <li className="flex items-center gap-2">
                    <div className="size-1 rounded-full bg-primary/60" />
                    Automatic currency conversion
                    </li>
                </ul>
                </div>
            </div>
            </SettingsCard>

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

            <SettingsCard icon={Palette} title="Appearance" comingSoon>
                Customize the look and feel of your dashboard
            </SettingsCard>
        </div>
      </div>
    </div>
  );
}
