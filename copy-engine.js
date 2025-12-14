/* =========================================================
   RichText Editor — DOM ⇄ JSON sync + commands
   ========================================================= */

import { RichText } from './richtext-core.js';

export class RichTextEditor {
  constructor(root) {
    this.root = root;
    this.editor = root.querySelector('.rte-editor');
    this.toolbar = root.querySelector('.rte-toolbar');

    this.doc = RichText.EMPTY_DOC();

    this.bindToolbar();
    this.bindEditor();

    this.render();
  }

  /* ---------------- Toolbar ---------------- */

  bindToolbar() {
    this.toolbar.addEventListener('click', e => {
      const btn = e.target.closest('[data-cmd]');
      if (!btn) return;
      this.exec(btn.dataset.cmd);
    });
  }

  exec(cmd) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    switch (cmd) {
      case 'bold':
      case 'italic':
      case 'underline':
        this.toggleMark(cmd);
        break;

      case 'h1':
      case 'h2':
        this.setBlock('heading', { level: Number(cmd[1]) });
        break;

      case 'p':
        this.setBlock('paragraph');
        break;

      case 'quote':
        this.setBlock('quote');
        break;

      case 'ul':
        this.setList(false);
        break;

      case 'ol':
        this.setList(true);
        break;

      case 'hr':
        this.insertHR();
        break;

      case 'code':
        this.setBlock('code');
        break;
    }

    this.syncFromDOM();
  }

  /* ---------------- Editor events ---------------- */

  bindEditor() {
    this.editor.addEventListener('input', () => {
      this.syncFromDOM();
    });

    this.editor.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        document.execCommand('insertHTML', false, '<br>');
        e.preventDefault();
      }
    });
  }

  /* ---------------- Commands ---------------- */

  toggleMark(mark) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const span = document.createElement(
      mark === 'bold' ? 'b' :
      mark === 'italic' ? 'i' :
      'u'
    );

    span.appendChild(range.extractContents());
    range.insertNode(span);
    range.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  setBlock(type, attrs = {}) {
    const block = this.getCurrentBlock();
    if (!block) return;

    let el;

    switch (type) {
      case 'heading':
        el = document.createElement(`h${attrs.level}`);
        break;
      case 'quote':
        el = document.createElement('blockquote');
        break;
      case 'code':
        el = document.createElement('pre');
        el.innerHTML = `<code>${block.innerText}</code>`;
        block.replaceWith(el);
        return;
      default:
        el = document.createElement('p');
    }

    el.innerHTML = block.innerHTML;
    block.replaceWith(el);
  }

  setList(ordered) {
    const block = this.getCurrentBlock();
    if (!block) return;

    const list = document.createElement(ordered ? 'ol' : 'ul');
    const li = document.createElement('li');
    li.innerHTML = block.innerHTML;

    list.appendChild(li);
    block.replaceWith(list);
  }

  insertHR() {
    const hr = document.createElement('hr');
    const block = this.getCurrentBlock();
    block.after(hr);
  }

  getCurrentBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.anchorNode;
    while (node && node !== this.editor) {
      if (node.parentNode === this.editor) return node;
      node = node.parentNode;
    }
    return null;
  }

  /* ---------------- DOM → JSON ---------------- */

  syncFromDOM() {
    const children = [];
    this.editor.childNodes.forEach(n => {
      const block = this.parseBlock(n);
      if (block) children.push(block);
    });
    this.doc.children = children;
  }

  parseBlock(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return RichText.paragraph([RichText.text(node.textContent)]);
    }

    switch (node.nodeName) {
      case 'P':
        return RichText.paragraph(this.parseInline(node));
      case 'H1':
        return RichText.heading(1, this.parseInline(node));
      case 'H2':
        return RichText.heading(2, this.parseInline(node));
      case 'BLOCKQUOTE':
        return RichText.quote(this.parseInline(node));
      case 'PRE':
        return RichText.code(node.innerText);
      case 'HR':
        return RichText.hr();
      case 'UL':
      case 'OL':
        return RichText.list(
          node.nodeName === 'OL',
          [...node.children].map(li =>
            RichText.paragraph(this.parseInline(li))
          )
        );
      default:
        return null;
    }
  }

  parseInline(el) {
    const out = [];

    el.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        out.push(RichText.text(n.textContent));
      } else if (n.nodeName === 'BR') {
        out.push(RichText.br());
      } else {
        const marks = {};
        if (n.nodeName === 'B') marks.bold = true;
        if (n.nodeName === 'I') marks.italic = true;
        if (n.nodeName === 'U') marks.underline = true;

        out.push(RichText.text(n.innerText, marks));
      }
    });

    return out;
  }

  /* ---------------- JSON → DOM ---------------- */

  render() {
    this.editor.innerHTML = RichText.render(this.doc);
  }

  /* ---------------- Public API ---------------- */

  getValue() {
    return structuredClone(this.doc);
  }

  setValue(doc) {
    this.doc = doc;
    this.render();
  }
}