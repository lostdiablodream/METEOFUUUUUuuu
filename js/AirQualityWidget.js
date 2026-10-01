import { UIComponent, createElement } from './UIComponent.js';

const CITIES = [
  { name: 'Москва', lat: 55.7558, lon: 37.6173 },
  { name: 'Санкт-Петербург', lat: 59.9343, lon: 30.3351 },
  { name: 'Новосибирск', lat: 55.0084, lon: 82.9357 },
  { name: 'Сочи', lat: 43.5855, lon: 39.7231 },
  { name: 'Мурманск', lat: 68.9585, lon: 33.0827 },
];

// Диапазоны European AQI.
const AQI_LEVELS = [
  { max: 20, label: 'Хорошее', className: 'aqi__badge--good' },
  { max: 40, label: 'Приемлемое', className: 'aqi__badge--fair' },
  { max: 60, label: 'Умеренное', className: 'aqi__badge--moderate' },
  { max: 80, label: 'Плохое', className: 'aqi__badge--poor' },
  { max: 100, label: 'Очень плохое', className: 'aqi__badge--very-poor' },
  { max: Infinity, label: 'Критическое', className: 'aqi__badge--extreme' },
];

// Единицы отбиваются неразрывным пробелом.
const fmtNumber = (value, unit = '') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const rounded = `${Math.round(value)}`;
  return unit === '' ? rounded : `${rounded}\u00A0${unit}`;
};

// Виджет качества воздуха: сторонний API Open-Meteo Air Quality (без ключа).
export class AirQualityWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: config.title ?? 'Качество воздуха' });
    this.city = config.city ?? CITIES[0];
    this.refreshIntervalMs = config.refreshIntervalMs ?? 15 * 60 * 1000;
  }

  render() {
    const element = super.render();

    const toolbar = createElement('div', 'widget__toolbar');
    this._citySelect = createElement('select', 'input');
    this._citySelect.setAttribute('aria-label', 'Город');
    for (const city of CITIES) {
      const option = createElement('option', '', city.name);
      option.value = city.name;
      this._citySelect.append(option);
    }
    this._citySelect.value = this.city.name;
    this._listen(this._citySelect, 'change', () => {
      this.city = CITIES.find((c) => c.name === this._citySelect.value) ?? CITIES[0];
      this.load();
    });

    const refreshButton = createElement('button', 'btn btn--small', 'Обновить');
    refreshButton.type = 'button';
    this._listen(refreshButton, 'click', () => this.load());

    toolbar.append(this._citySelect, refreshButton);
    this.bodyElement = createElement('div', 'widget__body');
    this.contentElement.append(toolbar, this.bodyElement);
    return element;
  }

  mount() {
    this.load();
    this._setInterval(() => this.load(), this.refreshIntervalMs);
  }

  async load() {
    this.showLoading('Загружаем данные о воздухе…');
    const { lat, lon } = this.city;
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone',
      timezone: 'auto',
    });
    try {
      const data = await this._request(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
      this._renderAir(data);
    } catch (error) {
      if (this._isAbort(error)) return;
      this.showError('Не удалось получить данные о качестве воздуха.', () => this.load());
    }
  }

  _renderAir(data) {
    const current = data?.current;
    if (!current || typeof current.european_aqi !== 'number') {
      this.showEmpty('Нет данных по выбранному городу.');
      return;
    }

    const level = AQI_LEVELS.find((l) => current.european_aqi <= l.max) ?? AQI_LEVELS.at(-1);

    const wrap = createElement('div', 'aqi');
    const header = createElement('div', 'aqi__header');
    header.append(
      createElement('span', `aqi__badge ${level.className}`, fmtNumber(current.european_aqi)),
      createElement('span', 'aqi__label', `Европейский индекс (EAQI): ${level.label}`),
    );

    const pollutants = createElement('dl', 'weather__details');
    const addRow = (label, value) => {
      pollutants.append(createElement('dt', '', label), createElement('dd', '', value));
    };
    addRow('PM2.5', fmtNumber(current.pm2_5, ' мкг/м³'));
    addRow('PM10', fmtNumber(current.pm10, ' мкг/м³'));
    addRow('NO₂', fmtNumber(current.nitrogen_dioxide, ' мкг/м³'));
    addRow('Озон (O₃)', fmtNumber(current.ozone, ' мкг/м³'));

    wrap.append(header, pollutants);
    this._setState(wrap);
  }
}
