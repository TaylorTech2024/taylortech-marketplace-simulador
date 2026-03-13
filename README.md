# TaylorTech Marketplace SaaS

Dashboard estático pronto para GitHub Pages ou Vercel.

## Recursos
- Simulador de preço para Shopee e Mercado Livre
- Cálculo de líquido, lucro e margem real
- Consulta automática de custos do Mercado Livre via endpoint oficial de listing prices
- Fallback para taxa manual caso a API não responda
- Exportação da simulação atual em PDF
- Exportação dos produtos salvos em JSON
- Cadastro de produtos com persistência em localStorage
- Gráfico de lucro com Chart.js
- Interface leve em HTML, CSS e JavaScript puro

## Estrutura
- `index.html`
- `css/style.css`
- `js/script.js`
- `assets/logo-taylortech.png`

## Como publicar
1. Extraia os arquivos.
2. Suba tudo para um repositório.
3. Ative o GitHub Pages na branch `main`.

## Commit sugerido
```bash
git commit -m "feat: add PDF export and Mercado Livre auto pricing API"
```

## Observação sobre a API do Mercado Livre
O projeto tenta consultar o endpoint público de listing prices para `MLB`. Se a API falhar por CORS, indisponibilidade ou mudança externa, o sistema usa a taxa manual configurada na interface.
