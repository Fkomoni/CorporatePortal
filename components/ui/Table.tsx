import { twMerge } from 'tailwind-merge';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  className?: string;
  emptyMessage?: string;
}

export function Table<T extends Record<string, unknown>>({ columns, data, className, emptyMessage }: TableProps<T>) {
  return (
    <div className={twMerge('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-full">
        <thead>
          <tr className="border-b border-[#E5E7F1]">
            {columns.map((col) => (
              <th key={col.key} className={twMerge('px-4 py-3 text-left text-xs font-semibold text-[#3A4382] uppercase tracking-wide whitespace-nowrap', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400">{emptyMessage || 'No data available'}</td></tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx} className={twMerge('border-b border-[#E5E7F1] transition-colors hover:bg-[#F1F2F8]', idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]')}>
                {columns.map((col) => (
                  <td key={col.key} className={twMerge('px-4 py-3 text-sm text-gray-700', col.className)}>
                    {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
