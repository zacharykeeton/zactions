## Context

The app currently has no way to locate a task other than visually scanning lists and expanding subtrees. All tasks are stored as a recursive `Task[]` tree in localStorage across multiple lists. The sidebar controls which list/view is displayed in the main content area.

## Goals / Non-Goals

**Goals:**
- Provide instant task filtering by title substring
- Search across all tasks in all lists, including nested subtasks
- Show search results with enough context (list name, parent path) to identify the task
- Navigate to the matched task when a result is clicked

**Non-Goals:**
- Full-text search across tags, dates, or other fields (future enhancement)
- Server-side search or indexing
- Search history or saved searches
- Fuzzy/typo-tolerant matching

## Decisions

### 1. Search input placement: Sidebar header
**Decision:** Add a search input using the shadcn/ui `Input` component (`components/ui/input`) to the top of the sidebar, above the list navigation.
**Rationale:** The sidebar is always visible and is the natural navigation hub. Placing search here keeps it accessible without consuming main content space. The existing `cmdk` command palette is for actions, not persistent filtering.
**Alternatives considered:**
- Command palette integration — dismissed because cmdk is action-oriented and ephemeral; search needs to persist while browsing results
- Top bar / main content area — would require layout changes and is view-dependent

### 2. Search state: Local component state in sidebar
**Decision:** Use `useState` in `AppSidebar` for the search query. No new hook or localStorage persistence.
**Rationale:** Search is transient — there's no value in persisting it across page loads. Keeping it as local state avoids unnecessary complexity.

### 3. Search algorithm: Recursive tree traversal with path tracking
**Decision:** Create `searchTasks(tasks: Task[], query: string): SearchResult[]` in a new `search-utils.ts`. It recursively walks the full task tree, collecting matches with their parent path (breadcrumb trail).
**Rationale:** The task tree is already in-memory (localStorage). A simple recursive walk with `title.toLowerCase().includes(query.toLowerCase())` is fast enough for client-side use with typical task counts (hundreds to low thousands).

### 4. Result display: Replace main content area while searching
**Decision:** When search is active (non-empty query), replace the main content with a flat `SearchResults` component built with shadcn/ui primitives (`Badge` for priority, `Button` for interactions, `Separator` between results as needed). Clearing the search returns to the previous view.
**Rationale:** Showing results inline in the sidebar would be too cramped for task details. Replacing the main content gives results room to breathe and follows the same pattern as other view switches (Today, Timeline, etc.).

### 5. Result click behavior: Switch to list and scroll to task
**Decision:** Clicking a result sets the active list filter to the task's list, clears the search, and the task appears in its normal tree position. No explicit scroll-to or highlight — the user simply navigates to the correct list.
**Rationale:** Implementing scroll-to-element within a deeply nested tree would require significant plumbing (expanding collapsed parents, computing scroll position). Simply navigating to the correct list is a practical first implementation.

## Risks / Trade-offs

- **Performance with very large task trees** → The recursive search runs on every keystroke. Mitigation: debounce the search input (300ms). For typical task counts this is a non-issue.
- **No highlighting of matches** → Results show the full title but don't highlight the matching substring. Acceptable for v1; can be added later.
- **Archived tasks** → Decision: exclude archived tasks from search results by default to avoid clutter. Archived tasks have their own view.
