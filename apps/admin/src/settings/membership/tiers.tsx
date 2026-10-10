import React from 'react';
import TiersList from './tiers/tiers-list';
import TopLevelGroup from '@/settings/components/top-level-group';
import { Button } from '@reedito/shade/components';
import { type Tier, getActiveTiers, useBrowseTiers } from '@reedito/admin-x-framework/api/tiers';
import { formatNumber } from '@reedito/shade/utils';
import { withErrorBoundary } from '@/settings/components/with-error-boundary';

const Tiers: React.FC<{ keywords: string[] }> = ({ keywords }) => {
  const { data: { tiers, meta, isEnd } = {}, fetchNextPage } = useBrowseTiers();
  const freeTiers = getActiveTiers(tiers || []).filter((tier: Tier) => tier.type === 'free');

  return (
    <TopLevelGroup
      description="Manage free member signups"
      keywords={keywords}
      navid="tiers"
      testId="tiers"
      title="Tiers"
    >
      <TiersList tab="free-tier" tiers={freeTiers} />
      {isEnd === false && (
        <Button type="button" variant="link" onClick={() => void fetchNextPage()}>
          {`Load more (showing ${formatNumber(tiers?.length || 0)}/${formatNumber(meta?.pagination.total || 0)} tiers)`}
        </Button>
      )}
    </TopLevelGroup>
  );
};

export default withErrorBoundary(Tiers, 'Tiers');
