import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reedito/shade/components';
import { Stack } from '@reedito/shade/primitives';
import { getNewsletterRecipientFilter } from '@reedito/admin-x-framework/utils/recipient-filter';
import { publishNewsletterSelect } from '@reedito/test-data/selectors/editor';
import { useBrowseConfig } from '@reedito/admin-x-framework/api/config';
import { checkStripeEnabled } from '@reedito/admin-x-framework/api/settings';
import { useBrowseLabelsInfinite } from '@reedito/admin-x-framework/api/labels';
import { useBrowseTiers } from '@reedito/admin-x-framework/api/tiers';
import { PAID_TIERS_SEARCH_PARAMS } from '@/editor/browse-params';
import { EDITOR_REQUEST_OPTIONS } from '@/editor/request-options';
import { useEditorSettings } from '@/editor/use-editor-settings';
import { useEffect, useId, useMemo } from 'react';
import { parseRecipientSegments } from './email-recipients-boundary';
import { RecipientSelect, type SegmentOption } from './recipient-select';
import type { NewsletterInput, PublishOptionsState } from '@/editor/publish/publish-options';

export interface EmailRecipientsOptionsProps {
  state: PublishOptionsState;
  onSetNewsletter: (newsletter: NewsletterInput | null) => void;
  onSetRecipientFilter: (filter: string | null) => void;
}

export function EmailRecipientsOptions({
  state,
  onSetNewsletter,
  onSetRecipientFilter,
}: EmailRecipientsOptionsProps) {
  const newsletterId = useId();
  const { data: settingsData } = useEditorSettings();
  const { data: configData } = useBrowseConfig({
    defaultErrorHandler: false,
    requestOptions: EDITOR_REQUEST_OPTIONS,
  });
  const tiersQuery = useBrowseTiers({
    defaultErrorHandler: false,
    requestOptions: EDITOR_REQUEST_OPTIONS,
    searchParams: PAID_TIERS_SEARCH_PARAMS,
  });
  const labelsQuery = useBrowseLabelsInfinite({
    defaultErrorHandler: false,
    requestOptions: EDITOR_REQUEST_OPTIONS,
    searchParams: { limit: 'all' },
  });
  const {
    data: labelsData,
    fetchNextPage: fetchNextLabelPage,
    hasNextPage: hasNextLabelPage,
    isError: labelsError,
    isFetchingNextPage: isFetchingNextLabelPage,
  } = labelsQuery;
  const {
    data: tiersData,
    fetchNextPage: fetchNextTierPage,
    hasNextPage: hasNextTierPage,
    isError: tiersError,
    isFetchingNextPage: isFetchingNextTierPage,
  } = tiersQuery;

  // Core caps `limit=all`, so the response can still contain a next page.
  // Exhaust both collections before exposing segments to avoid a partial list.
  useEffect(() => {
    if (hasNextLabelPage && !isFetchingNextLabelPage && !labelsError) {
      void fetchNextLabelPage();
    }
  }, [fetchNextLabelPage, hasNextLabelPage, isFetchingNextLabelPage, labelsError]);

  useEffect(() => {
    if (hasNextTierPage && !isFetchingNextTierPage && !tiersError) {
      void fetchNextTierPage();
    }
  }, [fetchNextTierPage, hasNextTierPage, isFetchingNextTierPage, tiersError]);

  const labelsSettled =
    !labelsQuery.isLoading && !isFetchingNextLabelPage && (!hasNextLabelPage || labelsError);
  const tiersSettled =
    !tiersQuery.isLoading && !isFetchingNextTierPage && (!hasNextTierPage || tiersError);

  const paidAvailable = configData
    ? checkStripeEnabled(settingsData?.settings ?? [], configData.config)
    : false;

  const segmentOptions = useMemo<SegmentOption[]>(() => {
    if (!labelsSettled || !tiersSettled) {
      return [];
    }

    const { tiers, labels } = parseRecipientSegments(
      tiersError ? undefined : tiersData,
      labelsError ? undefined : labelsData,
    );
    // A single paid tier adds nothing to a paid/free split, so Ember hides it.
    const tierOptions =
      tiers.length > 1
        ? [...tiers]
            .sort((a, b) => Number(b.active) - Number(a.active))
            .map((tier) => ({ segment: `tier:${tier.slug}`, name: tier.name }))
        : [];

    return [
      ...tierOptions,
      ...labels.map((label) => ({
        segment: `label:${label.slug}`,
        name: label.name,
      })),
    ];
  }, [labelsData, labelsError, labelsSettled, tiersData, tiersError, tiersSettled]);

  const newsletterRecipientFilter = state.newsletter
    ? getNewsletterRecipientFilter({
        slug: state.newsletter.slug,
        visibility: state.newsletter.visibility,
      })
    : null;

  return (
    <Stack gap="lg">
      <RecipientSelect
        filter={state.recipientFilter}
        newsletterRecipientFilter={newsletterRecipientFilter}
        paidAvailable={paidAvailable}
        segmentOptions={segmentOptions}
        onChange={onSetRecipientFilter}
      />

      {state.newsletters.length > 1 ? (
        <Stack gap="sm">
          <Label htmlFor={newsletterId}>Newsletter</Label>
          <Select
            value={state.newsletter?.slug ?? ''}
            onValueChange={(slug) =>
              onSetNewsletter(state.newsletters.find((option) => option.slug === slug) ?? null)
            }
          >
            <SelectTrigger data-testid={publishNewsletterSelect} id={newsletterId}>
              <SelectValue placeholder="Select a newsletter" />
            </SelectTrigger>
            <SelectContent>
              {state.newsletters.map((newsletter) => (
                <SelectItem key={newsletter.slug} value={newsletter.slug}>
                  {newsletter.name ?? newsletter.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Stack>
      ) : null}
    </Stack>
  );
}
