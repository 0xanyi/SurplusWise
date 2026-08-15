"use client";

import { useState } from "react";
import { Copy, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/contexts/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, useApiMutation, useApiQuery } from "@/hooks/use-api";

type Role = "owner" | "editor" | "viewer";
type Member = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
};
type Invitation = {
  id: string;
  email: string;
  role: "editor" | "viewer";
  expiresAt: string;
  createdAt: string;
};
type MembersResponse = { members: Member[]; invitations: Invitation[] };

export function WorkspaceMembersSettings() {
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const isOwner = activeWorkspace?.role === "owner";
  const { data, loading, error, refresh } = useApiQuery<MembersResponse>(
    isOwner ? "/api/workspace-members" : null,
  );
  const invite = useApiMutation<
    { email: string; role: "editor" | "viewer" },
    { inviteUrl: string }
  >("/api/workspace-members");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<
    { type: "member" | "invitation"; id: string; label: string } | null
  >(null);

  if (!activeWorkspace) return null;

  const submitInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await invite.mutate({ email, role });
      setLatestInviteUrl(result.inviteUrl);
      setEmail("");
      refresh();
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
        toast({
          title: "Invitation link copied",
          description: "Share it securely. The link expires in 7 days.",
        });
      } catch {
        toast({
          title: "Invitation created",
          description: "Copy the link shown below. It expires in 7 days.",
        });
      }
    } catch (caught) {
      toast({
        title: "Could not create invitation",
        description: caught instanceof Error ? caught.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const copyLatestInvitation = async () => {
    if (!latestInviteUrl) return;
    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      toast({ title: "Invitation link copied" });
    } catch {
      toast({
        title: "Could not copy link",
        description: "Select and copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const changeRole = async (userId: string, nextRole: "editor" | "viewer") => {
    try {
      await apiFetch("/api/workspace-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      refresh();
      toast({ title: "Role updated" });
    } catch (caught) {
      toast({
        title: "Could not update role",
        description: caught instanceof Error ? caught.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const removeAccess = async () => {
    if (!removeTarget) return;
    try {
      await apiFetch("/api/workspace-members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          removeTarget.type === "member"
            ? { userId: removeTarget.id }
            : { invitationId: removeTarget.id },
        ),
      });
      setRemoveTarget(null);
      refresh();
      toast({ title: removeTarget.type === "member" ? "Member removed" : "Invitation revoked" });
    } catch (caught) {
      toast({
        title: "Could not remove access",
        description: caught instanceof Error ? caught.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workspace members</CardTitle>
          <CardDescription>Only the workspace owner can manage members and invitations.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-4 text-brand" />Workspace members</CardTitle>
        <CardDescription>
          Invite separate identities to {activeWorkspace.name}. Editors can change ledger data; viewers have read-only access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={submitInvitation} className="grid gap-3 rounded-2xl border border-border/70 bg-secondary/20 p-4 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as "editor" | "viewer")}>
              <SelectTrigger id="member-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={invite.loading}>
            {invite.loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Invite
          </Button>
        </form>

        {latestInviteUrl && (
          <div className="space-y-1.5 rounded-2xl border border-brand/30 bg-brand/5 p-4">
            <Label htmlFor="latest-invite-link">New invitation link</Label>
            <div className="flex gap-2">
              <Input id="latest-invite-link" value={latestInviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={() => void copyLatestInvitation()}>
                <Copy className="size-4" /> Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">This link is shown only until you leave this page.</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-2xl border border-border/70">
            {data?.members.map((member) => (
              <div key={member.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                {member.role === "owner" ? (
                  <span className="text-xs font-medium capitalize text-muted-foreground">Owner</span>
                ) : (
                  <>
                    <Select value={member.role} onValueChange={(value) => void changeRole(member.userId, value as "editor" | "viewer")}>
                      <SelectTrigger className="w-[130px]" aria-label={`Role for ${member.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${member.name}`} onClick={() => setRemoveTarget({ type: "member", id: member.userId, label: member.name })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {data?.invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">Pending {invitation.role} invitation · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Revoke invitation for ${invitation.email}`} onClick={() => setRemoveTarget({ type: "invitation", id: invitation.id, label: invitation.email })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!data?.members.length && !data?.invitations.length && (
              <p className="p-4 text-sm text-muted-foreground">No workspace members yet.</p>
            )}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Copy className="size-3.5" /> Invitation links are copied once when created. Revoke and recreate an invitation to get a new link.
        </p>
      </CardContent>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={removeTarget?.type === "member" ? "Remove workspace member?" : "Revoke invitation?"}
        description={removeTarget?.type === "member" ? `${removeTarget?.label ?? "This member"} will immediately lose access to this workspace.` : `${removeTarget?.label ?? "This person"} will no longer be able to use this invitation link.`}
        confirmText="Remove access"
        variant="destructive"
        onConfirm={() => void removeAccess()}
      />
    </Card>
  );
}
