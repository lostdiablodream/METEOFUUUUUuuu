import { fetchJSON } from './api.js';

let nextId = 0;

// Безопасное создание DOM-узлов: текст только через textContent,
// недоверенные данные API никогда не проходят через innerHTML.
export function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

// Базовый (абстрактный) класс для всех виджетов панели.
export class UIComponent {
  constructor({ id, title } = {}) {
    if (new.target === UIComponent) {
      throw new Error('UIComponent — абстрактный класс, создавайте наследников');
    }
    this.id = id ?? `widget-${++nextId}`;
    this.title = title ?? 'Виджет';
    this.element = null;
    this.contentElement = null;
    this.bodyElement = null; // если задан — состояния рисуются в него, а не в contentElement
    this.minimized = false;
    this.onClose = null; // колбэк назначает Dashboard
    this._listeners = []; // { target, type, handler, options } для корректного destroy()
    this._intervals = new Set();
    this._abortController = null;
  }

  // Каркас виджета: заголовок, кнопки «свернуть»/«закрыть», контейнер контента.
  render() {
    this.element = createElement('section', 'widget');
    this.element.dataset.widgetId = this.id;

    const header = createElement('header', 'widget__header');
    const title = createElement('h2', 'widget__title', this.title);
    title.id = `${this.id}-title`;
    this.element.setAttribute('aria-labelledby', title.id);

    const controls = createElement('div', 'widget__controls');
    this._minimizeButton = createElement('button', 'widget__btn', '−');
    this._minimizeButton.type = 'button';
    this._minimizeButton.setAttribute('aria-label', `Свернуть виджет «${this.title}»`);
    this._minimizeButton.setAttribute('aria-pressed', 'false');
    this._listen(this._minimizeButton, 'click', () => this.toggleMinimize());

    const closeButton = createElement('button', 'widget__btn widget__btn--close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', `Закрыть виджет «${this.title}»`);
    this._listen(closeButton, 'click', () => this.close());

    controls.append(this._minimizeButton, closeButton);
    header.append(title, controls);

    this.contentElement = createElement('div', 'widget__content');
    this.contentElement.setAttribute('aria-live', 'polite');

    this.element.append(header, this.contentElement);
    return this.element;
  }

  // Хук: вызывается Dashboard после вставки в DOM (загрузка данных, таймеры).
  mount() {}

  toggleMinimize() {
    this.minimized = !this.minimized;
    this.element.classList.toggle('widget--minimized', this.minimized);
    this._minimizeButton.setAttribute('aria-pressed', String(this.minimized));
    this._minimizeButton.textContent = this.minimized ? '+' : '−';
  }

  close() {
    if (typeof this.onClose === 'function') {
      this.onClose(this.id); // Dashboard вызовет removeWidget -> destroy()
    } else {
      this.destroy();
    }
  }

  // Корректное удаление: слушатели, интервалы, незавершённые запросы, DOM.
  destroy() {
    this._abortController?.abort();
    for (const intervalId of this._intervals) clearInterval(intervalId);
    this._intervals.clear();
    for (const { target, type, handler, options } of this._listeners) {
      target.removeEventListener(type, handler, options);
    }
    this._listeners = [];
    this.element?.remove();
    this.element = null;
  }

  // --- protected-хелперы для наследников ---

  _listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push({ target, type, handler, options });
  }

  _setInterval(callback, ms) {
    const intervalId = setInterval(callback, ms);
    this._intervals.add(intervalId);
    return intervalId;
  }

  // Каждый новый запрос отменяет предыдущий (устаревший ответ не придёт).
  _request(url, options = {}) {
    this._abortController?.abort();
    this._abortController = new AbortController();
    return fetchJSON(url, { ...options, signal: this._abortController.signal });
  }

  _stateContainer() {
    return this.bodyElement ?? this.contentElement;
  }

  _setState(...nodes) {
    this._stateContainer().replaceChildren(...nodes);
  }

  showLoading(text = 'Загрузка…') {
    const box = createElement('div', 'widget__status widget__status--loading');
    box.append(createElement('span', 'spinner'), createElement('span', '', text));
    this._setState(box);
  }

  showEmpty(text) {
    this._setState(createElement('div', 'widget__status widget__status--empty', text));
  }

  showError(message, onRetry) {
    const box = createElement('div', 'widget__status widget__status--error');
    box.setAttribute('role', 'alert');
    box.append(createElement('span', '', message));
    if (typeof onRetry === 'function') {
      const retryButton = createElement('button', 'btn btn--small btn--secondary', 'Повторить');
      retryButton.type = 'button';
      this._listen(retryButton, 'click', onRetry);
      box.append(retryButton);
    }
    this._setState(box);
  }

  _isAbort(error) {
    return error?.name === 'AbortError';
  }
}
