/** 转为 kebab-case：my_app / MyApp → my-app */
export function toKebabCase(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toPascalCase(input: string): string {
  return toKebabCase(input)
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

export function toCamelCase(input: string): string {
  const pascal = toPascalCase(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function isValidPluginName(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
}
