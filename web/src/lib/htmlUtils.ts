/**
 * Prunes repetitive HTML elements to save tokens and focus LLM attention.
 * Keeps only the first 3 and last 3 siblings of similar tags.
 */
export function pruneHtml(htmlString: string, maxSiblings = 3): string {
  if (!htmlString) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Remove elements that don't help with extraction structure
  const scriptsAndStyles = doc.querySelectorAll('script, style, link, meta, noscript');
  scriptsAndStyles.forEach(el => el.remove());

  const targetTags = ['tr', 'li', 'p', 'td', 'div', 'article', 'section'];
  
  function processNode(node: Element) {
    if (!node.children || node.children.length === 0) return;

    // Group children by tag name
    const groups: Record<string, Element[]> = {};
    Array.from(node.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (targetTags.includes(tag)) {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(child);
      }
    });

    // Prune groups that are too large
    Object.entries(groups).forEach(([tag, children]) => {
      if (children.length > (maxSiblings * 2)) {
        const toRemove = children.slice(maxSiblings, children.length - maxSiblings);
        if (toRemove.length > 0) {
          const placeholder = doc.createComment(` ... [${toRemove.length} repetitive <${tag}> items pruned] ... `);
          node.insertBefore(placeholder, toRemove[0]);
          toRemove.forEach(child => child.remove());
        }
      }
    });

    // Recursively process remaining children
    Array.from(node.children).forEach(child => processNode(child));
  }

  processNode(doc.body);
  
  return doc.body.innerHTML;
}
