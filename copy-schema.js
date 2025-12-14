/* =========================================================
   RichText Core — minimal JSON schema + renderer
   ========================================================= */

export const RichText = (() => {

  /* ---------- Schema ---------- */

  const EMPTY_DOC = () => ({
    type: 'doc',
    version: 1,
    children: [
      paragraph()
    ]
  });

  /* ---------- Node factories ---------- */

  function paragraph(children = [text('')], attrs = {}) {
    return block('paragraph', children, attrs);
  }

  function heading(level = 1, children = [text('')], attrs = {}) {
    return block('heading', children, { level, ...attrs });
  }

  function hr(attrs = {}) {
    return { type: 'hr', attrs };
  }

  function list(ordered = false, items = [], attrs = {}) {
    return {
      type: 'list',
      attrs: { ordered, ...attrs },
      children: items
    };
  }

  function quote(children = [text('')], attrs = {}) {
    return block('quote', children, attrs);
  }

  function code(textContent = '', attrs = {}) {
    return {
      type: 'code',
      attrs,
      children: [{ type: 'text', text: textContent }]
    };
  }

  function table(rows = [], attrs = {}) {
    return {
      type: 'table',
      attrs,
      children: rows
    };
  }

  function image(src, attrs = {}) {
    return {
      type: 'image',
      attrs: { src, ...attrs }
    };
  }

  function embed(src, attrs = {}) {
    return {
      type: 'embed',
      attrs: { src, ...attrs }
    };
  }

  function block(type, children = [], attrs = {}) {
    return { type, attrs, children };
  }

  function text(value = '', marks = {}) {
    return { type: 'text', text: value, marks };
  }

  function br() {
    return { type: 'br' };
  }

  /* ---------- HTML Rendering ---------- */

  function render(doc) {
    return doc.children.map(renderNode).join('');
  }

  function renderNode(node) {
    switch (node.type) {
      case 'paragraph':
        return `<p${style(node)}>${renderInline(node)}</p>`;

      case 'heading':
        return `<h${node.attrs.level || 1}${style(node)}>${renderInline(node)}</h${node.attrs.level || 1}>`;

      case 'hr':
        return `<hr${style(node)} />`;

      case 'quote':
        return `<blockquote${style(node)}>${renderInline(node)}</blockquote>`;

      case 'list':
        const tag = node.attrs.ordered ? 'ol' : 'ul';
        return `<${tag}${style(node)}>
          ${node.children.map(li => `<li>${renderInline(li)}</li>`).join('')}
        </${tag}>`;

      case 'code':
        return `<pre${style(node)}><code>${escape(node.children[0]?.text || '')}</code></pre>`;

      case 'table':
        return `<table${style(node)}>
          ${node.children.map(row =>
            `<tr>${row.map(cell => `<td>${renderInline(cell)}</td>`).join('')}</tr>`
          ).join('')}
        </table>`;

      case 'image':
        return `<img src="${node.attrs.src}"${style(node)} />`;

      case 'embed':
        return `<iframe src="${node.attrs.src}"${style(node)}></iframe>`;

      default:
        return '';
    }
  }

  function renderInline(node) {
    return node.children.map(n => {
      if (n.type === 'text') {
        let t = escape(n.text);
        if (n.marks?.bold) t = `<b>${t}</b>`;
        if (n.marks?.italic) t = `<i>${t}</i>`;
        if (n.marks?.underline) t = `<u>${t}</u>`;
        return t;
      }
      if (n.type === 'br') return '<br />';
      return '';
    }).join('');
  }

  /* ---------- Style handling ---------- */

  function style(node) {
    if (!node.attrs) return '';
    const s = [];
    if (node.attrs.align) s.push(`text-align:${node.attrs.align}`);
    if (node.attrs.padding) s.push(`padding:${node.attrs.padding}`);
    if (node.attrs.margin) s.push(`margin:${node.attrs.margin}`);
    if (node.attrs.border) s.push(`border:${node.attrs.border}`);
    return s.length ? ` style="${s.join(';')}"` : '';
  }

  function escape(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ---------- Public API ---------- */

  return {
    EMPTY_DOC,
    paragraph,
    heading,
    hr,
    list,
    quote,
    code,
    table,
    image,
    embed,
    text,
    br,
    render
  };
})();