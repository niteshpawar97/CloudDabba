import { useState, useEffect, useCallback } from 'react';
import { listDbTables, getDbTableRows } from '../../api/database';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Database, Table2, ChevronLeft, X, RefreshCw } from 'lucide-react';

interface DatabaseBrowserModalProps {
  projectId: string;
  engine: 'postgres' | 'mariadb';
  onClose: () => void;
}

const PAGE_SIZE = 50;

function formatCell(value: any) {
  if (value === null || value === undefined) return <span className="text-slate-600 italic">null</span>;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function DatabaseBrowserModal({ projectId, engine, onClose }: DatabaseBrowserModalProps) {
  const toast = useToast();
  const [tables, setTables] = useState<{ name: string; rowEstimate: number }[] | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rowData, setRowData] = useState<{ columns: string[]; rows: any[]; total: number } | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const engineLabel = engine === 'postgres' ? 'PostgreSQL' : 'MariaDB';

  const loadTables = useCallback(() => {
    setTablesLoading(true);
    listDbTables(projectId, engine)
      .then(setTables)
      .catch((err: any) => toast.error(err.response?.data?.message || 'Failed to load tables'))
      .finally(() => setTablesLoading(false));
  }, [projectId, engine]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const loadRows = useCallback((table: string, off: number) => {
    setRowsLoading(true);
    getDbTableRows(projectId, engine, table, { limit: PAGE_SIZE, offset: off })
      .then(setRowData)
      .catch((err: any) => toast.error(err.response?.data?.message || 'Failed to load rows'))
      .finally(() => setRowsLoading(false));
  }, [projectId, engine]);

  useEffect(() => {
    if (selectedTable) loadRows(selectedTable, offset);
  }, [selectedTable, offset, loadRows]);

  const openTable = (table: string) => {
    setSelectedTable(table);
    setOffset(0);
    setRowData(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0e14] border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            {selectedTable && (
              <button onClick={() => setSelectedTable(null)} className="text-slate-500 hover:text-white">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Database className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {engineLabel} {selectedTable ? `— ${selectedTable}` : 'Tables'}
              </h3>
              {rowData && (
                <div className="text-xs text-slate-500">{rowData.total.toLocaleString()} rows</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => (selectedTable ? loadRows(selectedTable, offset) : loadTables())}
              className="text-slate-500 hover:text-white p-1.5"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {!selectedTable ? (
            tablesLoading ? (
              <div className="text-center text-slate-500 text-sm py-12">Loading tables...</div>
            ) : !tables || tables.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-12">No tables found in this database.</div>
            ) : (
              <div className="space-y-1">
                {tables.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => openTable(t.name)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-white font-mono">{t.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">~{t.rowEstimate.toLocaleString()} rows</span>
                  </button>
                ))}
              </div>
            )
          ) : rowsLoading && !rowData ? (
            <div className="text-center text-slate-500 text-sm py-12">Loading rows...</div>
          ) : rowData && rowData.rows.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-12">This table is empty.</div>
          ) : rowData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.03] text-left">
                    {rowData.columns.map((col) => (
                      <th key={col} className="py-2 px-3 font-medium text-slate-400 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowData.rows.map((row, i) => (
                    <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                      {rowData.columns.map((col) => (
                        <td key={col} className="py-2 px-3 text-slate-300 font-mono whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                          {formatCell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {selectedTable && rowData && rowData.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/[0.06]">
            <span className="text-xs text-slate-500">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, rowData.total)} of {rowData.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={offset + PAGE_SIZE >= rowData.total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
