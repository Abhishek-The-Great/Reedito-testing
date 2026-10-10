import { type Config } from '@reedito/admin-x-framework/api/config';
import { type Setting } from '@reedito/admin-x-framework/api/settings';
import { type SiteData } from '@reedito/admin-x-framework/api/site';
import { type User } from '@reedito/admin-x-framework/api/users';
import { createContext, useContext } from 'react';

export interface GlobalData {
  settings: Setting[];
  siteData: SiteData;
  config: Config;
  currentUser: User;
}

export const GlobalDataContext = createContext<GlobalData | undefined>(undefined);

export const useGlobalData = () => useContext(GlobalDataContext)!;
