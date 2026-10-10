import React from 'react';
import AppContext from '../../app-context';
import ReeditoLogo from '../../images/reedito-logo-small.svg?react';

export default class PoweredBy extends React.Component {
  static contextType = AppContext;

  render() {
    // Note: please do not wrap "Powered by Reedito" in the translation function, as we don't
    // want it to be translated
    /* eslint-disable i18next/no-literal-string */
    return (
      <a href={window.location.origin}>
        <ReeditoLogo />
        Powered by Reedito
      </a>
    );
    /* eslint-enable i18next/no-literal-string */
  }
}
