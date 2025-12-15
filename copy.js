/* Ikdao Copy Tool Script File */

/* Self License - https://legal.ikdao.org/self-license/

Zero One One License - 011SL

Ikdao Copy Script - [Hemang Tewari]

No terms & conditions 
Attribution required
Accountability required

*/

class CopyTool {
  constructor() {
    this.editor = null;
    this.currentNoteId = null;
    this.db = null;
    this.notes = [];
    this.autosaveTimeout = null;
    this.modalCallback = null;
    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.titleInput = document.getElementById('note-title-input');
    this.editor = document.getElementById('editor');
    this.saveBtn = document.getElementById('save-note-btn');
    this.newBtn = document.getElementById('new-note-btn');
    this.exportBtn = document.getElementById('export-note-btn');
    this.list = document.getElementById('saved-notes-list');
    this.searchInput = document.getElementById('search-input');
    this.emptyState = document.getElementById('empty-state');
    this.autosaveToggle = document.getElementById('autosave-toggle');
    this.exportSelect = document.getElementById('export-format-select');
    this.modal = document.getElementById('modal');
    this.printFrame = document.getElementById('print-frame');
  }

  initEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => this.navigate(e.target));
    });

    // Actions
    this.saveBtn.onclick = () => this.saveNote();
    this.newBtn.onclick = () => this.newNote();
    this.exportBtn.onclick = () => this.exportNote();

    // Search
    this.searchInput.oninput = () => this.filterNotes();

    // Settings
    this.autosaveToggle.onchange = () =>
      localStorage.setItem('autosave', this.autosaveToggle.checked);
    this.exportSelect.onchange = () =>
      localStorage.setItem('export-format', this.exportSelect.value);

    // Editor input (for autosave)
    this.editor.addEventListener('input', () => {
      if (this.autosaveToggle.checked) {
        clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = setTimeout(() => this.saveNote(), 1000);
      }
    });

    // Toolbar
    document.getElementById('format-toolbar').addEventListener('click', (e) => {
      if (!e.target.matches('btn, button')) return;
      const action = e.target.dataset.action;
      switch (action) {
        case 'bold': this.toggleInline('strong'); break;
        case 'italic': this.toggleInline('em'); break;
        case 'underline': this.toggleInline('u'); break;
        case 'strike': this.toggleInline('s'); break;
        case 'code': this.toggleInline('code'); break;
        case 'heading': this.formatBlock(`h${e.target.dataset.level}`); break;
        case 'paragraph': this.formatBlock('p'); break;
        case 'blockquote': this.formatBlock('blockquote'); break;
        case 'list': this.toggleList(e.target.dataset.type); break;
        case 'link': this.openLinkDialog(); break;
        case 'image': this.openImageDialog(); break;
        case 'table': this.openTableDialog(); break;
        case 'embed': this.openEmbedDialog(); break;
      }
    });

    // Modal buttons
    document.getElementById('modal-submit').onclick = () => this.submitModal();
    document.getElementById('modal-cancel').onclick = () => this.closeModal();

    // ✅ ENTER KEY IN MODAL
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submitModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        let handled = false;
        switch (e.key.toLowerCase()) {
          case 'b': this.toggleInline('strong'); handled = true; break;
          case 'i': this.toggleInline('em'); handled = true; break;
          case 'u': this.toggleInline('u'); handled = true; break;
          case 'l': this.openLinkDialog(); handled = true; break;
          case 'n': this.newNote(); handled = true; break;
          case 's': this.saveNote(); handled = true; break;
        }
        if (handled) {
          e.preventDefault();
        }
      }
    });
  }

  init() {
    this.autosaveToggle.checked = localStorage.getItem('autosave') === 'true';
    this.exportSelect.value = localStorage.getItem('export-format') || 'html';
    this.initDB();
    this.loadNoteFromURL();
  }

  // ========== NAVIGATION ==========
  navigate(btn) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.main-content section').forEach(s => s.classList.remove('show'));
    document.getElementById(btn.dataset.target).classList.add('show');
  }

  // ========== PERSISTENCE ==========
  initDB() {
    const req = indexedDB.open('abc', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('i-copy')) {
        db.createObjectStore('i-copy', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      this.db = e.target.result;
      this.loadNotes();
    };
  }

  async loadNoteFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get('id');
    if (!id) {
      id = crypto.randomUUID();
      history.replaceState({}, '', `?id=${id}`);
    }
    this.currentNoteId = id;
    const saved = await this.loadNoteFromDB(id);
    if (saved?.content) {
      this.titleInput.value = saved.title || '';
      this.editor.innerHTML = saved.content;
    } else {
      this.editor.innerHTML = '<p>\u200B</p>';
    }
    this.focusEditor();
  }

  async loadNoteFromDB(id) {
    if (!this.db) return null;
    const tx = this.db.transaction('i-copy', 'readonly');
    const req = tx.objectStore('i-copy').get(id);
    return new Promise(resolve => {
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  async saveNoteToDB(note) {
    if (!this.db) return;
    const tx = this.db.transaction('i-copy', 'readwrite');
    tx.objectStore('i-copy').put(note);
    await tx.complete;
  }

  // ========== NOTE MANAGEMENT ==========
  newNote() {
    this.currentNoteId = crypto.randomUUID();
    history.replaceState({}, '', `?id=${this.currentNoteId}`);
    this.titleInput.value = '';
    this.editor.innerHTML = '<p>\u200B</p>';
    this.focusEditor();
  }

  async saveNote() {
    if (!this.db) return;
    if (this.editor.textContent.trim() === '') {
      this.editor.innerHTML = '<p>\u200B</p>';
    }
    const note = {
      id: this.currentNoteId,
      title: this.titleInput.value || 'Untitled',
      content: this.editor.innerHTML,
      updated: Date.now()
    };
    await this.saveNoteToDB(note);
    this.loadNotes();
  }

  async loadNotes() {
    if (!this.db) return;
    const tx = this.db.transaction('i-copy', 'readonly');
    const req = tx.objectStore('i-copy').getAll();
    req.onsuccess = () => {
      this.notes = req.result.sort((a, b) => b.updated - a.updated);
      this.renderNotes();
    };
  }

  renderNotes() {
    this.list.innerHTML = '';
    this.emptyState.style.display = this.notes.length ? 'none' : 'block';
    this.notes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'note-item';
      const info = document.createElement('div');
      info.className = 'note-info';
      info.innerHTML = `<strong>${note.title || 'Untitled'}</strong><small>${new Date(note.updated).toLocaleDateString()}</small>`;
      info.onclick = () => {
        this.currentNoteId = note.id;
        history.replaceState({}, '', `?id=${note.id}`);
        this.titleInput.value = note.title || '';
        this.editor.innerHTML = note.content;
        this.navigate(document.querySelector('.nav-item[data-target="home-section"]'));
        this.focusEditor();
      };
      const del = document.createElement('button');
      del.textContent = 'Remove';
      del.onclick = (e) => {
        e.stopPropagation();
        this.deleteNote(note.id);
      };
      li.append(info, del);
      this.list.appendChild(li);
    });
  }

  async deleteNote(id) {
    if (!this.db) return;
    const tx = this.db.transaction('i-copy', 'readwrite');
    tx.objectStore('i-copy').delete(id);
    tx.oncomplete = () => this.loadNotes();
  }

  filterNotes() {
    const q = this.searchInput.value.toLowerCase();
    this.list.querySelectorAll('li').forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  focusEditor() {
    const sel = window.getSelection();
    const range = document.createRange();
    const firstP = this.editor.querySelector('p');
    if (firstP && firstP.textContent === '\u200B') {
      range.selectNodeContents(firstP);
      range.collapse(true);
    } else {
      range.selectNodeContents(this.editor);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    this.editor.focus();
  }

  // ========== SELECTION & INSERTION HELPERS ==========
  saveCurrentRange() {
    const sel = window.getSelection();
    if (sel.rangeCount === 0) return null;
    return sel.getRangeAt(0).cloneRange();
  }

  insertNodeUsingRange(node, range) {
    if (range) {
      if (range.collapsed) {
        range.insertNode(node);
      } else {
        const content = range.extractContents();
        node.appendChild(content);
        range.insertNode(node);
      }
      this.placeCaretAfter(node);
    } else {
      this.editor.appendChild(node);
      this.placeCaretAfter(node);
    }
  }

  placeCaretAfter(node) {
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ========== FORMATTING ==========
// ========== FORMATTING ==========
toggleInline(tagName) {
  const range = this.saveCurrentRange();
  if (!range) return;

  if (range.collapsed) {
    const empty = document.createElement(tagName);
    empty.innerHTML = '\u200B';
    this.insertNodeUsingRange(empty, range);
    return;
  }

  const wrapper = document.createElement(tagName);
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);
  this.placeCaretAfter(wrapper);
}

// ✅ FIXED: Place caret INSIDE the block
formatBlock(tagName) {
  const range = this.saveCurrentRange();
  const newBlock = document.createElement(tagName);

  if (range && !range.collapsed) {
    newBlock.appendChild(range.extractContents());
  } else {
    newBlock.innerHTML = '\u200B';
  }

  if (range) {
    range.deleteContents();
    range.insertNode(newBlock);
  } else {
    this.editor.appendChild(newBlock);
  }

  // ✅ Place caret INSIDE the block (at the zero-width space)
  this.focusInsideBlock(newBlock);
}

// ✅ FIXED: Place caret inside <li>
toggleList(listType) {
  const range = this.saveCurrentRange();
  const newBlock = document.createElement(listType);
  const li = document.createElement('li');

  if (range && !range.collapsed) {
    li.appendChild(range.extractContents());
  } else {
    li.innerHTML = '\u200B';
  }

  newBlock.appendChild(li);

  if (range) {
    range.deleteContents();
    range.insertNode(newBlock);
  } else {
    this.editor.appendChild(newBlock);
  }

  // ✅ Focus inside the <li>
  this.focusInsideBlock(li);
}

// ✅ NEW HELPER: Focus inside a block element
focusInsideBlock(blockElement) {
  const sel = window.getSelection();
  const range = document.createRange();
  
  // Find the text node or use the element
  let target = blockElement;
  if (blockElement.firstChild && blockElement.firstChild.nodeType === Node.TEXT_NODE) {
    target = blockElement.firstChild;
  }

  range.selectNodeContents(target);
  range.collapse(false); 
  sel.removeAllRanges();
  sel.addRange(range);
}
  // ========== MODAL ==========
  showModal(config) {
    // Optional: blur editor
    if (document.activeElement === this.editor) {
      this.editor.blur();
    }

    document.getElementById('modal-title').textContent = config.title;
    let html = '';
    config.fields.forEach(f => {
      html += `<label>${f.label}</label>`;
      if (f.multiline) {
        html += `<textarea id="modal-field-${f.name}" placeholder="${f.placeholder || ''}"></textarea>`;
      } else {
        html += `<input type="${f.type || 'text'}" id="modal-field-${f.name}" placeholder="${f.placeholder || ''}" autocomplete="off">`;
      }
    });
    document.getElementById('modal-fields').innerHTML = html;
    this.modalCallback = config.onSubmit;
    this.modal.classList.add('show');

    // Focus first input
    const firstInput = this.modal.querySelector('input, textarea');
    if (firstInput) firstInput.focus();
  }

  submitModal() {
    const values = {};
    document.querySelectorAll('#modal-fields input, #modal-fields textarea').forEach(el => {
      values[el.id.replace('modal-field-', '')] = el.value.trim();
    });
    if (this.modalCallback) this.modalCallback(values);
    this.closeModal();
  }

  closeModal() {
    this.modal.classList.remove('show');
    this.modalCallback = null;
    // Refocus editor
    setTimeout(() => this.focusEditor(), 10);
  }

  // ========== DIALOGS ==========
  openLinkDialog() {
    const savedRange = this.saveCurrentRange();
    this.showModal({
      title: 'Insert Link',
      fields: [
        { name: 'href', label: 'URL', placeholder: 'https://...' },
        { name: 'text', label: 'Link Text (optional)' }
      ],
      onSubmit: ({ href, text }) => {
        if (!href) return;
        let anchor = null;
        if (savedRange) {
          const container = savedRange.commonAncestorContainer;
          anchor = container.nodeType === Node.ELEMENT_NODE
            ? container.closest('a')
            : container.parentElement?.closest('a');
        }
        if (anchor) {
          anchor.href = href;
          if (text) anchor.textContent = text;
          return;
        }
        const link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener';
        if (savedRange && !savedRange.collapsed) {
          link.appendChild(savedRange.extractContents());
        } else {
          link.innerHTML = text || href || '\u200B';
        }
        this.insertNodeUsingRange(link, savedRange);
      }
    });
  }

  openImageDialog() {
    const savedRange = this.saveCurrentRange();
    this.showModal({
      title: 'Insert Image',
      fields: [
        { name: 'src', label: 'Image URL', placeholder: 'https://...' },
        { name: 'alt', label: 'Alt Text (optional)' }
      ],
      onSubmit: ({ src, alt }) => {
        if (!src) return;
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt || '';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.onload = () => this.placeCaretAfter(img);
        img.onerror = () => {
          img.style.border = '2px dashed #ff6b6b';
          img.alt = '⚠️ Image failed to load';
        };
        const wrapper = document.createElement('div');
        wrapper.appendChild(img);
        this.insertNodeUsingRange(wrapper, savedRange);
      }
    });
  }

  openTableDialog() {
    const savedRange = this.saveCurrentRange();
    this.showModal({
      title: 'Insert Table',
      fields: [
        { name: 'rows', label: 'Rows', placeholder: '2', type: 'number' },
        { name: 'cols', label: 'Columns', placeholder: '2', type: 'number' }
      ],
      onSubmit: ({ rows, cols }) => {
        const r = Math.max(1, parseInt(rows) || 2);
        const c = Math.max(1, parseInt(cols) || 2);
        const table = document.createElement('table');
        table.setAttribute('border', '1');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        for (let i = 0; i < r; i++) {
          const tr = document.createElement('tr');
          for (let j = 0; j < c; j++) {
            const td = document.createElement('td');
            td.style.border = '1px solid #999';
            td.style.padding = '6px';
            td.innerHTML = '\u200B';
            tr.appendChild(td);
          }
          table.appendChild(tr);
        }
        this.insertNodeUsingRange(table, savedRange);
      }
    });
  }

  openEmbedDialog() {
    const savedRange = this.saveCurrentRange();
    this.showModal({
      title: 'Embed Content',
      fields: [{ name: 'url', label: 'URL (e.g., YouTube, Vimeo)', placeholder: 'https://...' }],
      onSubmit: ({ url }) => {
        if (!url) return;
        let embed = null;
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (ytMatch) {
          embed = document.createElement('iframe');
          embed.src = `https://www.youtube.com/embed/${ytMatch[1]}`;
          embed.width = '560';
          embed.height = '315';
          embed.setAttribute('frameborder', '0');
          embed.setAttribute('allowfullscreen', '');
        } else if (/vimeo\.com\/(\d+)/.test(url)) {
          const vimeoId = url.match(/vimeo\.com\/(\d+)/)[1];
          embed = document.createElement('iframe');
          embed.src = `https://player.vimeo.com/video/${vimeoId}`;
          embed.width = '560';
          embed.height = '315';
          embed.setAttribute('frameborder', '0');
          embed.setAttribute('allowfullscreen', '');
        } else {
          embed = document.createElement('iframe');
          embed.src = url;
          embed.width = '100%';
          embed.height = '400';
          embed.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
        }
        if (embed) {
          embed.style.display = 'block';
          embed.style.margin = '12px 0';
          const wrapper = document.createElement('div');
          wrapper.appendChild(embed);
          this.insertNodeUsingRange(wrapper, savedRange);
        }
      }
    });
  }

  // ========== EXPORT ==========
  exportNote() {
    if (!this.currentNoteId) return;
    const title = this.titleInput.value || 'note';
    const format = this.exportSelect.value;
    const content = this.editor.innerHTML;

    if (format === 'pdf') {
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font: 16px Arial; padding: 20px; line-height: 1.4; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #999; padding: 8px; }
            p, h1, h2, blockquote { margin: 0 0 12px 0; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>${content}</body>
        </html>
      `;
      const win = this.printFrame.contentWindow;
      win.document.open();
      win.document.write(printContent);
      win.document.close();
      win.focus();
      win.print();
      return;
    }

    const blob = new Blob(
      [format === 'txt' ? this.editor.innerText : content],
      { type: format === 'txt' ? 'text/plain' : 'text/html' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.${format}`;
    a.click();
  }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CopyTool();
  window.app.init();
});
