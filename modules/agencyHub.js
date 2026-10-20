const groqService = require('../services/groqService');

class AgencyHub {
  async generateClientProposal(clientType, clientName, details = '') {
    const prompt = `You are the lead solutions architect for Safa Othman's High-Ticket Automation Consultancy in Erbil, Kurdistan.
Generate a high-converting, professional, executive B2B automation proposal for a prospective client.

Client Name: ${clientName}
Business Sector: ${clientType} (e.g., Dental/Medical Clinic, Real Estate, Law Firm, Supermarket/Retail, Cargo/Delivery)
Additional Context: ${details || 'None provided'}

Generate a structured Kurdish Sorani proposal with these sections:
1. 🎯 **ئامانجی پڕۆژەکە (Objective)**: How automation replaces manual labor and eliminates human error.
2. 🤖 **سیستەمی پێشنیارکراو (The Autonomous Solution Architecture)**:
   - 24/7 Smart WhatsApp Booking & Inquiry Hub.
   - Automatic Accounting & Invoicing (Zoho / Cloud ERP).
   - Real-time Staff Alert Dashboard on Telegram.
3. 📈 **سوودی دارایی و ژمارەیی (ROI & Financial Return)**:
   - Estimated monthly staff hours saved (~90-120 hours).
   - Recaptured missed calls/leads after 8 PM (+25%).
4. 💰 **تێچووی وەبەرهێنان (Investment & Pricing Options)**:
   - Setup Fee: $1,200 - $2,500.
   - Monthly Retainer / SLA Maintenance: $100 - $250 / month.
5. ⏳ **نەخشەڕێگای جێبەجێکردن (7-Day Roadmap)**.
6. 🏆 **بەڵگەی پۆرتفۆلیۆ (Case Study Proof)**: Highlighting VERTEX Company live automated infrastructure as evidence.

Format as clean, elegant HTML ready for Telegram.`;

    const messages = [
      { role: 'system', content: 'You are an elite enterprise B2B sales engineer and automation consultant.' },
      { role: 'user', content: prompt }
    ];

    return await groqService.fastChat(messages, { temperature: 0.5, max_tokens: 2000 });
  }
}

module.exports = new AgencyHub();
