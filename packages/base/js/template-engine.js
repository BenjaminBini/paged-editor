// template-engine.js — tiny string template renderer for {{TOKEN}} placeholders.

export function renderTemplate(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, token) => {
    const key = `{{${token}}}`;
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
  });
}
