import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, TrendingUp, Calendar } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Visual insights and detailed reports of your finances
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>Spending Trends</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                View your spending patterns over time with interactive charts
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <CardTitle>Category Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <PieChart className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                See how your money is distributed across categories
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Giving Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                Track your tithes, offerings, and charitable giving
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Custom Reports</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-2">
                Generate reports for custom date ranges and categories
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 3 Feature</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The Reports & Analytics page is planned for Phase 3. It will include:
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Interactive charts showing spending trends over time</li>
            <li>Category breakdown with pie and bar charts</li>
            <li>Monthly, quarterly, and yearly comparisons</li>
            <li>Giving analysis and tracking</li>
            <li>Export functionality (PDF, CSV)</li>
            <li>Custom date range filtering</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
