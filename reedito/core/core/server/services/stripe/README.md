# Legacy Stripe service

Stripe payment processing is disabled in this build. The service is not initialized,
webhooks are not registered, and payment and billing routes are unavailable.

The remaining service code is retained only for compatibility with historical member,
subscription, and payment records. Do not add new payment flows here. Provider subscriptions
that were active before this build must be managed directly with the provider.
