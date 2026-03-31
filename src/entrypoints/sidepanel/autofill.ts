/**
 * Content script injected into each frame via browser.scripting.executeScript.
 * Must be self-contained — no imports, no closed-over variables.
 */
export function prefillCardComponent(
  number: string | undefined,
  exp: string | undefined,
  csc: string | undefined,
  name: string | undefined
) {
  function fillField(selector: string, value: string | undefined) {
    if (value == null) return;
    const element = document.querySelector(selector) as HTMLInputElement;
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  fillField('input[autocomplete="cc-number"]', number);
  fillField('input[autocomplete="cc-exp"]', exp);
  fillField('input[autocomplete="cc-csc"]', csc);
  fillField('input[autocomplete="cc-name"]', name);
  if (exp) {
    fillField('input[autocomplete="cc-exp-month"]', exp.slice(0, 2));
    fillField('input[autocomplete="cc-exp-year"]', exp.slice(-2));
  }
}
