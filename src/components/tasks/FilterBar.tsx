import { Search, X } from 'lucide-react';
import { CATEGORIES, PRIORITIES, type Category, type Priority } from '../../domain/types.ts';
import { useAppState, useAppDispatch } from '../../state/AppContext.tsx';

/**
 * Search and filter controls (REQ-ORG-02). A title search, a category select
 * and a priority select, all combined as a conjunction, plus a single control
 * that clears every filter and the search text. Each control has a visible
 * label (the search label is visually hidden with an icon affordance).
 */
export function FilterBar(): JSX.Element {
  const { ui } = useAppState();
  const dispatch = useAppDispatch();
  const { filters } = ui;

  const hasActiveFilter =
    filters.search.trim() !== '' || filters.category !== 'all' || filters.priority !== 'all';

  return (
    <div className="filter-bar" role="search">
      <div className="filter-bar__search">
        <Search className="filter-bar__search-icon" size={18} aria-hidden="true" />
        <label htmlFor="filter-search" className="visually-hidden">
          Search spirits by title
        </label>
        <input
          id="filter-search"
          type="search"
          placeholder="Search spirits..."
          value={filters.search}
          onChange={(e) => dispatch({ type: 'SET_FILTERS', filters: { search: e.target.value } })}
        />
      </div>

      <div className="filter-bar__field">
        <label htmlFor="filter-category" className="visually-hidden">
          Filter by category
        </label>
        <select
          id="filter-category"
          aria-label="Filter by category"
          value={filters.category}
          onChange={(e) =>
            dispatch({
              type: 'SET_FILTERS',
              filters: { category: e.target.value as Category | 'all' },
            })
          }
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-bar__field">
        <label htmlFor="filter-priority" className="visually-hidden">
          Filter by priority
        </label>
        <select
          id="filter-priority"
          aria-label="Filter by priority"
          value={filters.priority}
          onChange={(e) =>
            dispatch({
              type: 'SET_FILTERS',
              filters: { priority: e.target.value as Priority | 'all' },
            })
          }
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn filter-bar__clear"
        onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
        disabled={!hasActiveFilter}
      >
        <X size={16} aria-hidden="true" />
        Clear filters
      </button>
    </div>
  );
}
