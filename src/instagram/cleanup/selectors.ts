export function getSelectionModeSelector(): string {
  return [
    '[data-testid="bulk_action_checkbox"]',
    '[role="checkbox"]',
    '[aria-checked]',
    'input[type="checkbox"]',
    '[aria-label*="Toggle checkbox"]',
    '[aria-label*="toggle checkbox"]',
    '[aria-label*="checkbox"]',
  ].join(',');
}

export function getSelectableItemsSelector(): string {
  return [
    '[data-testid="bulk_action_checkbox"]',
    '[aria-label*="Toggle checkbox"]',
    '[aria-label*="toggle checkbox"]',
    '[role="checkbox"]',
    '[aria-checked]',
    'input[type="checkbox"]',
  ].join(',');
}

export function getCheckboxCandidateSelector(): string {
  return [
    '[data-testid="bulk_action_checkbox"]',
    '[role="checkbox"][aria-checked="false"]',
    '[aria-checked="false"]',
    'input[type="checkbox"]:not(:checked)',
    '[aria-label*="Toggle checkbox"]',
    '[aria-label*="toggle checkbox"]',
    '[aria-label*="checkbox"]',
  ].join(',');
}
