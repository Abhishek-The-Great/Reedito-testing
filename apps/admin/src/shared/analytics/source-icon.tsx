import React from 'react';
import { LucideIcon } from '@reedito/shade/utils';

interface SourceIconProps {
  displayName: string;
  iconSrc: string;
  defaultSourceIconUrl: string;
}

const SourceIcon: React.FC<SourceIconProps> = ({ defaultSourceIconUrl, displayName, iconSrc }) => {
  const [failed, setFailed] = React.useState(false);
  const [usingFallback, setUsingFallback] = React.useState(false);

  return (
    <>
      {displayName.trim().toLowerCase().endsWith('newsletter') ? (
        <LucideIcon.Mail aria-label="Newsletter" className="size-4 text-muted-foreground" />
      ) : failed || (!iconSrc && !defaultSourceIconUrl) ? (
        <LucideIcon.Globe aria-hidden="true" className="size-4 text-muted-foreground" />
      ) : (
        <img
          alt=""
          className="size-4"
          src={usingFallback ? defaultSourceIconUrl : iconSrc || defaultSourceIconUrl}
          onError={() => {
            if (!usingFallback && iconSrc && defaultSourceIconUrl) {
              setUsingFallback(true);
            } else {
              setFailed(true);
            }
          }}
        />
      )}
    </>
  );
};

export default SourceIcon;
