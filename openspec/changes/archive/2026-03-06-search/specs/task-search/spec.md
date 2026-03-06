## ADDED Requirements

### Requirement: Search input in sidebar
The sidebar SHALL display a search input field above the list navigation. The input SHALL have placeholder text "Search tasks..." and a search icon. When the input contains text, a clear button SHALL appear to reset the search.

#### Scenario: Empty search state
- **WHEN** the search input is empty
- **THEN** the sidebar and main content area display their normal views

#### Scenario: User types a search query
- **WHEN** the user types text into the search input
- **THEN** the main content area switches to display search results after a short debounce

#### Scenario: User clears search
- **WHEN** the user clicks the clear button or deletes all text from the search input
- **THEN** the app returns to the previously active view (list, Today, Timeline, etc.)

### Requirement: Case-insensitive partial title matching
The search SHALL match tasks whose title contains the query string as a case-insensitive substring. The search SHALL traverse the full recursive task tree, including all nested subtasks at any depth.

#### Scenario: Partial match
- **WHEN** the user searches for "gro"
- **THEN** tasks with titles "Groceries", "Underground", and "Daily grooming" SHALL all appear in results

#### Scenario: Case insensitivity
- **WHEN** the user searches for "BUY"
- **THEN** a task titled "buy milk" SHALL appear in results

#### Scenario: Nested subtask match
- **WHEN** a subtask 3 levels deep has a matching title
- **THEN** that subtask SHALL appear in results with its parent path shown for context

### Requirement: Search results display
Search results SHALL be displayed as a flat list in the main content area, replacing the current view. Each result SHALL show the task title, its priority indicator, and a breadcrumb path showing its parent hierarchy and list name.

#### Scenario: Results with context
- **WHEN** a task "Buy milk" exists under "Errands" in the "Personal" list
- **THEN** the search result SHALL show "Buy milk" with breadcrumb "Personal > Errands"

#### Scenario: No results
- **WHEN** the search query matches no tasks
- **THEN** the results area SHALL display an empty state message such as "No tasks found"

### Requirement: Archived tasks excluded
The search SHALL NOT include archived tasks in results.

#### Scenario: Archived task not shown
- **WHEN** an archived task matches the search query
- **THEN** that task SHALL NOT appear in search results

### Requirement: Navigate to task from search result
Clicking a search result SHALL navigate to the task's list and clear the search query, returning the user to the normal list view where the task is visible.

#### Scenario: Click result navigates to list
- **WHEN** the user clicks a search result for a task in the "Work" list
- **THEN** the active list filter switches to "Work" and the search is cleared

### Requirement: Keyboard shortcut to focus search
The search input SHALL be focusable via a keyboard shortcut (Ctrl+K or Cmd+K) for quick access.

#### Scenario: Keyboard shortcut focuses search
- **WHEN** the user presses Ctrl+K (or Cmd+K on macOS)
- **THEN** the search input receives focus
