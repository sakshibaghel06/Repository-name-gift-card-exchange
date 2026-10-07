const responseDelay = 500

export const MockSupportProvider = {
  async sendMessage(message) {
    await new Promise((resolve) => setTimeout(resolve, responseDelay))

    const normalizedMessage = message.toLowerCase().trim()
    const searchableMessage = normalizedMessage.replace(/[^\w\s-]/g, ' ')

    if (/\b(payment|paid|charge|charged|transaction)\b/.test(searchableMessage)) {
      return 'Please check whether your payment method was successful and whether the order is still showing as payment pending. If the payment was deducted but the order did not update, please contact Giftly Support with your order details.'
    }

    if (/\b(purchase|bought|order|delivery|delivered|gift card|giftcard)\b/.test(searchableMessage)) {
      return 'Please check your order status first. If the order is paid but the gift card has not been delivered, the seller may still need to complete delivery. If the issue continues, contact Giftly Support with your order ID.'
    }

    if (/\b(cash.?out|withdraw|payout)\b/.test(searchableMessage)) {
      return 'Cash-outs may remain pending while they are being processed. Please check your Cash-out History. If a cash-out remains pending or fails, contact Giftly Support with the payout details.'
    }

    if (/\b(wallet|balance|money)\b/.test(searchableMessage)) {
      return 'Your marketplace wallet reflects completed marketplace settlements. Please check your Wallet page and transaction history. If a completed sale is missing, contact Giftly Support with the order ID.'
    }

    if (/\b(marketplace|listing|listings|list)\b/.test(searchableMessage)) {
      return 'Please check that your gift card and listing information are valid and that the listing is active. If the problem continues, contact Giftly Support with the listing details.'
    }

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)$/.test(normalizedMessage.replace(/[.!?]+$/g, '').trim())) {
      return 'Hi! How can I help you with Giftly today?'
    }

    return 'I can help with Giftly purchases, gift cards, orders, payments, escrow, wallets, listings, and cash-outs. Please describe the issue and include an order or payout ID if you have one.'
  },
}

const activeSupportProvider = MockSupportProvider

export function sendSupportMessage(message, conversationHistory = []) {
  return activeSupportProvider.sendMessage(message, conversationHistory)
}
