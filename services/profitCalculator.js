class ProfitCalculator {
  /**
   * Calculate profit and margins taking exchange rates into account
   * @param {Object} params
   * @param {number} params.purchasePriceUsd - e.g. 0.784
   * @param {number} params.purchaseRateIqd - exchange rate at purchase, e.g. 1560
   * @param {number} params.sellingPriceUsd - e.g. 0.86
   * @param {number} params.currentMarketRateIqd - e.g. 1685
   * @param {number} [params.quantity=1] - quantity sold
   */
  calculateDetailedProfit(params) {
    const {
      purchasePriceUsd,
      purchaseRateIqd = 1560,
      sellingPriceUsd,
      currentMarketRateIqd = 1685,
      quantity = 1
    } = params;

    const unitCostUsd = purchasePriceUsd;
    const unitCostIqd = unitCostUsd * purchaseRateIqd;

    const unitSaleUsd = sellingPriceUsd;
    const unitSaleIqd = unitSaleUsd * currentMarketRateIqd;

    const totalCostUsd = unitCostUsd * quantity;
    const totalCostIqd = unitCostIqd * quantity;

    const totalSaleUsd = unitSaleUsd * quantity;
    const totalSaleIqd = unitSaleIqd * quantity;

    // Nominal profit (treating USD fixed)
    const nominalProfitUsd = totalSaleUsd - totalCostUsd;
    const nominalMarginPct = totalSaleUsd > 0 ? (nominalProfitUsd / totalSaleUsd) * 100 : 0;

    // Real Cash Profit in IQD
    const realProfitIqd = totalSaleIqd - totalCostIqd;
    const realProfitUsdEquivalent = realProfitIqd / currentMarketRateIqd;
    const realMarginPct = totalSaleIqd > 0 ? (realProfitIqd / totalSaleIqd) * 100 : 0;

    // Break-even selling price in USD to not lose in IQD
    const breakEvenSellingUsd = (unitCostIqd / currentMarketRateIqd);

    // Suggested prices for target margins
    const suggested = [0.08, 0.12, 0.15, 0.20].map(margin => {
      // price to get desired margin in IQD: Price * (1 - margin) = Cost
      const targetUnitIqd = unitCostIqd / (1 - margin);
      const targetUnitUsd = targetUnitIqd / currentMarketRateIqd;
      return {
        marginPct: margin * 100,
        priceUsd: parseFloat(targetUnitUsd.toFixed(3)),
        priceIqd: Math.round(targetUnitIqd),
        profitPerUnitIqd: Math.round(targetUnitIqd - unitCostIqd),
        profitPerUnitUsd: parseFloat((targetUnitUsd - unitCostUsd).toFixed(3))
      };
    });

    return {
      quantity,
      unitCostUsd,
      unitCostIqd,
      unitSaleUsd,
      unitSaleIqd,
      totalCostUsd,
      totalCostIqd,
      totalSaleUsd,
      totalSaleIqd,
      nominalProfitUsd,
      nominalMarginPct,
      realProfitIqd,
      realProfitUsdEquivalent,
      realMarginPct,
      breakEvenSellingUsd: parseFloat(breakEvenSellingUsd.toFixed(3)),
      suggested
    };
  }

  formatReportText(calc, itemName = 'کاڵا') {
    let out = `🧮 <b>شیکاری وردی نرخ و قازانج بۆ [${itemName}]</b>\n\n`;
    out += `📦 <b>بڕ:</b> ${calc.quantity.toLocaleString()} دانە\n`;
    out += `📥 <b>تێچووی کڕین (تاک):</b> $${calc.unitCostUsd} (~${Math.round(calc.unitCostIqd).toLocaleString()} د.ع)\n`;
    out += `📤 <b>نرخی فرۆشتن (تاک):</b> $${calc.unitSaleUsd} (~${Math.round(calc.unitSaleIqd).toLocaleString()} د.ع)\n`;
    out += `----------------------------\n`;
    out += `💰 <b>کۆی فرۆش:</b> $${calc.totalSaleUsd.toLocaleString()} (~${Math.round(calc.totalSaleIqd).toLocaleString()} د.ع)\n`;
    out += `📉 <b>کۆی تێچوو:</b> $${calc.totalCostUsd.toLocaleString()} (~${Math.round(calc.totalCostIqd).toLocaleString()} د.ع)\n`;
    
    if (calc.realProfitIqd >= 0) {
      out += `📈 <b>قازانجی ڕاستەقینەی کاش:</b> +${Math.round(calc.realProfitIqd).toLocaleString()} دینار (+$${calc.nominalProfitUsd.toFixed(2)})\n`;
      out += `✨ <b>ڕێژەی قازانج (Margin):</b> <b>${calc.realMarginPct.toFixed(1)}%</b>\n`;
    } else {
      out += `⚠️ <b>زەرەری ڕاستەقینە:</b> ${Math.round(calc.realProfitIqd).toLocaleString()} دینار\n`;
    }

    out += `\n🎯 <b>کەمترین نرخی فرۆشتن بۆ نەزەرەرکردن:</b> $${calc.breakEvenSellingUsd}\n\n`;
    out += `💡 <b>پێشنیاری نرخ بۆ فرۆشتن بەپێی نرخی بازاڕی ئەمڕۆ:</b>\n`;
    calc.suggested.forEach(s => {
      out += ` • قازانجی ${s.marginPct}%: <b>$${s.priceUsd}</b> (${s.priceIqd.toLocaleString()} د.ع) | قازانج: +${s.profitPerUnitIqd.toLocaleString()} د.ع\n`;
    });

    return out;
  }
}

module.exports = new ProfitCalculator();
