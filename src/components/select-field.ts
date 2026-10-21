import { createElement } from '../lib/dom';

export interface SelectField<Value extends string> {
  /** The labelled control, ready to place in a form. */
  field: HTMLElement;
  value: () => Value;
}

/** A labelled `<select>` whose options are the keys of `choices`, shown as their values. */
export function selectField<Value extends string>(
  id: string,
  label: string,
  choices: Record<Value, string>,
  initial: NoInfer<Value>,
): SelectField<Value> {
  const control = createElement(
    'select',
    { id, class: 'input' },
    ...Object.entries<string>(choices).map(([value, text]) =>
      createElement('option', { value, selected: value === initial }, text),
    ),
  );
  return {
    field: createElement(
      'div',
      { class: 'field' },
      createElement('label', { for: id, class: 'field__label' }, label),
      control,
    ),
    value: () => control.value as Value,
  };
}
