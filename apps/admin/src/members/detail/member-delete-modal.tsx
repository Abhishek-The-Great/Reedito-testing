import React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingIndicator,
} from '@reedito/shade/components';
import { toast } from 'sonner';
import { useDeleteMember } from '@reedito/admin-x-framework/api/members';
import { useNavigate } from '@reedito/admin-x-framework';
import type { Member } from '@reedito/admin-x-framework/api/members';

interface MemberDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  /**
   * Invoked right before we `navigate('/members')` so the parent's
   * unsaved-changes blocker doesn't intercept the redirect and pop a
   * "Discard changes?" dialog for a member that has just been deleted.
   */
  allowLeaveWithUnsavedChanges: () => void;
}

/**
 * Confirms permanent member deletion and navigates to /members on success.
 */
const MemberDeleteModal: React.FC<MemberDeleteModalProps> = ({
  open,
  onOpenChange,
  member,
  allowLeaveWithUnsavedChanges,
}) => {
  const navigate = useNavigate();
  const deleteMember = useDeleteMember();
  // Members can be created without an email (Ember has the same gap). Fall
  // back through name → "this member" so we never render `<strong></strong>`
  // in the confirmation body or a bare " was deleted." in the toast.
  const displayIdentity = member.email || member.name || 'this member';

  const onConfirm = async () => {
    try {
      await deleteMember.mutateAsync({ id: member.id });
      toast.success(`${displayIdentity} was deleted.`);
      onOpenChange(false);
      // Bypass the unsaved-changes blocker: the member no longer exists,
      // so there's nothing meaningful to keep editing.
      allowLeaveWithUnsavedChanges();
      navigate('/members');
    } catch {
      toast.error('Couldn’t delete the member. Please try again.');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Prevent close during the network round-trip so the dialog remains
        // available if deletion fails.
        if (deleteMember.isPending) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent data-testid="delete-member-modal">
        <DialogHeader>
          <DialogTitle>Delete member account</DialogTitle>
          <DialogDescription>
            Permanently delete <strong>{displayIdentity}</strong> from Reedito.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            data-testid="cancel-delete-member"
            disabled={deleteMember.isPending}
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-testid="confirm-delete-member"
            disabled={deleteMember.isPending}
            variant="destructive"
            onClick={() => void onConfirm()}
          >
            {deleteMember.isPending ? (
              <>
                <LoadingIndicator size="sm" />
                <span className="sr-only">Deleting</span>
              </>
            ) : (
              'Delete member'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MemberDeleteModal;
