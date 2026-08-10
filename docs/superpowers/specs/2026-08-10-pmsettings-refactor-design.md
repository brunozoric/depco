# PmSettingsPage Refactor Design

Date: 2026-08-10

## Goal

Extract PmSettingsPage.tsx (524 lines) into focused tab components. Improve code quality during extraction.

## Current Structure

Single 524-line observer component with:

- Header + PM selector (lines 86-102)
- Error alerts (lines 104-117)
- Three tab panels: security (258 lines), install (63 lines), general (41 lines)
- Confirmation modal (lines 495-521)
- Local state for edit/add modes, registry URL, upgrade strategy

## Extraction Plan

**SecuritySettingsTab** — largest section (258 lines):

- Security settings table with add/edit/delete
- "Add setting" menu with field type options
- Inline edit form
- Props: security settings data + CRUD callbacks from presenter
- Owns: edit/add local state (extracted from parent)
- File: `src/ui/presentation/Settings/PmSettings/components/SecuritySettingsTab.tsx`

**InstallFlagsTab** — medium section (63 lines):

- Install flags table with toggle switches
- Props: install flags data + toggle callback
- File: `src/ui/presentation/Settings/PmSettings/components/InstallFlagsTab.tsx`

**GeneralSettingsTab** — small section (41 lines):

- Registry URL text input + save
- Upgrade strategy select + save
- Props: general settings data + save callbacks
- Owns: local input state for registry URL and upgrade strategy
- File: `src/ui/presentation/Settings/PmSettings/components/GeneralSettingsTab.tsx`

**PmSettingsConfirmDialog** — confirmation modal:

- Generic mutation confirmation dialog
- Props: open state, action description, confirm/cancel callbacks
- File: `src/ui/presentation/Settings/PmSettings/components/PmSettingsConfirmDialog.tsx`

**PmSettingsPage** stays as tab shell:

- Header, PM selector, error alerts, tab navigation
- Wires tab components to presenter
- Owns: confirmation dialog state, active tab state
- Target: ~80-100 lines

## Improvements During Extraction

- Move `UPGRADE_STRATEGY_OPTIONS` constant into GeneralSettingsTab (only consumer)
- Extract `handleStartEdit()` and `handleStartAdd()` into SecuritySettingsTab (they only affect security tab state)
- Simplify PmSettingsPage by removing local state that belongs to individual tabs (editValue, addValue, registryUrlInput, upgradeStrategyInput all move to their respective tab components)

## Testing

- Existing presenter tests must pass unchanged (page refactor doesn't touch presenter logic)
- No new tests needed for pure extraction — existing tests cover presenter behavior
- This is a UI-only refactor; verify visually that tabs render correctly after extraction
