const STORAGE_KEY = 'taylortech_marketplace_products_v1';
const MODE_KEY = 'taylortech_marketplace_mode_v1';

const state = {
  psychological: localStorage.getItem(MODE_KEY) !== 'exact',
  products: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
};

const elements = {
  navItems: document.querySelectorAll('.nav__item'),
  panels: document.querySelectorAll('.panel-group'),
  productName: document.getElementById('productName'),
  cost: document.getElementById('cost'),
  extraCost: document.getElementById('extraCost'),
  shippingCost: document.getElementById('shippingCost'),
  desiredMargin: document.getElementById('desiredMargin'),
  shopeeFee: document.getElementById('shopeeFee'),
  mlFee: document.getElementById('mlFee'),
  form: document.getElementById('pricingForm'),
  simulateBtn: document.getElementById('simulateBtn'),
  resetBtn: document.getElementById('resetBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  psychologicalToggle: document.getElementById('psychologicalToggle'),
  searchProducts: document.getElementById('searchProducts'),
  productsList: document.getElementById('productsList'),
  recentProducts: document.getElementById('recentProducts'),
  barChart: document.getElementById('barChart'),
  statCurrentProfit: document.getElementById('statCurrentProfit'),
  statProductsCount: document.getElementById('statProductsCount'),
  statBestPlatform: document.getElementById('statBestPlatform'),
  statMargin: document.getElementById('statMargin'),
  shopeePrice: document.getElementById('shopeePrice'),
  shopeeNet: document.getElementById('shopeeNet'),
  shopeeProfit: document.getElementById('shopeeProfit'),
  shopeeRealMargin: document.getElementById('shopeeRealMargin'),
  mlPrice: document.getElementById('mlPrice'),
  mlNet: document.getElementById('mlNet'),
  mlProfit: document.getElementById('mlProfit'),
  mlRealMargin: document.getElementById('mlRealMargin'),
  totalCost: document.getElementById('totalCost'),
  bestPlatform: document.getElementById('bestPlatform'),
  bestProfit: document.getElementById('bestProfit'),
  priceModeText: document.getElementById('priceModeText')
};

function brl(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value || 0));
}

function numberValue(input) {
  return Number(input.value || 0);
}

function psychologicalPrice(value) {
  if (!isFinite(value) || value <= 0) return 0;
  return Number((Math.floor(value) + 0.9).toFixed(2));
}

function calculatePrice(cost, feePercent, marginPercent) {
  const fee = feePercent / 100;
  const margin = marginPercent / 100;
  const denominator = 1 - fee - margin;
  if (denominator <= 0) return 0;
  return cost / denominator;
}

function getSimulation() {
  const totalCost = numberValue(elements.cost) + numberValue(elements.extraCost) + numberValue(elements.shippingCost);
  const desiredMargin = numberValue(elements.desiredMargin);
  const shopeeFee = numberValue(elements.shopeeFee);
  const mlFee = numberValue(elements.mlFee);

  const rawShopee = calculatePrice(totalCost, shopeeFee, desiredMargin);
  const rawMl = calculatePrice(totalCost, mlFee, desiredMargin);

  const shopeePrice = state.psychological ? psychologicalPrice(rawShopee) : Number(rawShopee.toFixed(2));
  const mlPrice = state.psychological ? psychologicalPrice(rawMl) : Number(rawMl.toFixed(2));

  const shopeeNet = shopeePrice * (1 - shopeeFee / 100);
  const mlNet = mlPrice * (1 - mlFee / 100);
  const shopeeProfit = shopeeNet - totalCost;
  const mlProfit = mlNet - totalCost;
  const shopeeRealMargin = shopeePrice ? (shopeeProfit / shopeePrice) * 100 : 0;
  const mlRealMargin = mlPrice ? (mlProfit / mlPrice) * 100 : 0;

  const bestPlatform = shopeeProfit >= mlProfit ? 'Shopee' : 'Mercado Livre';
  const bestProfit = Math.max(shopeeProfit, mlProfit);

  return {
    productName: elements.productName.value.trim() || 'Produto sem nome',
    totalCost,
    desiredMargin,
    shopeeFee,
    mlFee,
    shopeePrice,
    mlPrice,
    shopeeNet,
    mlNet,
    shopeeProfit,
    mlProfit,
    shopeeRealMargin,
    mlRealMargin,
    bestPlatform,
    bestProfit,
    createdAt: new Date().toISOString()
  };
}

function updateSimulationUI() {
  const sim = getSimulation();
  elements.shopeePrice.textContent = brl(sim.shopeePrice);
  elements.shopeeNet.textContent = brl(sim.shopeeNet);
  elements.shopeeProfit.textContent = brl(sim.shopeeProfit);
  elements.shopeeRealMargin.textContent = `${sim.shopeeRealMargin.toFixed(2)}%`;

  elements.mlPrice.textContent = brl(sim.mlPrice);
  elements.mlNet.textContent = brl(sim.mlNet);
  elements.mlProfit.textContent = brl(sim.mlProfit);
  elements.mlRealMargin.textContent = `${sim.mlRealMargin.toFixed(2)}%`;

  elements.totalCost.textContent = brl(sim.totalCost);
  elements.bestPlatform.textContent = sim.bestPlatform;
  elements.bestProfit.textContent = brl(sim.bestProfit);
  elements.priceModeText.textContent = state.psychological ? 'Psicológico' : 'Exato';

  elements.statCurrentProfit.textContent = brl(sim.bestProfit);
  elements.statBestPlatform.textContent = sim.bestPlatform;
  elements.statMargin.textContent = `${sim.desiredMargin}%`;
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
}

function renderRecentProducts() {
  const recent = state.products.slice(0, 5);
  if (!recent.length) {
    elements.recentProducts.innerHTML = '<div class="empty-state">Nenhum produto salvo ainda.</div>';
    return;
  }

  elements.recentProducts.innerHTML = recent.map(item => `
    <article class="list__item">
      <div class="list__header">
        <strong>${item.productName}</strong>
        <span class="badge">${item.bestPlatform}</span>
      </div>
      <div class="list__meta">
        <span>Shopee: <b>${brl(item.shopeePrice)}</b></span>
        <span>ML: <b>${brl(item.mlPrice)}</b></span>
      </div>
    </article>
  `).join('');
}

function renderProductsList() {
  const term = elements.searchProducts.value.trim().toLowerCase();
  const items = state.products.filter(item => item.productName.toLowerCase().includes(term));

  if (!items.length) {
    elements.productsList.innerHTML = '<div class="empty-state">Nenhum produto encontrado.</div>';
    return;
  }

  elements.productsList.innerHTML = items.map(item => `
    <article class="product-row">
      <div class="product-row__header">
        <div>
          <strong>${item.productName}</strong>
          <div class="product-row__meta">
            <span>Custo total: <b>${brl(item.totalCost)}</b></span>
            <span>Melhor: <b>${item.bestPlatform}</b></span>
          </div>
        </div>
        <span class="badge">${new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
      </div>

      <div class="product-row__prices">
        <div class="price-chip">
          <span>Shopee</span>
          <b>${brl(item.shopeePrice)}</b>
        </div>
        <div class="price-chip">
          <span>Mercado Livre</span>
          <b>${brl(item.mlPrice)}</b>
        </div>
        <div class="price-chip">
          <span>Lucro melhor</span>
          <b>${brl(item.bestProfit)}</b>
        </div>
      </div>

      <div class="row-actions">
        <button class="delete-btn" data-id="${item.createdAt}">Excluir</button>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', () => {
      state.products = state.products.filter(item => item.createdAt !== button.dataset.id);
      saveProducts();
      renderAll();
    });
  });
}

function renderChart() {
  const items = state.products.slice(0, 6).reverse();
  if (!items.length) {
    elements.barChart.innerHTML = '<div class="empty-state">Salve produtos para ver o gráfico.</div>';
    return;
  }

  const maxProfit = Math.max(...items.map(item => Math.max(item.shopeeProfit, item.mlProfit)), 1);
  elements.barChart.innerHTML = items.map(item => {
    const shopeeHeight = Math.max((item.shopeeProfit / maxProfit) * 220, 14);
    const mlHeight = Math.max((item.mlProfit / maxProfit) * 220, 14);
    return `
      <div class="bar-group">
        <div class="bar-group__bars">
          <div class="bar bar--green" style="height:${shopeeHeight}px" title="Shopee ${brl(item.shopeeProfit)}"></div>
          <div class="bar bar--yellow" style="height:${mlHeight}px" title="Mercado Livre ${brl(item.mlProfit)}"></div>
        </div>
        <div class="bar-group__label">${item.productName}</div>
      </div>
    `;
  }).join('');
}

function renderStats() {
  elements.statProductsCount.textContent = state.products.length;
}

function renderAll() {
  updateSimulationUI();
  renderRecentProducts();
  renderProductsList();
  renderChart();
  renderStats();
}

function resetForm() {
  elements.productName.value = '';
  elements.cost.value = 0;
  elements.extraCost.value = 0;
  elements.shippingCost.value = 0;
  elements.desiredMargin.value = 40;
  elements.shopeeFee.value = 20;
  elements.mlFee.value = 13;
  renderAll();
}

function saveCurrentProduct() {
  const simulation = getSimulation();
  state.products.unshift(simulation);
  saveProducts();
  renderAll();
}

function exportJSON() {
  if (!state.products.length) return;
  const blob = new Blob([JSON.stringify(state.products, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'taylortech-marketplace-produtos.json';
  link.click();
  URL.revokeObjectURL(url);
}

function setPsychologicalMode(active) {
  state.psychological = active;
  localStorage.setItem(MODE_KEY, active ? 'psychological' : 'exact');
  elements.psychologicalToggle.classList.toggle('toggle--on', active);
  elements.psychologicalToggle.setAttribute('aria-pressed', String(active));
  renderAll();
}

function setupNavigation() {
  elements.navItems.forEach(button => {
    button.addEventListener('click', () => {
      elements.navItems.forEach(item => item.classList.remove('nav__item--active'));
      elements.panels.forEach(panel => panel.classList.remove('active'));
      button.classList.add('nav__item--active');
      document.getElementById(button.dataset.target).classList.add('active');
    });
  });
}

function setupEvents() {
  [
    elements.cost,
    elements.extraCost,
    elements.shippingCost,
    elements.desiredMargin,
    elements.shopeeFee,
    elements.mlFee,
    elements.productName
  ].forEach(input => input.addEventListener('input', renderAll));

  elements.form.addEventListener('submit', event => {
    event.preventDefault();
    saveCurrentProduct();
  });

  elements.simulateBtn.addEventListener('click', renderAll);
  elements.resetBtn.addEventListener('click', resetForm);
  elements.exportJsonBtn.addEventListener('click', exportJSON);
  elements.clearHistoryBtn.addEventListener('click', () => {
    state.products = [];
    saveProducts();
    renderAll();
  });
  elements.psychologicalToggle.addEventListener('click', () => setPsychologicalMode(!state.psychological));
  elements.searchProducts.addEventListener('input', renderProductsList);
}

setPsychologicalMode(state.psychological);
setupNavigation();
setupEvents();
renderAll();
