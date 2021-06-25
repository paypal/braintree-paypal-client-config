/* @flow */
import type { LocaleType } from '@paypal/sdk-constants/src';

const SPECIAL_COUNTRY_LANG_VARIANTS = {
    'HK': 'zh_Hant'
};

export function getComputedLocales(locale : string) : LocaleType {
    let [ lang, country ] = locale.split('_');
    if (country in SPECIAL_COUNTRY_LANG_VARIANTS) {
        lang = SPECIAL_COUNTRY_LANG_VARIANTS[country];
    }
    // $FlowFixMe
    return { lang, country };
}
