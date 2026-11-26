import { useEffect, useMemo, useState } from "react";

export const DEFAULT_GRID_PAGE_SIZE = 20;

export function paginateSlice<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): { slice: T[]; totalPages: number; totalItems: number; safePage: number } {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    totalPages,
    totalItems,
    safePage,
  };
}

export function useClientPagination<T>(items: readonly T[], pageSize = DEFAULT_GRID_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const { slice, totalPages, totalItems } = useMemo(
    () => paginateSlice(items, page, pageSize),
    [items, page, pageSize],
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return { page, setPage, slice, totalPages, totalItems };
}