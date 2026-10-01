import { WeatherWidget } from './WeatherWidget.js';
import { AirQualityWidget } from './AirQualityWidget.js';
import { NotesWidget } from './NotesWidget.js';
import { QuoteWidget } from './QuoteWidget.js';
import { createElement } from './UIComponent.js';

// Реестр типов: добавление нового виджета = одна строка здесь (open/closed).
const WIDGET_TYPES = {
  weather: () => new WeatherWidget(),
  air: () => new AirQualityWidget(),
  notes: () => new NotesWidget(),
  quote: () => new QuoteWidget(),
};

export class Dashboard {
  constructor(container) {
    if (!container) {
      throw new Error('Dashboard: контейнер не найден в DOM');
    }
    this.container = container;
    this.widgets = new Map(); // id -> экземпляр UIComponent

    this._emptyElement = createElement(
      'p',
      'dashboard__empty',
      'Панель пуста — добавьте виджет кнопками выше.',
    );
    this._updateEmptyState();
  }

  static get availableTypes() {
    return Object.keys(WIDGET_TYPES);
  }

  addWidget(type) {
    const create = WIDGET_TYPES[type];
    if (!create) {
      console.warn(`Dashboard: неизвестный тип виджета «${type}»`);
      return null;
    }
    const widget = create();
    widget.onClose = (id) => this.removeWidget(id);
    this.widgets.set(widget.id, widget);
    this.container.append(widget.render());
    widget.mount();
    this._updateEmptyState();
    return widget;
  }

  removeWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;
    widget.destroy();
    this.widgets.delete(widgetId);
    this._updateEmptyState();
    return true;
  }

  get count() {
    return this.widgets.size;
  }

  _updateEmptyState() {
    if (this.widgets.size === 0) {
      this.container.append(this._emptyElement);
    } else {
      this._emptyElement.remove();
    }
  }
}
