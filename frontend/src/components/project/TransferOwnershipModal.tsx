import { useState } from 'react';
import { transferProjectOwnership } from '../../api/projects';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { Send, X, AlertTriangle } from 'lucide-react';

interface TransferOwnershipModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onTransferred: () => void;
}

export function TransferOwnershipModal({ projectId, projectName, onClose, onTransferred }: TransferOwnershipModalProps) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = email.trim().length > 0 && confirmText === projectName;

  const handleTransfer = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await transferProjectOwnership(projectId, email.trim());
      toast.success(`Project transferred to ${email.trim()}`);
      onTransferred();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to transfer project');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0e14] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Send className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Transfer Ownership</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 items-start bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/90">
            The recipient must already have a CloudDabba account with this email. You will immediately lose access to "{projectName}".
          </p>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Recipient's account email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" type="email" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Type <span className="text-white font-mono">{projectName}</span> to confirm
            </label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={projectName} />
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={handleTransfer} loading={loading} disabled={!canSubmit}>
            Transfer Project
          </Button>
        </div>
      </div>
    </div>
  );
}
