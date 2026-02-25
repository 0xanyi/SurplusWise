# New Features Guide - v0.10.0

Welcome to SurplusWise v0.10.0! The biggest addition in this release is **Finance Workspaces** — switch between Personal and Business contexts with all features available in both.

## 🏢 Finance Workspaces (New in v0.10.0)

### What Are Workspaces?
Workspaces let you keep your personal and business finances completely separate. Every feature — transactions, budgets, categories, outgoings, debts, loans, investments, and analytics — is scoped to the active workspace.

### How to Use
1. **Switch workspaces**: Click the workspace switcher in the navigation bar (between the logo and nav links)
2. **Create a new workspace**: Click "New workspace" at the bottom of the switcher dropdown
3. **Choose a type**: Select Personal or Business
4. **All data is separate**: When you switch workspaces, all dashboards, lists, and charts show only that workspace's data

### Key Details
- A default **Personal** workspace is created automatically for every user
- All existing data is automatically assigned to the Personal workspace
- You can create as many workspaces as you need
- The active workspace is remembered between sessions
- Workspace type (Personal/Business) is shown as a label in the switcher

### For Developers
The workspace system works via:
- **`x-workspace-id` header**: Sent automatically with every API request from the frontend
- **`requireAuthWithWorkspace()`**: Server helper that resolves both userId and workspaceId
- **`WorkspaceProvider` context**: Wraps the dashboard, provides `useWorkspace()` hook
- **`workspace-changed` event**: All `useApiQuery` hooks listen for this and auto-refresh
- **localStorage**: Active workspace ID persisted under `activeWorkspaceId` key

---

## Previous Features (v0.8.1)

## 🎹 Keyboard Shortcuts

Speed up your workflow with these keyboard shortcuts:

### Navigation
- **Ctrl + D** - Jump to Dashboard
- **Ctrl + T** - Go to Transactions page
- **Ctrl + R** - Go to Reports page  
- **Ctrl + ,** - Open Settings

### Help
- **Shift + ?** - Show keyboard shortcuts help dialog

### Tips
- Press `?` anytime to see all available shortcuts
- Shortcuts work on Mac (using Cmd) and Windows/Linux (using Ctrl)
- Dialog can be closed with `Esc` key

## 🔍 SEO & Sharing

Your SurplusWise instance is now optimized for search engines and social media:

- **Better Search Rankings**: Comprehensive meta tags help search engines understand your site
- **Social Media Previews**: When you share links, they now display rich previews with images
- **Sitemap**: Automatic sitemap generation at `/sitemap.xml`
- **Robots.txt**: Proper crawler configuration

## 🎨 Improved User Experience

### Custom 404 Page
Lost pages now show a helpful error page with:
- Clear navigation back to important sections
- Quick links to Dashboard, Transactions, Reports, Settings
- Consistent branding and design

### Toast Notifications with Undo
Delete something by accident? No problem!

```tsx
// Example usage in your code:
import { showUndoToast } from '@/lib/toast-helpers';

const handleDelete = async (id: string) => {
  const backup = item; // Keep a copy
  
  // Delete immediately
  await deleteItem(id);
  
  // Show undo toast
  showUndoToast({
    message: "Transaction deleted",
    onUndo: async () => {
      // Restore the item
      await restoreItem(backup);
    }
  });
};
```

### Version Information
- App version is now displayed in the footer
- Easy to reference when reporting issues

## ♿ Accessibility Improvements

### Focus Management
- Modal dialogs now trap focus properly
- Tab navigation cycles through dialog elements
- Focus returns to trigger element when dialog closes
- Better keyboard navigation throughout the app

### Benefits
- Fully keyboard navigable
- Screen reader friendly
- WCAG compliance improvements

## 🛠️ For Developers

### New Hooks

#### `useKeyboardShortcuts`
```tsx
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

useKeyboardShortcuts([
  {
    key: 'n',
    ctrl: true,
    action: () => setDialogOpen(true),
    description: 'New item'
  }
]);
```

#### `useFocusTrap`
```tsx
import { useFocusTrap } from '@/hooks/use-focus-trap';

function MyDialog({ open }) {
  const containerRef = useFocusTrap(open);
  
  return (
    <div ref={containerRef}>
      {/* Dialog content */}
    </div>
  );
}
```

#### `useFocusReturn`
```tsx
import { useFocusReturn } from '@/hooks/use-focus-trap';

function MyModal() {
  useFocusReturn(); // Automatically restores focus on unmount
  // ...
}
```

### Toast Helpers
```tsx
import { 
  showSuccessToast, 
  showErrorToast, 
  showUndoToast 
} from '@/lib/toast-helpers';

// Simple success
showSuccessToast("Settings saved!");

// Error with description
showErrorToast("Failed to save", "Please check your connection");

// With undo action
showUndoToast({
  message: "Item deleted",
  onUndo: () => restoreItem(),
  undoText: "Undo", // optional
  duration: 5000 // optional, default 5000ms
});
```

## 📱 What's Next?

We're working on exciting new features:

### Coming Soon
- **Testing Infrastructure** - Automated tests for reliability
- **Performance Optimizations** - Faster load times and smoother interactions
- **Enhanced Security** - Rate limiting and additional protections
- **Advanced Analytics** - Year-over-year comparisons and predictions

### On the Roadmap
- Import/Export enhancements
- Bulk operations
- Optimistic UI updates
- PWA offline support
- Mobile improvements

## 🐛 Found a Bug?

If you encounter any issues:
1. Check the version number in the footer (v0.8.1)
2. Try the keyboard shortcut `?` to ensure features are working
3. Report issues with version information included

## 💡 Tips & Tricks

1. **Master the Shortcuts**: Press `?` to memorize keyboard shortcuts
2. **Use Undo**: When deleting items, you have 5 seconds to undo
3. **Keyboard First**: Try navigating without your mouse using `Tab` and shortcuts
4. **Share Links**: Your dashboard links now look great when shared on social media

---

**Version**: 0.10.0
**Release Date**: February 25, 2026
**Type**: Major Feature (Finance Workspaces)

