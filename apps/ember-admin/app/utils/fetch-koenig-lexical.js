import config from 'reedito-admin/config/environment';
import {prefixAssetUrl} from 'reedito-admin/utils/asset-base';

export default async function fetchKoenigLexical() {
    if (window['@reedito/koenig-lexical']) {
        return window['@reedito/koenig-lexical'];
    }

    const baseUrl = (config.editorUrl || prefixAssetUrl('assets/koenig-lexical/'));
    const url = new URL(`${baseUrl}${config.editorFilename}?v=${config.editorHash}`);

    if (url.protocol === 'http:') {
        await import(`http://${url.host}${url.pathname}${url.search}`);
    } else {
        await import(`https://${url.host}${url.pathname}${url.search}`);
    }

    return window['@reedito/koenig-lexical'];
}
