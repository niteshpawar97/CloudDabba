import { useState, useEffect } from 'react';
import { getImages, deleteImage, cleanupImages } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Image, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminImages() {
  usePageTitle('Admin - Images');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const fetch = () => {
    setLoading(true);
    getImages().then(setImages).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string, tag: string) => {
    if (!confirm(`Delete image "${tag}"?`)) return;
    await deleteImage(id);
    fetch();
  };

  const handleCleanup = async () => {
    if (!confirm('Remove all unused CloudDabba images? Running containers will not be affected.')) return;
    setCleaning(true);
    try {
      const result = await cleanupImages();
      alert(`${result.cleaned} unused images removed`);
      fetch();
    } catch {}
    setCleaning(false);
  };

  if (loading) return <Spinner size="lg" />;

  const totalSize = images.reduce((sum, img) => sum + img.size, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Docker Images</h1>
          <p className="text-sm text-slate-400 mt-1">{images.length} images, {totalSize} MB total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetch}>
            <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Refresh</span>
          </Button>
          <Button variant="danger" size="sm" onClick={handleCleanup} loading={cleaning}>
            <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Cleanup Unused</span>
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-16">
          <Image className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No CloudDabba images found</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-left">
                <th className="py-3 px-4 font-medium text-slate-400">Image</th>
                <th className="py-3 px-4 font-medium text-slate-400">ID</th>
                <th className="py-3 px-4 font-medium text-slate-400">Size</th>
                <th className="py-3 px-4 font-medium text-slate-400">Created</th>
                <th className="py-3 px-4 font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {images.map((img) => (
                <tr key={img.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-3 px-4">
                    <div className="text-white font-mono text-xs">
                      {img.tags?.map((t: string) => (
                        <div key={t}>{t}</div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-xs">{img.id}</td>
                  <td className="py-3 px-4 text-slate-300">{img.size} MB</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(img.created).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDelete(img.id, img.tags?.[0] || img.id)}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
