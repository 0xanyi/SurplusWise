# Sika Improvements Roadmap

This document tracks implemented improvements and future enhancements for the Sika application.

## ✅ Recently Implemented (v0.10.0 - Feb 25, 2026)

### Finance Workspaces

#### Personal & Business Workspace Support
- ✅ New `workspaces` table with personal/business type enum
- ✅ `workspaceId` column added to all domain tables
- ✅ All service functions and API routes now workspace-aware
- ✅ Workspace switcher dropdown in dashboard navigation
- ✅ `WorkspaceProvider` React context with localStorage persistence
- ✅ `apiFetch` auto-includes workspace header on every request
- ✅ All data queries re-fetch automatically when workspace changes
- ✅ SQL migration with automatic backfill for existing data
- ✅ `/api/workspaces` CRUD endpoints

**Impact**: Users can now separate personal and business finances while using all existing features in both contexts.

## ✅ Previously Implemented (v0.8.1 - Feb 2, 2026)

### Quick Wins Completed

#### 1. SEO & Social Media Optimization
- ✅ Comprehensive meta tags (title templates, descriptions, keywords)
- ✅ OpenGraph tags for social media sharing
- ✅ Twitter Card configuration
- ✅ Structured metadata with proper hierarchy
- ✅ Icons configuration (favicon, app icons, Apple touch icon)
- ✅ Robots.txt with proper crawling rules
- ✅ Dynamic sitemap.xml generation
- ✅ Search engine verification ready

**Impact**: Better search engine visibility and professional social media previews

#### 2. Custom 404 Page
- ✅ Beautiful branded 404 error page
- ✅ Helpful navigation links
- ✅ Consistent design with app theme
- ✅ Quick access to main sections

**Impact**: Better user experience when encountering broken links

#### 3. Keyboard Shortcuts System
- ✅ Global keyboard navigation (`Ctrl+D`, `Ctrl+T`, `Ctrl+R`, `Ctrl+,`)
- ✅ Keyboard shortcuts help dialog (`?` key)
- ✅ Custom hook for keyboard shortcuts (`use-keyboard-shortcuts`)
- ✅ Visual shortcut reference dialog

**Impact**: Power users can navigate faster, improved accessibility

#### 4. Version Number Display
- ✅ Version displayed in footer (v0.8.1)
- ✅ Synced with package.json

**Impact**: Better transparency and easier debugging

#### 5. Accessibility Enhancements
- ✅ Focus trap hook for modal dialogs (`use-focus-trap`)
- ✅ Focus return functionality
- ✅ Better keyboard navigation in dialogs
- ✅ Tab cycling in modals

**Impact**: WCAG compliance improvements, better keyboard accessibility

#### 6. Toast Undo Functionality
- ✅ Toast helper utilities (`toast-helpers.ts`)
- ✅ Undo action support in toasts
- ✅ Success/Error toast helpers
- ✅ Configurable duration

**Impact**: Better UX for reversible actions, reduced accidental deletions

## 🚀 High Priority - Next Sprint

### Testing Infrastructure
- [ ] Set up Vitest for unit tests
- [ ] Add tests for utility functions
- [ ] Integration tests for Convex functions
- [ ] E2E tests with Playwright
- [ ] CI/CD pipeline setup

**Estimated Time**: 2-3 days
**Impact**: Code quality, bug prevention, confidence in deployments

### Error Handling & Monitoring
- [ ] Sentry integration for error tracking
- [ ] Better error boundaries at route level
- [ ] Structured logging
- [ ] Performance monitoring
- [ ] User session replay

**Estimated Time**: 1 day
**Impact**: Faster bug detection and resolution

### Performance Optimizations
- [ ] Virtual scrolling for transaction lists
- [ ] Pagination for large datasets
- [ ] Bundle size optimization (code splitting)
- [ ] Image optimization for receipts
- [ ] React Server Components for static content

**Estimated Time**: 2 days
**Impact**: Faster load times, better mobile experience

### Security Hardening
- [ ] Rate limiting on API routes
- [ ] CSRF protection
- [ ] Input sanitization library
- [ ] Content Security Policy headers
- [ ] File upload security validation

**Estimated Time**: 1-2 days
**Impact**: Protection against common attacks

## 📊 Medium Priority - Backlog

### UX Enhancements
- [ ] Optimistic UI updates
- [ ] Bulk operations (multi-select)
- [ ] Undo/redo for deletions
- [ ] Improved empty states
- [ ] Onboarding tour for new users
- [ ] Loading skeletons consistency

**Estimated Time**: 3-4 days
**Impact**: More polished user experience

### Data Management
- [ ] Import transactions from CSV/Excel
- [ ] Scheduled auto-export
- [ ] Backup/restore functionality
- [ ] Multiple export formats (Excel, JSON)
- [ ] Data archiving

**Estimated Time**: 2-3 days
**Impact**: User data control and portability

### Analytics Improvements
- [ ] Year-over-year comparisons
- [ ] Spending predictions (simple ML)
- [ ] Goal tracking
- [ ] Budget alerts
- [ ] Custom report builder
- [ ] More chart types (area, bar charts)

**Estimated Time**: 4-5 days
**Impact**: Better financial insights

### Mobile Experience
- [ ] PWA offline capabilities
- [ ] Touch gestures (swipe to delete)
- [ ] Mobile-optimized layouts
- [ ] Native share API
- [ ] Direct camera access for receipts
- [ ] Install prompts

**Estimated Time**: 3-4 days
**Impact**: Better mobile user experience

## 💡 Low Priority - Future Consideration

### Advanced Features
- [ ] Multi-currency support
- [ ] Recurring transactions
- [ ] Split transactions
- [ ] Tags/labels system
- [ ] Multiple attachments per transaction
- [ ] Bank integration (Plaid)
- ✅ Investment tracking (implemented)
- ✅ Bill reminders / recurring outgoings (implemented)

**Estimated Time**: 2-3 weeks
**Impact**: Feature completeness, competitive advantage

### Collaboration
- ✅ Multiple workspaces (personal/business) — implemented
- [ ] Shared budgets (family/couples)
- [ ] Permission levels
- [ ] Activity log/audit trail
- [ ] Transaction comments
- [ ] Multi-user households

**Estimated Time**: 2 weeks
**Impact**: Expands target market

### UI/UX Polish
- [ ] Micro-animations
- [ ] Consistent skeleton loaders
- [ ] Additional chart types
- [ ] Custom color themes
- [ ] WCAG 2.1 AA audit
- [ ] Component Storybook

**Estimated Time**: 1-2 weeks
**Impact**: Premium feel, better accessibility

## 📈 Metrics to Track

### Performance
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Bundle size < 200KB

### User Experience
- [ ] Task completion rate > 95%
- [ ] User retention (30-day) > 70%
- [ ] Average session duration
- [ ] Feature adoption rates

### Quality
- [ ] Test coverage > 80%
- [ ] Zero critical bugs in production
- [ ] Accessibility score (WCAG AA)
- [ ] Error rate < 0.1%

## 🛠 Technical Debt

### Code Quality
- [ ] Enable TypeScript strict mode
- [ ] Add JSDoc comments to public APIs
- [ ] Centralize API error handling
- [ ] Extract magic numbers to constants
- [ ] Component documentation

### Developer Experience
- [ ] Pre-commit hooks (Husky + lint-staged)
- [ ] Component Storybook
- [ ] Development guidelines document
- [ ] API documentation (OpenAPI)
- [ ] Contributing guide

## 📝 Notes

### Quick Win Priorities (1-2 hours each)
1. ✅ SEO meta tags
2. ✅ 404 page
3. ✅ Keyboard shortcuts
4. ✅ Version number
5. ✅ Focus management
6. ✅ Undo toasts
7. ✅ Sitemap
8. [ ] Loading skeletons consistency
9. [ ] Transaction notes preview on hover
10. [ ] Toast action buttons

### Dependencies
- Testing setup blocks integration tests
- Bank integration requires legal review
- Multi-user features need subscription model

### Resources Needed
- Design review for advanced features
- Security audit before production launch
- Performance testing on various devices
- User testing for onboarding flow

---

**Last Updated**: February 25, 2026
**Current Version**: 0.10.0
**Next Milestone**: Testing Infrastructure & Security
