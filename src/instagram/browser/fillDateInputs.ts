export interface FillDateInputsInput {
  from: string;
  to: string;
}

export function fillDateInputs({ from, to }: FillDateInputsInput): boolean {
  class DateInputFiller {
    public fill(): boolean {
      const inputs = this.findInputs();
      const firstInput = inputs[0];
      const secondInput = inputs[1];

      if (!firstInput) {
        return false;
      }

      if (from) {
        this.setValue(firstInput, from);
      }
      if (to && secondInput) {
        this.setValue(secondInput, to);
      }

      return true;
    }

    private findInputs(): HTMLInputElement[] {
      return Array.from(document.querySelectorAll('input'))
        .filter((input): input is HTMLInputElement => input instanceof HTMLInputElement)
        .filter((input) => this.isDateCandidate(input));
    }

    private isDateCandidate(input: HTMLInputElement): boolean {
      return this.isVisible(input) && !['hidden', 'checkbox', 'radio'].includes(input.type);
    }

    private isVisible(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    }

    private setValue(input: HTMLInputElement, value: string): void {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  return new DateInputFiller().fill();
}
