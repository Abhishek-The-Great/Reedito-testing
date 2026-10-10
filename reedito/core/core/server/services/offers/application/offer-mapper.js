"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfferMapper = void 0;
const getCurrency = (offer) => {
    if (offer.type.value === 'fixed') {
        return offer.currency?.value ?? null;
    }
    return null;
};
class OfferMapper {
    static toDTO(offer) {
        return {
            id: offer.id,
            name: offer.name.value,
            code: offer.code.value,
            display_title: offer.displayTitle.value,
            display_description: offer.displayDescription.value,
            type: offer.type.value,
            cadence: offer.cadence.value,
            amount: offer.amount.value,
            duration: offer.duration.value.type,
            duration_in_months: offer.duration.value.type === 'repeating' ? offer.duration.value.months : null,
            currency_restriction: offer.type.value === 'fixed',
            currency: getCurrency(offer),
            status: offer.status.value,
            redemption_count: offer.redemptionCount,
            redemption_type: offer.redemptionType.value,
            tier: offer.tier ? { id: offer.tier.id, name: offer.tier.name } : null,
            created_at: offer.createdAt,
            last_redeemed: offer.lastRedeemed,
        };
    }
    /** Returns a DTO for a public facing offer (e.g. Portal's retention offer UI) */
    static toPublicDTO(offer) {
        return {
            id: offer.id,
            display_title: offer.displayTitle.value,
            display_description: offer.displayDescription.value,
            type: offer.type.value,
            cadence: offer.cadence.value,
            amount: offer.amount.value,
            duration: offer.duration.value.type,
            duration_in_months: offer.duration.value.type === 'repeating' ? offer.duration.value.months : null,
            currency: getCurrency(offer),
            status: offer.status.value,
            redemption_type: offer.redemptionType.value,
            tier: offer.tier ? { id: offer.tier.id } : null,
        };
    }
}
exports.OfferMapper = OfferMapper;
