## Why

There is no way to find a specific task without manually scanning through lists and expanding nested subtrees. As the task count grows, this becomes a significant friction point. A search feature lets users quickly locate tasks by title.

## What Changes

- Add a search input to the sidebar header that filters tasks by title
- When searching, display a flat list of matching tasks across all lists (with list/parent context)
- Clicking a search result navigates to and highlights the task in its list
- Search is case-insensitive and matches partial strings
- Clear search to return to normal navigation

## Capabilities

### New Capabilities
- `task-search`: Search bar in the sidebar that filters all tasks (including nested subtasks) by title, showing results across all lists with navigation to the matched task.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Components**: `app-sidebar.tsx` (search input), new `search-results.tsx` component
- **Lib**: New `search-utils.ts` for recursive task tree searching
- **Hooks**: May extend `useTaskStore` or create a lightweight search state
- **No new dependencies** — uses native string matching
- **No breaking changes**
