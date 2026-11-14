import './styles/main.css';
import { mountPoolOptimizer } from './pool-widget.js';
import { startUpdateNotifier } from './update-notifier.js';

const app = document.querySelector('#pool-app');

mountPoolOptimizer(app, {
  embedded: false,
});

startUpdateNotifier();
