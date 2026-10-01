import { UIComponent, createElement } from './UIComponent.js';

const CITIES = [
  { name: 'Москва', lat: 55.7558, lon: 37.6173 },
  { name: 'Санкт-Петербург', lat: 59.9343, lon: 30.3351 },
  { name: 'Новосибирск', lat: 55.0084, lon: 82.9357 },
  { name: 'Сочи', lat: 43.5855, lon: 39.7231 },
  { name: 'Мурманск', lat: 68.9585, lon: 33.0827 },
];

// WMO weather codes -> описание.
const WEATHER_CODES = {
  0: 'Ясно', 1: 'Преимущественно ясно', 2: 'Переменная облачность', 3: 'Пасмурно',
  45: 'Туман', 48: 'Изморозь',
  51: 'Морось', 53: 'Морось', 55: 'Сильная морось',
  61: 'Небольшой дождь', 63: 'Дождь', 65: 'Сильный дождь',
  66: 'Ледяной дождь', 67: 'Ледяной дождь',
  71: 'Небольшой снег', 73: 'Снег', 75: 'Сильный снег', 77: 'Снежная крупа',
  80: 'Ливень', 81: 'Ливень', 82: 'Сильный ливень',
  85: 'Снегопад', 86: 'Сильный снегопад',
  95: 'Гроза', 96: 'Гроза с градом', 99: 'Гроза с градом',
};

const COMPASS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];

// Единицы отбиваются неразрывным пробелом (кроме градуса — он пишется слитно).
const fmtNumber = (value, unit = '') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const rounded = `${Math.round(value)}`;
  return unit === '' || unit === '°' ? `${rounded}${unit}` : `${rounded}\u00A0${unit}`;
};

const windDirection = (deg) =>
  typeof deg === 'number' && Number.isFinite(deg) ? COMPASS[Math.round(deg / 45) % 8] : '';

// Виджет погоды: сторонний API Open-Meteo (без ключа).
export class WeatherWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: config.title ?? 'Погода' });
    this.city = config.city ?? CITIES[0];
    this.refreshIntervalMs = config.refreshIntervalMs ?? 10 * 60 * 1000;
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
    this.showLoading('Загружаем прогноз…');
    const { lat, lon } = this.city;
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '3',
      timezone: 'auto',
    });
    try {
      const data = await this._request(`https://api.open-meteo.com/v1/forecast?${params}`);
      this._renderWeather(data);
    } catch (error) {
      if (this._isAbort(error)) return; // запрос отменён новым запросом или destroy()
      this.showError('Не удалось получить данные о погоде.', () => this.load());
    }
  }

  _renderWeather(data) {
    const current = data?.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      this.showEmpty('Нет данных по выбранному городу.');
      return;
    }

    const wrap = createElement('div', 'weather');

    const now = createElement('div', 'weather__current');
    now.append(
      createElement('span', 'weather__temp', `${Math.round(current.temperature_2m)}°`),
      createElement('span', 'weather__desc', WEATHER_CODES[current.weather_code] ?? '—'),
    );

    const details = createElement('dl', 'weather__details');
    const addDetail = (label, value) => {
      details.append(createElement('dt', '', label), createElement('dd', '', value));
    };
    addDetail('Ощущается как', fmtNumber(current.apparent_temperature, '°'));
    addDetail('Влажность', fmtNumber(current.relative_humidity_2m, '%'));
    addDetail('Ветер', `${fmtNumber(current.wind_speed_10m, ' км/ч')} ${windDirection(current.wind_direction_10m)}`.trim());
    addDetail('Вероятность осадков', fmtNumber(data?.daily?.precipitation_probability_max?.[0], '%'));

    wrap.append(now, details, this._renderForecast(data?.daily), createElement(
      'p',
      'weather__updated',
      `Обновлено: ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
    ));
    this._setState(wrap);
  }

  _renderForecast(daily) {
    const list = createElement('ul', 'weather__forecast');
    const days = Array.isArray(daily?.time) ? daily.time : [];
    days.forEach((day, index) => {
      const date = new Date(`${day}T12:00:00`);
      const label = Number.isNaN(date.getTime())
        ? String(day)
        : date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
      const item = createElement('li');
      item.append(
        createElement('span', '', label),
        createElement('span', '', `${fmtNumber(daily.temperature_2m_min?.[index], '°')} … ${fmtNumber(daily.temperature_2m_max?.[index], '°')}`),
      );
      list.append(item);
    });
    return list;
  }
}
