import { UIComponent, createElement } from './UIComponent.js';

const QUOTES = [
  { text: 'Нет плохой погоды, есть плохая одежда.', author: 'Народная мудрость' },
  { text: 'Климат — это то, чего мы ожидаем, погода — то, что мы получаем.', author: 'Марк Твен' },
  { text: 'Солнце, проглянувшее сквозь дождь, — обещание радуги.', author: 'Притча' },
  { text: 'Ветер не стоит ничего, пока не наполнит паруса.', author: 'Китайская пословица' },
  { text: 'Кто изучал погоду, тот умеет ждать.', author: 'Авиационная поговорка' },
  { text: 'Гроза проходит, а небо остаётся.', author: 'Хокку' },
  { text: 'Лучший барометр — выйти на улицу.', author: 'Метеорологическая шутка' },
  { text: 'После снегопада город звучит тише.', author: 'Заметка наблюдателя' },
];

// Виджет случайной цитаты: данные хранятся в классе (локальный массив).
export class QuoteWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: config.title ?? 'Цитата о погоде' });
    this.quotes = [...QUOTES];
    this._currentIndex = -1;
  }

  render() {
    const element = super.render();

    const blockquote = createElement('blockquote', 'quote');
    this._textElement = createElement('p', 'quote__text');
    this._authorElement = createElement('footer', 'quote__author');
    blockquote.append(this._textElement, this._authorElement);

    const refreshButton = createElement('button', 'btn btn--small', 'Обновить');
    refreshButton.type = 'button';
    this._listen(refreshButton, 'click', () => this.showRandomQuote());

    this.contentElement.append(blockquote, refreshButton);
    this.showRandomQuote();
    return element;
  }

  showRandomQuote() {
    if (this.quotes.length === 0) {
      this._textElement.textContent = 'Цитаты закончились.';
      this._authorElement.textContent = '';
      return;
    }
    let index = Math.floor(Math.random() * this.quotes.length);
    if (this.quotes.length > 1 && index === this._currentIndex) {
      index = (index + 1) % this.quotes.length;
    }
    this._currentIndex = index;
    const quote = this.quotes[index];
    this._textElement.textContent = `«${quote.text}»`;
    this._authorElement.textContent = `— ${quote.author}`;
  }
}
