export function html(
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
): string {
  return strings.reduce(
    (result, part, index) =>
      result + part + (index < values.length ? String(values[index]) : ""),
    "",
  );
}
