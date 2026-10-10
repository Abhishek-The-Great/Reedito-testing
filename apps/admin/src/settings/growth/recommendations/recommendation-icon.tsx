/* eslint-disable camelcase */
import ReeditoLogo from '@/assets/images/reedito-mark.svg';
import React, { useState } from 'react';

interface Props {
  title: string;
  favicon?: string | null;
  featured_image?: string | null;
  isReeditoSite?: boolean;
}

const RecommendationIcon: React.FC<Props> = ({ title, favicon, featured_image, isReeditoSite }) => {
  const [icon, setIcon] = useState(favicon || featured_image || null);

  const clearIcon = () => {
    setIcon(null);
  };

  if (!icon) {
    return <div className="relative size-6 shrink-0 rounded-sm"></div>;
  }

  const hint = isReeditoSite ? 'This is a Reedito site that supports one-click subscribe' : '';

  return (
    <div className="relative size-6 shrink-0 rounded-sm" title={hint}>
      <img alt={title} className="size-6 rounded-sm" src={icon} onError={clearIcon} />
      {isReeditoSite && (
        <img
          alt="Reedito Logo"
          className="absolute right-[-3px] bottom-[-3px] size-[14px]"
          src={ReeditoLogo}
        />
      )}
    </div>
  );
};

export default RecommendationIcon;
