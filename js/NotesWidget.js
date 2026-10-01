import { UIComponent, createElement } from './UIComponent.js';

// «Дневник наблюдений»: CRUD против собственного mock-API (/api/notes, db.json).
// Данные — свойство класса, логика инкапсулирована.
export class NotesWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: config.title ?? 'Дневник наблюдений' });
    this.apiUrl = config.apiUrl ?? '/api/notes';
    this.notes = [];
  }

  render() {
    const element = super.render();

    const form = createElement('form', 'notes__form');
    this._input = createElement('input', 'input');
    this._input.type = 'text';
    this._input.name = 'text';
    this._input.placeholder = 'Новое наблюдение…';
    this._input.maxLength = 200;
    this._input.required = true;
    this._input.setAttribute('aria-label', 'Текст наблюдения');
    this._input.setAttribute('autocomplete', 'off');
    this._input.setAttribute('spellcheck', 'false');

    this._addButton = createElement('button', 'btn', 'Добавить');
    this._addButton.type = 'submit';
    form.append(this._input, this._addButton);
    this._listen(form, 'submit', (event) => {
      event.preventDefault();
      this.addNote(this._input.value);
    });

    this._formError = createElement('p', 'notes__error');
    this._formError.setAttribute('role', 'alert');
    this._formError.hidden = true;

    this.bodyElement = createElement('div', 'widget__body');
    // Делегирование: один слушатель на список вместо слушателя на каждый пункт.
    this._listen(this.bodyElement, 'click', (event) => this._onBodyClick(event));
    this._listen(this.bodyElement, 'change', (event) => this._onBodyChange(event));

    this.contentElement.append(form, this._formError, this.bodyElement);
    return element;
  }

  mount() {
    this.load();
  }

  async load() {
    this.showLoading('Загружаем записи…');
    try {
      const data = await this._request(this.apiUrl);
      this.notes = Array.isArray(data) ? data.filter((n) => n && typeof n === 'object') : [];
      this._renderList();
    } catch (error) {
      if (this._isAbort(error)) return;
      this.showError('Не удалось загрузить наблюдения.', () => this.load());
    }
  }

  async addNote(text) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return;
    this._clearFormError();
    this._addButton.disabled = true; // защита от повторной отправки
    try {
      await this._request(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      this._input.value = '';
      await this.load();
    } catch (error) {
      if (!this._isAbort(error)) {
        this._showFormError('Не удалось добавить запись. Попробуйте ещё раз.');
      }
    } finally {
      this._addButton.disabled = false;
    }
  }

  async toggleNote(id, done) {
    try {
      await this._request(`${this.apiUrl}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });
      const note = this.notes.find((n) => n.id === id);
      if (note) {
        note.done = done;
        this._renderList();
      }
    } catch (error) {
      if (this._isAbort(error)) return;
      this._showFormError('Не удалось обновить запись.');
      this._renderList(); // вернуть чекбокс в исходное состояние
    }
  }

  async deleteNote(id) {
    try {
      await this._request(`${this.apiUrl}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      this.notes = this.notes.filter((n) => n.id !== id);
      this._renderList();
    } catch (error) {
      if (this._isAbort(error)) return;
      this._showFormError('Не удалось удалить запись.');
    }
  }

  _onBodyClick(event) {
    const button = event.target.closest('[data-action="delete"]');
    if (button && this.bodyElement.contains(button)) {
      this.deleteNote(button.dataset.id);
    }
  }

  _onBodyChange(event) {
    const checkbox = event.target.closest('[data-action="toggle"]');
    if (checkbox && this.bodyElement.contains(checkbox)) {
      this.toggleNote(checkbox.dataset.id, checkbox.checked);
    }
  }

  _renderList() {
    if (this.notes.length === 0) {
      this.showEmpty('Пока нет записей — добавьте первое наблюдение.');
      return;
    }
    const list = createElement('ul', 'notes__list');
    for (const note of this.notes) {
      const item = createElement('li', `notes__item${note.done ? ' notes__item--done' : ''}`);

      const checkbox = createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(note.done);
      checkbox.dataset.action = 'toggle';
      checkbox.dataset.id = note.id;
      checkbox.setAttribute('aria-label', 'Отметить выполненным');

      const text = createElement('span', 'notes__item-text', note.text);

      const deleteButton = createElement('button', 'widget__btn widget__btn--close', '×');
      deleteButton.type = 'button';
      deleteButton.dataset.action = 'delete';
      deleteButton.dataset.id = note.id;
      deleteButton.setAttribute('aria-label', `Удалить запись «${String(note.text).slice(0, 40)}»`);

      item.append(checkbox, text, deleteButton);
      list.append(item);
    }
    this._setState(list);
  }

  _showFormError(message) {
    this._formError.textContent = message;
    this._formError.hidden = false;
  }

  _clearFormError() {
    this._formError.textContent = '';
    this._formError.hidden = true;
  }
}
