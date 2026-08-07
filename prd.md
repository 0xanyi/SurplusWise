## Brief Description

Sika is a personal and business finance management app designed to help users track their expenditures, monitor monthly outgoings, and manage church givings such as tithes and partnerships. Powered by AI, it features receipt scanning for seamless transaction capture, automatic categorization, and insightful financial summaries by custom time periods. Users can switch between **Personal** and **Business** workspaces, keeping their finances cleanly separated while accessing all features in both contexts. The app empowers individuals to wisely steward their finances and giving, offering clear visibility and control over their financial flow.

***

## Product Requirements Document (PRD) for Sika

### 1. Purpose
- Provide users with an easy-to-use personal finance manager tailored for both general expenses and church-related giving.
- Simplify receipt and transaction management through AI-powered scanning and data extraction.
- Offer insightful reports to help users understand their spending and giving habits.

### 2. Primary Users
- Individuals managing personal budgets and church contributions.
- Church members who regularly tithe or give partnerships/donations.

### 3. Key Features (MVP)
- Manual entry of expenses and givings with customizable categories (e.g., tithes, partnership, general expenses).
- AI-enabled receipt capture via camera or image upload; automatic extraction of date, amount, vendor.
- Periodic summary dashboard (monthly, quarterly, custom date ranges) showing total expenses and giving breakdowns.
- Basic reporting and visual charts by category and period.
- User authentication and secure cloud or local data storage.
- Export data feature (CSV, PDF).

### 4. User Interface Requirements
- Simple, clean, and intuitive UI focusing on ease of input and navigation.
- Dashboard with key financial indicators at a glance.
- Forms for data entry and receipt upload.
- Reports presented visually with bar charts, pie charts, and tables.

### 5. Technical Requirements
- Mobile-first responsive design (potentially cross-platform mobile app).
- AI integration for OCR and receipt data extraction (consider 3rd party API for accurate OCR).
- Secure API backend with user authentication, data encryption, and backups.
- Scalable cloud database for storing transactions and user data.

### 6. Success Metrics
- Accurate capturing and categorizing of at least 90% of receipt data.
- User retention rate after 30 days above 70%.
- User satisfaction via feedback rating above 4/5.
- Monthly active users growth rate post-launch.

### 7. Implemented Enhancement: Finance Workspaces ✅
- Personal and Business workspace types for data isolation
- Workspace switcher in dashboard navigation
- All features (transactions, budgets, categories, outgoings, debts, loans, investments, analytics) scoped per workspace
- Existing data auto-migrated to a default "Personal" workspace
- Create additional workspaces as needed

### 8. Future Enhancements
- Integration with bank statements and payment platforms (Apple Pay, Google Pay).
- Advanced AI-driven spending insights and recommendations.
- Multi-user support for family or church group finance tracking.
- Push notifications for giving reminders or budgeting alerts.


## User Stories

- As a user, I want to manually add an expense or a giving entry with categories so I can track where my money goes.
- As a user, I want to scan or upload receipts so the app automatically extracts and categorizes expense data.
- As a user, I want to view a dashboard summary of my monthly and quarterly spendings and givings at a glance.
- As a user, I want to generate reports showing my total expenses and givings by category and time period to analyze my finances.
- As a user, I want a secure login system so my financial data is private and safe.
- As a user, I want to export my financial data into CSV or PDF for offline use or sharing.
- As a user, I want to set custom givings categories such as tithes, offerings, and partnerships to manage church donations distinctly.
- As a user, I want to switch between Personal and Business workspaces so I can keep my finances separate while using the same features in both.
- As a user, I want all my existing data to automatically belong to a "Personal" workspace so I don't lose anything when workspaces are introduced.
- As a user, I want to create new workspaces (Personal or Business type) so I can organise my finances however I need.

***

## Wireframe Outline

### 1. Login/Signup Screen
- Email and password fields
- Social login options (optional)
- Forgot password link

### 2. Dashboard Screen
- Summary cards for Total Expenses, Total Givings, Net Balance
- Period selector (month, quarter, custom range)
- Quick action buttons: Add Expense, Add Giving, Scan Receipt

### 3. Add Entry Screen
- Form with fields: Amount, Date, Category (Expense/Giving), Notes
- Save and Cancel buttons

### 4. Receipt Scanner Screen
- Camera access to scan receipt
- Thumbnail preview and extracted data fields for confirmation/editing
- Save button

### 5. Reports Screen
- Filters for date range and categories
- Visual charts: pie chart for category distribution, bar chart of expenses/givings over time
- Export button (CSV, PDF)

### 6. Settings Screen
- Manage categories (add, edit, delete)
- Account and security settings
- Data export options
