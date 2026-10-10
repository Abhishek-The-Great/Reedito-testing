import FeatureToggle from './feature-toggle';
import LabItem from './lab-item';
import React, { useEffect, useState } from 'react';
import { ActionList } from '@reedito/shade/components';
import { HostLimitError } from '@reedito/admin-x-framework/errors';
import { useLimiter } from '@reedito/admin-x-framework/hooks';

type Feature = {
  title: string;
  description: string;
  flag: string;
  limitName?: string;
};

const features: Feature[] = [
  {
    title: 'Automations',
    description:
      'Toggle the automations beta. Unexpected problems can occur if you turn this off after previously turning it on.',
    flag: 'automations',
  },
  {
    title: 'Automations per tier',
    description: 'Allow automations to be configured for individual tiers.',
    flag: 'automationsPerTier',
  },
  {
    title: 'Automation run analytics',
    description: 'Track run-level analytics for automations.',
    flag: 'automationRunAnalytics',
  },
  {
    title: 'Automations Tinybird sync',
    description: 'Sync automations data to Tinybird.',
    flag: 'automationsTinybirdSync',
  },
  {
    title: 'Import Member Tier',
    description: 'Enables tier to be specified when importing members',
    flag: 'importMemberTier',
  },
  {
    title: 'CSV Content Importer',
    description: 'Enables importing posts from CSV files in the Universal Importer',
    flag: 'csvContentImporter',
  },
  {
    title: 'Admin UI Refresh',
    description: 'Enable Admin UI refresh (exploration)',
    flag: 'adminUIRefresh',
  },
  {
    title: 'Admin 7 · Milestone 2 · Pill controls',
    description:
      'Preview Admin 7 controls and page headers on React pages, including the React editor.',
    flag: 'admin7Pill',
  },
  {
    title: 'Tags X',
    description: 'Enables the new Tags UI',
    flag: 'tagsX',
  },
  {
    title: 'Email Unique ID',
    description:
      'Enables {uniqueid} variable in emails for unique image URLs to bypass ESP image caching',
    flag: 'emailUniqueid',
  },
  {
    title: 'Improve sending UI',
    description: 'Enables improvements to email sending and delivery status for large email sends',
    flag: 'improveSendingUI',
  },
  {
    title: 'Updated theme translation (beta)',
    description: 'Enable theme translation using i18next instead of the old translation package.',
    flag: 'themeTranslation',
  },
  {
    title: 'Picture Element',
    description:
      'Use the HTML picture element to serve modern image formats (AVIF, WebP) with automatic fallbacks',
    flag: 'pictureImageFormats',
  },
  {
    title: 'Get helper deduplication',
    description:
      'Deduplicate identical {{#get}} helper queries within a single request to avoid redundant database calls',
    flag: 'getHelperDeduplication',
  },
  {
    title: 'Member location maps',
    description:
      'Show a location map and profile header on member pages, with state pins for US members.',
    flag: 'memberLocationMap',
  },
  {
    title: 'Member custom fields',
    description: 'Let admins create and manage custom field definitions for members.',
    flag: 'membersCustomFields',
  },
  {
    title: 'Members import redesign',
    description:
      'Serves the redesigned members CSV import dialog, which shows every column in the file and lets each one be mapped to a member field',
    flag: 'membersImportRedesign',
  },
  {
    title: 'Paywall improvements',
    description: 'Enables paywall usability, discoverability and email customization improvements',
    flag: 'paywallImprovements',
  },
  {
    title: 'React posts & pages lists',
    description:
      'Renders the posts (/posts) and pages (/pages) list screens from the React app instead of the Ember screens. Gates the migration behind a runtime toggle so we can compare both implementations.',
    flag: 'postsListReact',
  },
  {
    title: 'React editor',
    description:
      'Serves the editor (/editor) from the React app instead of the Ember editor. Gates the migration behind a runtime toggle; the React side is an early placeholder.',
    flag: 'editorReact',
  },
  {
    title: 'React global search',
    description:
      'Serves the Cmd/Ctrl+K search modal from the React app instead of the Ember modal. Gates the migration behind a runtime toggle so we can compare both implementations.',
    flag: 'globalSearchReact',
  },
  {
    title: 'React member activity',
    description: 'Preview the new member activity screen.',
    flag: 'membersActivityReact',
  },
  {
    title: 'Self-serve archives',
    description:
      'Replaces the individual export buttons with a single "Export data" flow for downloading a full site archive',
    flag: 'selfServeArchives',
  },
  {
    title: 'Dunning warnings',
    description:
      'Show payment-failure warnings in Admin, driven by the hosting provider via hostSettings.billing.dunning',
    flag: 'dunningWarnings',
  },
];

const AlphaFeatures: React.FC = () => {
  const limiter = useLimiter();
  const [allowedFeatures, setAllowedFeatures] = useState<Feature[]>([]);

  useEffect(() => {
    const filterFeatures = async () => {
      const filtered = [];
      // Remove all features that are limited according to the subscribed plan (given these are beta, is optional to use)
      for (const feature of features) {
        if (feature.limitName && limiter?.isLimited(feature.limitName)) {
          try {
            await limiter.errorIfWouldGoOverLimit(feature.limitName);
            filtered.push(feature);
          } catch (error) {
            if (!(error instanceof HostLimitError)) {
              filtered.push(feature);
            }
          }
        } else {
          filtered.push(feature);
        }
      }
      setAllowedFeatures(filtered);
    };
    void filterFeatures();
  }, [limiter]);

  return (
    <ActionList>
      {allowedFeatures.map((feature) => (
        <LabItem
          key={feature.flag}
          action={<FeatureToggle flag={feature.flag} label={feature.title} />}
          detail={feature.description}
          title={feature.title}
        />
      ))}
    </ActionList>
  );
};

export default AlphaFeatures;
