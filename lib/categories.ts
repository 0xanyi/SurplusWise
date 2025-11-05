// Default categories for expenses and givings
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', color: '#ef4444', icon: 'utensils' },
  { name: 'Transportation', color: '#3b82f6', icon: 'car' },
  { name: 'Shopping', color: '#8b5cf6', icon: 'shopping-bag' },
  { name: 'Bills & Utilities', color: '#f59e0b', icon: 'file-text' },
  { name: 'Healthcare', color: '#10b981', icon: 'heart' },
  { name: 'Entertainment', color: '#ec4899', icon: 'music' },
  { name: 'Housing', color: '#6366f1', icon: 'home' },
  { name: 'Personal Care', color: '#14b8a6', icon: 'user' },
  { name: 'Education', color: '#f97316', icon: 'book' },
  { name: 'Other', color: '#6b7280', icon: 'more-horizontal' }
];

export const DEFAULT_GIVING_CATEGORIES = [
  { name: 'Tithe', color: '#22c55e', icon: 'church' },
  { name: 'Offering', color: '#3b82f6', icon: 'gift' },
  { name: 'Partnership', color: '#8b5cf6', icon: 'handshake' },
  { name: 'Missions', color: '#f59e0b', icon: 'globe' },
  { name: 'Building Fund', color: '#10b981', icon: 'building' },
  { name: 'Special Projects', color: '#ec4899', icon: 'star' },
  { name: 'Charity', color: '#06b6d4', icon: 'heart-handshake' },
  { name: 'Other', color: '#6b7280', icon: 'more-horizontal' }
];

export type CategoryType = 'expense' | 'giving';

export interface Category {
  id?: string;
  user_id?: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  is_default?: boolean;
  created_at?: string;
}
