# Sika

Self-hosted personal and business finance. Giving is a third money type, peer of income and expense. Isolation is by Workspace, not by person.

## Language

**Workspace**:
A set of books — personal or business. Every Transaction, Budget, Debt, and other money record belongs to one Workspace. That is the isolation identity of the books.
_Avoid_: account, ledger (as the isolation key), “the owner’s data”

**Owner**:
A role on a Workspace: created it, can invite, export, and destroy it. Not the identity of the rows inside it.
_Avoid_: user, account holder, ledger identity

**Member**:
A person with a role on a Workspace (owner, editor, or viewer). They act as themselves on those books, not as the Owner.
_Avoid_: user, actor, collaborator, guest

**Member setting**:
A preference or read-state that belongs to one Member in one Workspace (onboarding, notification read-state, push and email prefs). Isolated by Member and Workspace together, not by Workspace alone.
_Avoid_: user preference, account setting
