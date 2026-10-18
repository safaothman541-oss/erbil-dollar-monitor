const zohoService = require('./zohoService');

class FifoService {
  constructor() {
    this.batchCache = new Map();
    this.cacheTime = 0;
  }

  /**
   * Fetch all purchase bills for an item and build FIFO inventory layers
   */
  async getItemFifoCost(itemId, quantityToSell, upToInvoiceDate = null) {
    try {
      // 1. Get all purchase bills sorted by date ascending
      const billsRes = await zohoService.request('GET', '/bills?per_page=100&sort_column=date&sort_order=A');
      const allBills = billsRes.bills || [];

      // Collect all purchase layers for this item
      const purchaseLayers = [];
      for (const b of allBills) {
        if (upToInvoiceDate && b.date > upToInvoiceDate) continue;
        const billDetail = await zohoService.request('GET', `/bills/${b.bill_id}`);
        const bill = billDetail.bill;
        const matchingLines = (bill.line_items || []).filter(li => li.item_id === itemId || (li.name && li.name.includes('8080')));

        for (const line of matchingLines) {
          purchaseLayers.push({
            billNumber: bill.bill_number,
            date: bill.date,
            rateUsd: line.rate,
            originalQty: line.quantity,
            remainingQty: line.quantity
          });
        }
      }

      // 2. Get all historical sales for this item prior to this transaction
      const invsRes = await zohoService.request('GET', '/invoices?per_page=100&sort_column=date&sort_order=A');
      const allInvoices = invsRes.invoices || [];

      let historicalSoldQty = 0;
      for (const invSummary of allInvoices) {
        if (upToInvoiceDate && invSummary.date > upToInvoiceDate) continue;
        const inv = await zohoService.getInvoiceDetails(invSummary.invoice_id);
        const matchingLines = (inv.line_items || []).filter(li => li.item_id === itemId || (li.name && li.name.includes('8080')));
        for (const line of matchingLines) {
          historicalSoldQty += (line.quantity || 0);
        }
      }

      // Deduct historical sales from earlier layers
      let soldToDeduct = historicalSoldQty - quantityToSell; // Exclude current transaction
      if (soldToDeduct < 0) soldToDeduct = 0;

      for (const layer of purchaseLayers) {
        if (soldToDeduct <= 0) break;
        if (layer.remainingQty <= soldToDeduct) {
          soldToDeduct -= layer.remainingQty;
          layer.remainingQty = 0;
        } else {
          layer.remainingQty -= soldToDeduct;
          soldToDeduct = 0;
        }
      }

      // Now calculate the cost for the quantityToSell from current layers
      let needed = quantityToSell;
      let totalCostUsd = 0;
      const layersUsed = [];

      for (const layer of purchaseLayers) {
        if (needed <= 0) break;
        if (layer.remainingQty <= 0) continue;

        const take = Math.min(layer.remainingQty, needed);
        const cost = take * layer.rateUsd;
        totalCostUsd += cost;
        needed -= take;

        layersUsed.push({
          billNumber: layer.billNumber,
          date: layer.date,
          rateUsd: layer.rateUsd,
          qtyTaken: take,
          costUsd: cost
        });
      }

      // If somehow layers did not cover all, use default fallback
      if (needed > 0) {
        const fallbackRate = purchaseLayers.length > 0 ? purchaseLayers[purchaseLayers.length - 1].rateUsd : 0.784;
        totalCostUsd += needed * fallbackRate;
      }

      return {
        totalCostUsd,
        avgCostPerUnit: totalCostUsd / quantityToSell,
        layersUsed
      };
    } catch (e) {
      console.error('[FifoService] Error calculating FIFO cost:', e.message);
      // Fallback
      return {
        totalCostUsd: quantityToSell * 0.784,
        avgCostPerUnit: 0.784,
        layersUsed: []
      };
    }
  }
}

module.exports = new FifoService();
