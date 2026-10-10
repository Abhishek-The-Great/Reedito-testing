import APIKeys from './api-keys';
import BrandIcon from '@/shared/brand-icon/brand-icon';
import IntegrationHeader from './integration-header';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  Switch,
} from '@reedito/shade/components';
import {
  type Setting,
  getSettingValues,
  useEditSettings,
} from '@reedito/admin-x-framework/api/settings';
import { SettingsModal } from '@reedito/shade/patterns';
import { getReeditoPaths } from '@reedito/admin-x-framework/helpers';
import { useBrowseIntegrations } from '@reedito/admin-x-framework/api/integrations';
import { useConfirmation } from '@/settings/providers/confirmation-context';
import { useEffect, useState } from 'react';
import { useGlobalData } from '@/settings/providers/global-data-context';
import { useHandleError, useHostLimits } from '@reedito/admin-x-framework/hooks';
import { useRefreshAPIKey } from '@reedito/admin-x-framework/api/api-keys';
import { useSettingsNavigation } from '@/settings/hooks/use-settings-navigation';

function TransistorModal() {
  const { updateRoute } = useSettingsNavigation();
  const { settings } = useGlobalData();
  const { mutateAsync: editSettings } = useEditSettings();
  const { data: { integrations } = { integrations: [] } } = useBrowseIntegrations();

  const { mutateAsync: refreshAPIKey } = useRefreshAPIKey();
  const handleError = useHandleError();
  const { confirm } = useConfirmation();
  const [regenerated, setRegenerated] = useState(false);

  const builtInApiIntegrationsDisabled = useHostLimits()?.customIntegrations?.disabled;
  const [transistorEnabled] = getSettingValues<boolean>(settings, ['transistor']);
  const [enabled, setEnabled] = useState<boolean>(!!transistorEnabled);
  const [okLabel, setOkLabel] = useState('Save');

  useEffect(() => {
    setEnabled(transistorEnabled || false);
  }, [transistorEnabled]);

  useEffect(() => {
    if (builtInApiIntegrationsDisabled) {
      updateRoute('integrations');
    }
  }, [builtInApiIntegrationsDisabled, updateRoute]);

  const integration = integrations.find(({ slug }) => slug === 'transistor');
  const adminApiKey = integration?.api_keys?.find((key) => key.type === 'admin');

  const handleRegenerate = () => {
    if (!integration || !adminApiKey) {
      throw new Error('Transistor integration or Admin API key not found');
    }

    setRegenerated(false);

    confirm({
      title: 'Regenerate Admin API Key',
      prompt:
        'You will need to update the API key in your Transistor account settings after regenerating.',
      okLabel: 'Regenerate Admin API Key',
      onOk: async (confirmModal) => {
        try {
          await refreshAPIKey({ integrationId: integration.id, apiKeyId: adminApiKey.id });
          setRegenerated(true);
          confirmModal?.remove();
        } catch (e) {
          handleError(e);
        }
      },
    });
  };

  const handleSave = async () => {
    const updates: Setting[] = [
      {
        key: 'transistor',
        value: enabled,
      },
    ];
    try {
      setOkLabel('Saving...');
      await Promise.all([
        editSettings(updates),
        new Promise((resolve) => {
          setTimeout(resolve, 1000);
        }),
      ]);
      setOkLabel('Saved');
    } catch (e) {
      handleError(e);
    } finally {
      setTimeout(() => setOkLabel('Save'), 1000);
    }
  };

  return (
    <SettingsModal
      cancelLabel="Close"
      dirty={enabled !== transistorEnabled}
      okLabel={okLabel}
      okVariant="default"
      testId="transistor-modal"
      title=""
      onClose={() => {
        updateRoute('integrations');
      }}
      onOk={handleSave}
    >
      <IntegrationHeader
        detail="Give your members access to private podcasts"
        icon={<BrandIcon name="transistor" size={56} />}
        title="Transistor.fm"
      />
      <>
        <FieldSet className="gap-0">
          <FieldGroup className="gap-8 rounded-sm border border-border-default p-4 md:p-7">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="transistor-enabled">Enable Transistor</FieldLabel>
                <FieldDescription>
                  Connect your Reedito site with{' '}
                  <a
                    className="text-green"
                    href="https://transistor.fm"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Transistor.fm
                  </a>{' '}
                  to offer members private podcasts.
                </FieldDescription>
              </FieldContent>
              <Switch checked={enabled} id="transistor-enabled" onCheckedChange={setEnabled} />
            </Field>
            {enabled && (
              <APIKeys
                keys={[
                  {
                    id: 'admin-api-key',
                    label: 'Admin API key',
                    text: adminApiKey?.secret,
                    hint: regenerated ? (
                      <div className="text-green">Admin API Key was successfully regenerated</div>
                    ) : undefined,
                    onRegenerate: handleRegenerate,
                  },
                  {
                    id: 'api-url',
                    label: 'API URL',
                    text: window.location.origin + getReeditoPaths().subdir,
                  },
                ]}
              />
            )}
          </FieldGroup>
        </FieldSet>

      </>
    </SettingsModal>
  );
}

export default TransistorModal;
