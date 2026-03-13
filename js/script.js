const $ = (id) => document.getElementById(id);

const state = {
  products: JSON.parse(localStorage.getItem('taylortech_products_v5') || '[]'),
  simulations: JSON.parse(localStorage.getItem('taylortech_simulations_v5') || '[]'),
  lastResult: null,
};

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
  importJsonInput: $('importJsonInput'),
};

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function saveLocal() {
  localStorage.setItem('taylortech_products_v5', JSON.stringify(state.products));
  localStorage.setItem('taylortech_simulations_v5', JSON.stringify(state.simulations.slice(0, 20)));
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
  return Number((Math.floor(value) + 0.9).toFixed(2));
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
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Falha ao consultar a API do Mercado Livre.');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Resposta inesperada da API do Mercado Livre.');
  return data;
}

function getPreferredMlFee(listings) {
  if (!Array.isArray(listings) || !listings.length) return null;
  const preferredOrder = ['gold_special', 'gold_pro', 'gold_premium'];
  const selected = listings.find((item) => preferredOrder.includes(item.listing_type_id)) || listings[0];
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

function updateStats() {
  $('statProducts').textContent = state.products.length;
  $('statSimulations').textContent = state.simulations.length;

  const last = state.lastResult || state.simulations[0] || null;
  const best = last ? last.bestPlatform : '-';
  $('statBestPlatform').textContent = best;
  $('sidebarBestPlatform').textContent = best;
  $('summaryProduct').textContent = last ? last.productName : '-';
  $('summaryCost').textContent = last ? formatCurrency(last.totalCost) : 'R$ 0,00';
  $('summaryBest').textContent = best;
}

function renderProducts() {
  const term = fields.searchProducts.value.trim().toLowerCase();
  const list = $('productsList');
  const filtered = state.products.filter((item) => item.productName.toLowerCase().includes(term));
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-box">Nenhum produto salvo ainda.</div>';
    return;
  }

  list.innerHTML = filtered.map((item) => `
    <article class="product-card">
      <div>
        <h3>${item.productName}</h3>
        <div class="product-grid">
          <div><span class="muted">Custo total</span><strong>${formatCurrency(item.totalCost)}</strong></div>
          <div><span class="muted">Shopee</span><strong>${formatCurrency(item.shopeePrice)}</strong></div>
          <div><span class="muted">Mercado Livre</span><strong>${formatCurrency(item.mlPrice)}</strong></div>
          <div><span class="muted">Melhor</span><strong>${item.bestPlatform}</strong></div>
        </div>
      </div>
      <div>
        <button class="ghost-btn" onclick="deleteProduct(${item.id})">Excluir</button>
      </div>
    </article>
  `).join('');
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
  saveLocal();
  updateStats();
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

function importProductsJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('O arquivo JSON precisa ser uma lista de produtos.');
      const normalized = data.map((item, index) => ({
        id: item.id || Date.now() + index,
        productName: item.productName || item.name || `Produto ${index + 1}`,
        totalCost: Number(item.totalCost || item.cost || 0),
        marginWanted: Number(item.marginWanted || item.margin || 0),
        shippingIncluded: Boolean(item.shippingIncluded),
        shopeeFee: Number(item.shopeeFee || 0),
        mlFee: Number(item.mlFee || 0),
        mlListingType: item.mlListingType || 'Importado',
        shopeePrice: Number(item.shopeePrice || 0),
        shopeeNet: Number(item.shopeeNet || 0),
        shopeeProfit: Number(item.shopeeProfit || 0),
        shopeeMargin: Number(item.shopeeMargin || 0),
        mlPrice: Number(item.mlPrice || 0),
        mlNet: Number(item.mlNet || 0),
        mlProfit: Number(item.mlProfit || 0),
        mlMargin: Number(item.mlMargin || 0),
        bestPlatform: item.bestPlatform || '-',
        date: item.date || new Date().toLocaleString('pt-BR'),
      }));
      state.products = normalized;
      saveLocal();
      renderProducts();
      updateStats();
      alert('JSON importado com sucesso.');
    } catch (error) {
      alert(`Erro ao importar JSON: ${error.message}`);
    } finally {
      fields.importJsonInput.value = '';
    }
  };
  reader.readAsText(file);
}

function exportPdf() {
  if (!state.lastResult && !state.products.length) {
    alert('Faça um cálculo ou importe/salve produtos antes de exportar o PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 18;

  const addLine = (text, options = {}) => {
    const { color = [230, 230, 230], size = 11, bold = false, gap = 7 } = options;
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
    doc.setTextColor(...color);
    doc.setFontSize(size);
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    doc.text(String(text), 14, y);
    y += gap;
  };

  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, 210, 297, 'F');
  addLine('TaylorTech Web Systems', { color: [18, 242, 141], size: 20, bold: true, gap: 10 });
  addLine('Relatório Marketplace', { size: 15, bold: true, gap: 10 });
  doc.setDrawColor(18, 242, 141);
  doc.line(14, y - 4, 196, y - 4);
  y += 4;

  if (state.lastResult) {
    const r = state.lastResult;
    addLine('Simulação atual', { color: [18, 242, 141], bold: true });
    addLine(`Produto: ${r.productName}`);
    addLine(`Data: ${r.date}`);
    addLine(`Custo total: ${formatCurrency(r.totalCost)}`);
    addLine(`Melhor plataforma: ${r.bestPlatform}`);
    addLine(`Shopee: ${formatCurrency(r.shopeePrice)} | Lucro: ${formatCurrency(r.shopeeProfit)} | Taxa: ${formatPercent(r.shopeeFee)}`);
    addLine(`Mercado Livre: ${formatCurrency(r.mlPrice)} | Lucro: ${formatCurrency(r.mlProfit)} | Taxa: ${formatPercent(r.mlFee)}`);
    y += 4;
  }

  if (state.products.length) {
    addLine('Produtos salvos/importados', { color: [18, 242, 141], bold: true });
    state.products.forEach((item, index) => {
      addLine(`${index + 1}. ${item.productName}`, { bold: true });
      addLine(`Custo: ${formatCurrency(item.totalCost)} | Melhor: ${item.bestPlatform}`);
      addLine(`Shopee: ${formatCurrency(item.shopeePrice)} | Lucro: ${formatCurrency(item.shopeeProfit)}`);
      addLine(`Mercado Livre: ${formatCurrency(item.mlPrice)} | Lucro: ${formatCurrency(item.mlProfit)}`);
      y += 2;
    });
  }

  const fileNameBase = (state.lastResult?.productName || 'cadastro-taylortech').toLowerCase().replace(/\s+/g, '-');
  doc.save(`relatorio-${fileNameBase}.pdf`);
}

function deleteProduct(id) {
  state.products = state.products.filter((item) => item.id !== id);
  saveLocal();
  renderProducts();
  updateStats();
}
window.deleteProduct = deleteProduct;

$('btnCalculate').addEventListener('click', runCalculation);
$('btnSaveProduct').addEventListener('click', saveCurrentProduct);
$('btnClear').addEventListener('click', clearForm);
$('btnExportProductsJson').addEventListener('click', exportProductsJson);
$('btnExportPdf').addEventListener('click', exportPdf);
$('btnClearProducts').addEventListener('click', () => {
  state.products = [];
  saveLocal();
  renderProducts();
  updateStats();
});
$('btnImportJson').addEventListener('click', () => fields.importJsonInput.click());
fields.importJsonInput.addEventListener('change', importProductsJson);
fields.searchProducts.addEventListener('input', renderProducts);

renderProducts();
updateStats();
