/** An element the page's markup always has; a missing one is a bug in the page. */
export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} is missing from the page`);
  return node as T;
};
