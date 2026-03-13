const elements = {
  productName: document.getElementById('productName'),
  cost: document.getElementById('cost'),
  extraCost: document.getElementById('extraCost'),
  margin: document.getElementById('margin'),
  shopeeFee: document.getElementById('shopeeFee'),
  mlFee: document.getElementById('mlFee'),
  shippingCost: document.getElementById('shippingCost'),
  shippingToggle: document.getElementById('shippingToggle'),
  psychologicalToggle: document.getElementById('psychologicalToggle'),
  shippingField: document.getElementById('shippingField'),
  totalCost: document.getElementById('totalCost'),
  marginTarget: document.getElementById('marginTarget'),
  shippingStatus: document.getElementById('shippingStatus'),
  shopeeBadge: document.getElementById('shopeeBadge'),
  mlBadge: document.getElementById('mlBadge'),
  shopeePrice: document.getElementById('shopeePrice'),
  mlPrice: document.getElementById('mlPrice'),
  shopeeNet: document.getElementById('shopeeNet'),
  mlNet: document.getElementById('mlNet'),
  shopeeProfit: document.getElementById('shopeeProfit'),
  mlProfit: document.getElementById('mlProfit'),
  shopeeRealMargin: document.getElementById('shopeeRealMargin'),
  mlRealMargin: document.getElementById('mlRealMargin'),
  shopeeProductTitle: document.getElementById('shopeeProductTitle'),
  mlProductTitle: document.getElementById('mlProductTitle'),
  saveSimulationBtn: document.getElementById('saveSimulationBtn'),
  historyBody: document.getElementById('historyBody'),
  clearBtn: document.getElementById('clearBtn')
};

let includeShipping = true;
let psychologicalPrice = true;
let history = JSON.parse(localStorage.getItem('taylortech_marketplace_history') || '[]');

const currency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(Number(value || 0));

const numberValue = (value) => Number(value || 0);

function calculatePrice(baseCost, feePercent, marginPercent) {
  const fee = feePercent / 100;
  const margin = marginPercent / 100;
  const denominator = 1 - fee - margin;
  if (denominator <= 0) return 0;
  return baseCost / denominator;
}

function toPsychologicalPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const integerPart = Math.floor(value);
  return Number((integerPart + 0.9).toFixed(2));
}

function getState() {
  const productName = elements.productName.value.trim() || 'Peça sem nome';
  const cost = numberValue(elements.cost.value);
  const extraCost = numberValue(elements.extraCost.value);
  const margin = numberValue(elements.margin.value);
  const shopeeFee = numberValue(elements.shopeeFee.value);
  const mlFee = numberValue(elements.mlFee.value);
  const shippingCost = includeShipping ? numberValue(elements.shippingCost.value) : 0;
  const totalCost = cost + extraCost + shippingCost;

  let shopeePrice = calculatePrice(totalCost, shopeeFee, margin);
  let mlPrice = calculatePrice(totalCost, mlFee, margin);

  if (psychologicalPrice) {
    shopeePrice = toPsychologicalPrice(shopeePrice);
    mlPrice = toPsychologicalPrice(mlPrice);
  }

  const shopeeNet = shopeePrice * (1 - shopeeFee / 100);
  const mlNet = mlPrice * (1 - mlFee / 100);
  const shopeeProfit = shopeeNet - totalCost;
  const mlProfit = mlNet - totalCost;
  const shopeeRealMargin = shopeePrice > 0 ? (shopeeProfit / shopeePrice) * 100 : 0;
  const mlRealMargin = mlPrice > 0 ? (mlProfit / mlPrice) * 100 : 0;

  return {
    productName,
    cost,
    extraCost,
    margin,
    shopeeFee,
    mlFee,
    shippingCost,
    totalCost,
    shopeePrice,
    mlPrice,
    shopeeNet,
    mlNet,
    shopeeProfit,
    mlProfit,
    shopeeRealMargin,
    mlRealMargin
  };
}

function updateUI() {
  const state = getState();
  elements.totalCost.textContent = currency(state.totalCost);
  elements.marginTarget.textContent = `${state.margin.toFixed(0)}%`;
  elements.shippingStatus.textContent = includeShipping ? 'Sim' : 'Não';
  elements.shopeeBadge.textContent = `Taxa ${state.shopeeFee.toFixed(0)}%`;
  elements.mlBadge.textContent = `Taxa ${state.mlFee.toFixed(0)}%`;
  elements.shopeePrice.textContent = currency(state.shopeePrice);
  elements.mlPrice.textContent = currency(state.mlPrice);
  elements.shopeeNet.textContent = currency(state.shopeeNet);
  elements.mlNet.textContent = currency(state.mlNet);
  elements.shopeeProfit.textContent = currency(state.shopeeProfit);
  elements.mlProfit.textContent = currency(state.mlProfit);
  elements.shopeeRealMargin.textContent = `${state.shopeeRealMargin.toFixed(2)}%`;
  elements.mlRealMargin.textContent = `${state.mlRealMargin.toFixed(2)}%`;
  elements.shopeeProductTitle.textContent = state.productName;
  elements.mlProductTitle.textContent = state.productName;
  elements.shippingField.style.display = includeShipping ? 'grid' : 'none';
}

function saveHistory() {
  localStorage.setItem('taylortech_marketplace_history', JSON.stringify(history));
}

function renderHistory() {
  if (!history.length) {
    elements.historyBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">Nenhuma simulação salva ainda.</td>
      </tr>
    `;
    return;
  }

  elements.historyBody.innerHTML = history.map((item, index) => `
    <tr>
      <td>${item.productName}</td>
      <td>${currency(item.totalCost)}</td>
      <td>${currency(item.shopeePrice)}</td>
      <td>${currency(item.mlPrice)}</td>
      <td>${currency(item.shopeeProfit)}</td>
      <td>${currency(item.mlProfit)}</td>
      <td><button class="action-btn" data-remove-index="${index}">Remover</button></td>
    </tr>
  `).join('');
}

function saveSimulation() {
  const state = getState();
  if (!state.totalCost) {
    alert('Preencha pelo menos o valor de compra da peça para salvar a simulação.');
    return;
  }

  history.unshift(state);
  history = history.slice(0, 30);
  saveHistory();
  renderHistory();
}

function clearForm() {
  elements.productName.value = '';
  elements.cost.value = '';
  elements.extraCost.value = '';
  elements.margin.value = '40';
  elements.shopeeFee.value = '20';
  elements.mlFee.value = '13';
  elements.shippingCost.value = '';
  includeShipping = true;
  psychologicalPrice = true;
  elements.shippingToggle.classList.add('active');
  elements.shippingToggle.setAttribute('aria-pressed', 'true');
  elements.psychologicalToggle.classList.add('active');
  elements.psychologicalToggle.setAttribute('aria-pressed', 'true');
  updateUI();
}

[
  elements.productName,
  elements.cost,
  elements.extraCost,
  elements.margin,
  elements.shopeeFee,
  elements.mlFee,
  elements.shippingCost
].forEach((input) => {
  input.addEventListener('input', updateUI);
});

elements.shippingToggle.addEventListener('click', () => {
  includeShipping = !includeShipping;
  elements.shippingToggle.classList.toggle('active', includeShipping);
  elements.shippingToggle.setAttribute('aria-pressed', String(includeShipping));
  updateUI();
});

elements.psychologicalToggle.addEventListener('click', () => {
  psychologicalPrice = !psychologicalPrice;
  elements.psychologicalToggle.classList.toggle('active', psychologicalPrice);
  elements.psychologicalToggle.setAttribute('aria-pressed', String(psychologicalPrice));
  updateUI();
});

document.querySelectorAll('.preset-btn[data-margin]').forEach((button) => {
  button.addEventListener('click', () => {
    elements.margin.value = button.dataset.margin;
    elements.shopeeFee.value = button.dataset.shopee;
    elements.mlFee.value = button.dataset.ml;
    updateUI();
  });
});

elements.saveSimulationBtn.addEventListener('click', saveSimulation);

elements.clearBtn.addEventListener('click', clearForm);

elements.historyBody.addEventListener('click', (event) => {
  const target = event.target;
  const index = target.getAttribute('data-remove-index');
  if (index === null) return;
  history.splice(Number(index), 1);
  saveHistory();
  renderHistory();
});

renderHistory();
updateUI();
