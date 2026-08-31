# Isolation of the books is the Workspace, not the Owner

Every money record still has a `user_id` column, so a later reader will assume that is how isolation works. It is not. A Workspace is the books; an Owner is a role on that Workspace; a Member acts as themselves. Reads and writes of Transactions, Budgets, Debts, and the rest of the books filter by `workspace_id` only. The leftover `user_id` is still written as the Owner’s id on create so existing rows and new rows look the same, but it is not an isolation key and it is not “who recorded this.”

We considered keeping dual-key filters (Owner + Workspace) and remapping every Member to the Owner at the HTTP adapter. That made a Member who holds one of the Owner’s Workspaces able to load or mutate a row in another of them with a guessed id. We also considered a new Workspace-access module; once membership stays at the HTTP adapter, that module would only thread two strings through and fail the deletion test.
