const state = {
  products: JSON.parse(localStorage.getItem('taylortech_products_v4') || '[]'),
  simulations: JSON.parse(localStorage.getItem('taylortech_simulations_v4') || '[]'),
  chart: null,
  lastResult: null,
};

const $ = (id) => document.getElementById(id);
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

const fields = {
  productName: $('productName'),
  cost: $('cost'),
  extraCost: $('extraCost'),
  desiredMargin: $('desiredMargin'),
  shopeeFee: $('shopeeFee'),
  mlFee: $('mlFee'),
  shippingCost: $('shippingCost'),
  includeShipping: $('includeShipping'),
  psychologicalPrice: $('psychologicalPrice'),
  useMlApi: $('useMlApi'),
  searchProducts: $('searchProducts'),
};

function saveLocal() {
  localStorage.setItem('taylortech_products_v4', JSON.stringify(state.products));
  localStorage.setItem('taylortech_simulations_v4', JSON.stringify(state.simulations.slice(0, 20)));
}

function getFormValues() {
  return {
    productName: fields.productName.value.trim(),
    cost: Number(fields.cost.value || 0),
    extraCost: Number(fields.extraCost.value || 0),
    desiredMargin: Number(fields.desiredMargin.value || 0),
    shopeeFee: Number(fields.shopeeFee.value || 0),
    mlFee: Number(fields.mlFee.value || 0),
    shippingCost: Number(fields.shippingCost.value || 0),
    includeShipping: fields.includeShipping.checked,
    psychologicalPrice: fields.psychologicalPrice.checked,
    useMlApi: fields.useMlApi.checked,
  };
}

function calculatePrice(baseCost, feePercent, marginPercent) {
  const fee = feePercent / 100;
  const margin = marginPercent / 100;
  const denominator = 1 - fee - margin;
  if (denominator <= 0) return 0;
  return baseCost / denominator;
}

function toPsychological(value) {
  if (!value || value <= 0) return 0;
  return Math.floor(value) + 0.9;
}

function calcNet(price, feePercent) {
  return price * (1 - feePercent / 100);
}

function calcProfit(price, feePercent, totalCost) {
  return calcNet(price, feePercent) - totalCost;
}

function calcMargin(price, feePercent, totalCost) {
  if (!price) return 0;
  return (calcProfit(price, feePercent, totalCost) / price) * 100;
}

async function fetchMercadoLivrePricing(price) {
  const url = `https://api.mercadolibre.com/sites/MLB/listing_prices?price=${encodeURIComponent(price)}`;
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error('Falha ao consultar a API do Mercado Livre.');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Resposta inesperada da API do Mercado Livre.');
  return data;
}

function getPreferredMlFee(listings) {
  if (!Array.isArray(listings) || !listings.length) return null;
  const preferredOrder = ['gold_special', 'gold_pro', 'gold_premium'];
  let selected = listings.find((item) => preferredOrder.includes(item.listing_type_id)) || listings[0];
  const saleFee = Number(selected.sale_fee_amount || 0) * 100;
  return {
    feePercent: saleFee,
    listingType: selected.listing_type_name || selected.listing_type_id,
    raw: listings,
  };
}

function renderMlApiListings(listings = [], selectedType = '') {
  const container = $('mlApiListingTypes');
  container.innerHTML = '';
  if (!listings.length) {
    container.innerHTML = '<div class="api-item"><span>Sem dados da API.</span></div>';
    return;
  }

  listings.slice(0, 4).forEach((item) => {
    const fee = Number(item.sale_fee_amount || 0) * 100;
    const div = document.createElement('div');
    div.className = 'api-item';
    div.innerHTML = `
      <span>${item.listing_type_name || item.listing_type_id}${selectedType === (item.listing_type_name || item.listing_type_id) ? ' • usado' : ''}</span>
      <strong>${formatPercent(fee)}</strong>
    `;
    container.appendChild(div);
  });
}

async function runCalculation() {
  const values = getFormValues();
  const totalCost = values.cost + values.extraCost + (values.includeShipping ? values.shippingCost : 0);

  let mlFeeUsed = values.mlFee;
  let mlListingType = 'Manual';
  let mlListings = [];
  let mlApiMode = 'Manual';

  $('mlApiStatus').textContent = 'Pronto para consultar.';
  $('mlModeTag').textContent = values.useMlApi ? 'API' : 'Manual';

  if (values.useMlApi && totalCost > 0) {
    $('mlApiStatus').textContent = 'Consultando API do Mercado Livre...';
    try {
      const listings = await fetchMercadoLivrePricing(Math.max(totalCost, 1));
      const preferred = getPreferredMlFee(listings);
      if (preferred) {
        mlFeeUsed = preferred.feePercent;
        mlListingType = preferred.listingType;
        mlListings = preferred.raw;
        mlApiMode = preferred.listingType;
        $('mlApiStatus').textContent = `Taxa obtida via API: ${preferred.listingType} (${formatPercent(preferred.feePercent)})`;
      } else {
        $('mlApiStatus').textContent = 'API respondeu, mas sem tipos de anúncio utilizáveis. Usando taxa manual.';
      }
    } catch (error) {
      $('mlApiStatus').textContent = `${error.message} Usando taxa manual.`;
    }
  } else {
    $('mlApiStatus').textContent = 'Consulta automática desativada. Usando taxa manual.';
  }

  renderMlApiListings(mlListings, mlListingType);

  let shopeePrice = calculatePrice(totalCost, values.shopeeFee, values.desiredMargin);
  let mlPrice = calculatePrice(totalCost, mlFeeUsed, values.desiredMargin);

  if (values.psychologicalPrice) {
    shopeePrice = toPsychological(shopeePrice);
    mlPrice = toPsychological(mlPrice);
  } else {
    shopeePrice = Number(shopeePrice.toFixed(2));
    mlPrice = Number(mlPrice.toFixed(2));
  }

  const shopeeNet = calcNet(shopeePrice, values.shopeeFee);
  const shopeeProfit = calcProfit(shopeePrice, values.shopeeFee, totalCost);
  const shopeeMargin = calcMargin(shopeePrice, values.shopeeFee, totalCost);

  const mlNet = calcNet(mlPrice, mlFeeUsed);
  const mlProfit = calcProfit(mlPrice, mlFeeUsed, totalCost);
  const mlMargin = calcMargin(mlPrice, mlFeeUsed, totalCost);

  const bestPlatform = mlProfit > shopeeProfit ? 'Mercado Livre' : 'Shopee';

  $('shopeePrice').textContent = formatCurrency(shopeePrice);
  $('shopeeNet').textContent = formatCurrency(shopeeNet);
  $('shopeeProfit').textContent = formatCurrency(shopeeProfit);
  $('shopeeMargin').textContent = formatPercent(shopeeMargin);
  $('shopeeFeeShow').textContent = formatPercent(values.shopeeFee);

  $('mlPrice').textContent = formatCurrency(mlPrice);
  $('mlNet').textContent = formatCurrency(mlNet);
  $('mlProfit').textContent = formatCurrency(mlProfit);
  $('mlMargin').textContent = formatPercent(mlMargin);
  $('mlFeeShow').textContent = formatPercent(mlFeeUsed);

  $('bestPlatformBadge').textContent = bestPlatform;
  $('statBestPlatform').textContent = bestPlatform;
  $('sidebarBestPlatform').textContent = bestPlatform;
  $('statApiMode').textContent = mlApiMode;

  state.lastResult = {
    id: Date.now(),
    productName: values.productName || 'Produto sem nome',
    totalCost,
    marginWanted: values.desiredMargin,
    shippingIncluded: values.includeShipping,
    shopeeFee: values.shopeeFee,
    mlFee: mlFeeUsed,
    mlListingType,
    shopeePrice,
    shopeeNet,
    shopeeProfit,
    shopeeMargin,
    mlPrice,
    mlNet,
    mlProfit,
    mlMargin,
    bestPlatform,
    date: new Date().toLocaleString('pt-BR'),
  };

  state.simulations.unshift(state.lastResult);
  state.simulations = state.simulations.slice(0, 20);
  updateStats();
  updateChart();
  saveLocal();
}

function saveCurrentProduct() {
  if (!state.lastResult) {
    alert('Calcule primeiro para salvar o produto.');
    return;
  }
  state.products.unshift({ ...state.lastResult });
  saveLocal();
  renderProducts();
  updateStats();
}

function clearForm() {
  fields.productName.value = '';
  fields.cost.value = '';
  fields.extraCost.value = '';
  fields.desiredMargin.value = '40';
  fields.shopeeFee.value = '20';
  fields.mlFee.value = '13';
  fields.shippingCost.value = '0';
  fields.includeShipping.checked = true;
  fields.psychologicalPrice.checked = true;
  fields.useMlApi.checked = true;
  $('mlApiStatus').textContent = 'Pronto para consultar.';
  $('mlApiListingTypes').innerHTML = '';
}

function exportProductsJson() {
  const blob = new Blob([JSON.stringify(state.products, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'taylortech-produtos.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf() {
  if (!state.lastResult) {
    alert('Faça um cálculo antes de exportar o PDF.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const r = state.lastResult;

  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(18, 242, 141);
  doc.setFontSize(20);
  doc.text('TaylorTech Web Systems', 14, 18);
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(15);
  doc.text('Relatório de Simulação Marketplace', 14, 30);
  doc.setDrawColor(18, 242, 141);
  doc.line(14, 34, 196, 34);

  const lines = [
    `Produto: ${r.productName}`,
    `Data: ${r.date}`,
    `Custo total considerado: ${formatCurrency(r.totalCost)}`,
    `Margem desejada: ${formatPercent(r.marginWanted)}`,
    `Melhor plataforma: ${r.bestPlatform}`,
    '',
    'Shopee',
    `  Taxa: ${formatPercent(r.shopeeFee)}`,
    `  Preco sugerido: ${formatCurrency(r.shopeePrice)}`,
    `  Liquido: ${formatCurrency(r.shopeeNet)}`,
    `  Lucro: ${formatCurrency(r.shopeeProfit)}`,
    `  Margem real: ${formatPercent(r.shopeeMargin)}`,
    '',
    'Mercado Livre',
    `  Tipo consultado: ${r.mlListingType || 'Manual'}`,
    `  Taxa usada: ${formatPercent(r.mlFee)}`,
    `  Preco sugerido: ${formatCurrency(r.mlPrice)}`,
    `  Liquido: ${formatCurrency(r.mlNet)}`,
    `  Lucro: ${formatCurrency(r.mlProfit)}`,
    `  Margem real: ${formatPercent(r.mlMargin)}`,
  ];

  let y = 46;
  doc.setFontSize(12);
  lines.forEach((line) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    if (line === 'Shopee' || line === 'Mercado Livre') {
      doc.setTextColor(18, 242, 141);
      doc.setFont(undefined, 'bold');
    } else {
      doc.setTextColor(230, 230, 230);
      doc.setFont(undefined, 'normal');
    }
    doc.text(line, 14, y);
    y += 8;
  });

  doc.save(`simulacao-${r.productName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

function deleteProduct(id) {
  state.products = state.products.filter((item) => item.id !== id);
  saveLocal();
  renderProducts();
  updateStats();
  updateChart();
}

function renderProducts() {
  const list = $('productsList');
  const query = fields.searchProducts.value.trim().toLowerCase();
  const items = state.products.filter((item) => item.productName.toLowerCase().includes(query));

  if (!items.length) {
    list.innerHTML = '<div class="empty-state">Nenhum produto salvo.</div>';
    return;
  }

  list.innerHTML = items.map((item) => `
    <article class="product-card">
      <h3>${item.productName}</h3>
      <div class="product-meta">
        <span>Custo: <strong>${formatCurrency(item.totalCost)}</strong></span>
        <span>Shopee: <strong>${formatCurrency(item.shopeePrice)}</strong></span>
        <span>Mercado Livre: <strong>${formatCurrency(item.mlPrice)}</strong></span>
        <span>Melhor: <strong>${item.bestPlatform}</strong></span>
        <span>Data: <strong>${item.date}</strong></span>
      </div>
      <div class="product-actions">
        <button onclick="loadProduct(${item.id})">Carregar</button>
        <button onclick="deleteProduct(${item.id})">Excluir</button>
      </div>
    </article>
  `).join('');
}

window.deleteProduct = deleteProduct;
window.loadProduct = function loadProduct(id) {
  const item = state.products.find((p) => p.id === id);
  if (!item) return;
  fields.productName.value = item.productName;
  fields.cost.value = item.totalCost;
  fields.extraCost.value = 0;
  fields.shippingCost.value = 0;
  fields.desiredMargin.value = item.marginWanted;
  fields.shopeeFee.value = item.shopeeFee;
  fields.mlFee.value = item.mlFee;
  runCalculation();
};

function updateStats() {
  $('statProducts').textContent = state.products.length;
  $('statSimulations').textContent = state.simulations.length;
}

function updateChart() {
  const ctx = document.getElementById('profitChart');
  const items = state.products.slice(0, 6).reverse();
  const labels = items.map((i) => i.productName.length > 12 ? `${i.productName.slice(0, 12)}…` : i.productName);
  const shopee = items.map((i) => Number(i.shopeeProfit.toFixed(2)));
  const ml = items.map((i) => Number(i.mlProfit.toFixed(2)));

  if (state.chart) state.chart.destroy();

  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Shopee', data: shopee, borderRadius: 10, backgroundColor: 'rgba(18,242,141,0.8)' },
        { label: 'Mercado Livre', data: ml, borderRadius: 10, backgroundColor: 'rgba(246,208,84,0.8)' },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#d2d7dd' } } },
      scales: {
        x: { ticks: { color: '#9ea7b3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9ea7b3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      }
    }
  });
}

function initEvents() {
  $('btnCalculate').addEventListener('click', runCalculation);
  $('btnSaveProduct').addEventListener('click', saveCurrentProduct);
  $('btnClear').addEventListener('click', clearForm);
  $('btnExportProductsJson').addEventListener('click', exportProductsJson);
  $('btnExportPdf').addEventListener('click', exportPdf);
  $('btnClearProducts').addEventListener('click', () => {
    if (confirm('Deseja apagar todos os produtos salvos?')) {
      state.products = [];
      saveLocal();
      renderProducts();
      updateStats();
      updateChart();
    }
  });
  fields.searchProducts.addEventListener('input', renderProducts);
}

function init() {
  initEvents();
  updateStats();
  renderProducts();
  updateChart();
  runCalculation();
}

init();
