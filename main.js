import { Dashboard } from './js/Dashboard.js';

const dashboard = new Dashboard(document.getElementById('dashboard'));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Кнопки тулбара делегируют создание виджетов дашборду — полиморфизм по типу.
document.querySelectorAll('[data-add-widget]').forEach((button) => {
  button.addEventListener('click', () => {
    const widget = dashboard.addWidget(button.dataset.addWidget);
    if (widget) {
      widget.element.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }
  });
});

// Стартовый набор виджетов.
dashboard.addWidget('weather');
dashboard.addWidget('air');
dashboard.addWidget('notes');
dashboard.addWidget('quote');
