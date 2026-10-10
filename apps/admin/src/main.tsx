import { createRoot } from 'react-dom/client';
import { defaultUnsplashConfig } from '@reedito/admin-x-framework';
import './index.css';
import { AdminAppRoot } from './app-root.tsx';
import { emberMutationHandlers } from './ember-bridge';
import { navigateTo } from './utils/navigation';

const framework = {
  reeditoVersion: '',
  externalNavigate: (link: { route: string; isExternal: boolean; replace?: boolean }) => {
    navigateTo(link.route, { replace: link.replace });
  },
  unsplashConfig: defaultUnsplashConfig,
  sentryDSN: null,
  ...emberMutationHandlers,
};

createRoot(document.getElementById('root')!).render(<AdminAppRoot framework={framework} />);
