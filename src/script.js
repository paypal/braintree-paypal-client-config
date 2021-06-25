/* @flow */

import { getCurrentScriptUID, ATTRIBUTES, parseQuery, getBrowserLocales, base64decode,
    values, getCurrentScript, memoize, stringifyError, getScript } from 'belter/src';
import { COUNTRY, SDK_SETTINGS, SDK_QUERY_KEYS, INTENT, COMMIT, VAULT, CURRENCY,
    FUNDING, CARD, COUNTRY_LANGS, DEFAULT_INTENT, DEFAULT_CURRENCY, DEFAULT_VAULT,
    QUERY_BOOL, LANG, type LocaleType, DEFAULT_SALE_COMMIT, DEFAULT_NONSALE_COMMIT,
    PAGE_TYPES } from '@paypal/sdk-constants/src';

import { getPath, getDefaultNamespace, getSDKHost } from './global';
import { CLIENT_ID_ALIAS } from './config';
import { getComputedLocales } from './utils';

type GetSDKScript = () => HTMLScriptElement;

export const getSDKScript : GetSDKScript = memoize(() => {
    if (__TEST__) {
        const script = getScript({ host: getSDKHost(), path: getPath(), reverse: true });
        if (!script) {
            throw new Error(`Can not find SDK test script`);
        }
        return script;
    }

    try {
        return getCurrentScript();
    } catch (err) {
        throw new Error(`PayPal Payments SDK script not found on page! Expected to find <script src="https://${ getSDKHost() }${  getPath() }">\n\n${ stringifyError(err) }`);
    }
});

type GetSDKAttributes = () => { [string] : string };

export const getSDKAttributes : GetSDKAttributes = memoize(() => {
    const sdkScript = getSDKScript();
    const result = {};
    for (const attr of sdkScript.attributes) {
        if (attr.name.indexOf('data-') === 0) {
            result[attr.name] = attr.value;
        }
    }
    result[ATTRIBUTES.UID] = getCurrentScriptUID();
    return result;
});

export function getSDKAttribute<T : string | void>(name : $Values<typeof SDK_SETTINGS>, def : T) : T {
    // $FlowFixMe
    return getSDKAttributes()[name] || def;
}

export function getSDKQueryParams() : { [string] : string } {
    const script = getSDKScript();
    return parseQuery(script.src.split('?')[1] || '');
}

type GetSDKQueryParam =
    // eslint-disable-next-line no-undef
    (<T : string>($Values<typeof SDK_QUERY_KEYS>) => T | void) &
    // eslint-disable-next-line no-undef
    (<T : string>($Values<typeof SDK_QUERY_KEYS>, T) => T);

export const getSDKQueryParam : GetSDKQueryParam = (name, def) => {
    // $FlowFixMe
    return getSDKQueryParams()[name] || def;
};

export function getScriptUrl() : string {
    const src = getSDKScript().getAttribute('src');
    if (!src) {
        throw new Error(`Can not find src for sdk script`);
    }
    return src;
}

export function getSDKQueryParamBool<T : boolean>(name : $Values<typeof SDK_QUERY_KEYS>, def? : T) : T {
    // $FlowFixMe
    return getSDKQueryParam(name, def ? def.toString() : QUERY_BOOL.FALSE) === QUERY_BOOL.TRUE;
}

export function getClientID() : string {
    const clientID = getSDKQueryParam(SDK_QUERY_KEYS.CLIENT_ID);

    if (!clientID) {
        throw new Error(`Expected ${ SDK_QUERY_KEYS.CLIENT_ID } parameter in sdk url`);
    }

    if (CLIENT_ID_ALIAS[clientID]) {
        return CLIENT_ID_ALIAS[clientID];
    }

    return clientID;
}

export function getMerchantID() : $ReadOnlyArray<string> {
    const merchantIDString = getSDKQueryParam(SDK_QUERY_KEYS.MERCHANT_ID);

    if (merchantIDString === '*') {
        // get multiple merchant ids or emails from data-merchant-id
        const merchantIDAttribute = getSDKAttribute(SDK_SETTINGS.MERCHANT_ID);

        if (!merchantIDAttribute) {
            throw new Error(`Must pass ${ SDK_SETTINGS.MERCHANT_ID } when ${ SDK_QUERY_KEYS.MERCHANT_ID }=* passed in url`);
        }

        const merchantID = merchantIDAttribute.split(',');

        if (merchantID.length <= 1) {
            throw new Error(`Must pass multiple merchant ids to ${ SDK_SETTINGS.MERCHANT_ID }. If passing a single id, pass ${ SDK_QUERY_KEYS.MERCHANT_ID }=XYZ in url`);
        }

        // check duplicates
        const hasDuplicate = merchantID.some((val, i) => merchantID && merchantID.indexOf(val) !== i);

        if (hasDuplicate) {
            throw new Error(`Duplicates ${ SDK_SETTINGS.MERCHANT_ID }. Must pass unique merchant ids to ${ SDK_SETTINGS.MERCHANT_ID }.`);
        }
        return merchantID;
    }

    if (merchantIDString) {
        return merchantIDString.split(',');
    }

    return [];
}

export function getIntent() : $Values<typeof INTENT> {
    return getSDKQueryParam(SDK_QUERY_KEYS.INTENT, DEFAULT_INTENT);
}

export function getCommit() : $Values<typeof COMMIT> {
    return getSDKQueryParamBool(SDK_QUERY_KEYS.COMMIT, getIntent() === INTENT.CAPTURE ? DEFAULT_SALE_COMMIT : DEFAULT_NONSALE_COMMIT);
}

export function getVault() : $Values<typeof VAULT> {
    return getSDKQueryParamBool(SDK_QUERY_KEYS.VAULT, DEFAULT_VAULT);
}

export function getCurrency() : $Values<typeof CURRENCY> {
    return getSDKQueryParam(SDK_QUERY_KEYS.CURRENCY, DEFAULT_CURRENCY);
}

export function getEnableFunding() : $ReadOnlyArray<?$Values<typeof FUNDING>> {
    const funding = getSDKQueryParam(SDK_QUERY_KEYS.ENABLE_FUNDING);
    if (funding) {
        return funding.split(',');
    }
    return [];
}

export function getDisableFunding() : $ReadOnlyArray<?$Values<typeof FUNDING>> {
    const funding = getSDKQueryParam(SDK_QUERY_KEYS.DISABLE_FUNDING);
    if (funding) {
        return funding.split(',');
    }
    return [];
}

export function getDisableCard() : $ReadOnlyArray<?$Values<typeof CARD>> {
    const funding = getSDKQueryParam(SDK_QUERY_KEYS.DISABLE_CARD);
    if (funding) {
        return funding.split(',');
    }
    return [];
}

export function getBuyerCountry() : ?$Values<typeof COUNTRY> {
    return getSDKQueryParam(SDK_QUERY_KEYS.BUYER_COUNTRY);
}

export function getNamespace() : string {
    return getSDKAttribute(SDK_SETTINGS.NAMESPACE) || getDefaultNamespace();
}

export function getClientToken() : ?string {
    return getSDKAttribute(SDK_SETTINGS.CLIENT_TOKEN);
}

export function getAmount() : ?string {
    const amount = getSDKAttribute(SDK_SETTINGS.AMOUNT);
    if (amount && !amount.match(/^\d+\.\d\d$/)) {
        throw new Error(`Invalid amount: ${ amount }`);
    }
    return amount;
}

export function getUserIDToken() : ?string {
    return getSDKAttribute(SDK_SETTINGS.USER_ID_TOKEN);
}

export function getClientAccessToken() : ?string {
    const clientToken = getClientToken();

    if (clientToken) {
        return JSON.parse(base64decode(clientToken)).paypal.accessToken;
    }
}

export function getPartnerAttributionID() : ?string {
    return getSDKAttribute(SDK_SETTINGS.PARTNER_ATTRIBUTION_ID);
}

export function getPageType() : ?string {
    const pageType = getSDKAttribute(SDK_SETTINGS.PAGE_TYPE, '');
    const validPageType = values(PAGE_TYPES).indexOf(pageType.toLowerCase()) !== -1;

    if (!validPageType && pageType.length) {
        throw new Error(`Invalid page type, '${ pageType }'`);
    }
    return pageType.toLowerCase();
}


export function getLocale() : LocaleType {
    const locale = getSDKQueryParam(SDK_QUERY_KEYS.LOCALE);

    if (locale) {
        return getComputedLocales(locale);
    }

    for (let { country, lang } of getBrowserLocales()) {
        country = country && COUNTRY[country];
        lang = lang && LANG[lang.toUpperCase()];

        if (country && lang && COUNTRY_LANGS[country] && COUNTRY_LANGS[country].indexOf(lang) !== -1) {
            return { country, lang };
        } else if (lang) {
            // We infer country from language if there is only one possible country match
            const possibleCountries = Object.keys(COUNTRY_LANGS).filter(c => COUNTRY_LANGS[c].some(l => l === lang));
            
            if (possibleCountries.length === 1) {
                const possibleCountry = possibleCountries[0];
                return { country: possibleCountry, lang };
            }
        }
    }

    for (const { country } of getBrowserLocales()) {
        if (COUNTRY_LANGS.hasOwnProperty(country)) {
            // $FlowFixMe
            return { country, lang: COUNTRY_LANGS[country][0] };
        }
    }

    return {
        lang:    LANG.EN,
        country: COUNTRY.US
    };
}

export function getCSPNonce() : string {
    return getSDKAttribute(SDK_SETTINGS.CSP_NONCE) || '';
}

export function getEnableThreeDomainSecure() : boolean {
    return getSDKAttributes().hasOwnProperty(SDK_SETTINGS.ENABLE_3DS);
}

export function getSDKIntegrationSource() : ?string {
    return getSDKAttribute(SDK_SETTINGS.SDK_INTEGRATION_SOURCE);
}

export function getUserExperienceFlow() : ?string {
    return getSDKAttribute(SDK_SETTINGS.USER_EXPERIENCE_FLOW);
}

// whether in zoid window
export function isChildWindow() : boolean {
    return Boolean(window.xprops);
}

export function getUserAccessToken() : ?string {
    // pass
}

export function getUserAuthCode() : ?string {
    // pass
}

// Remove
export function getCountry() : $Values<typeof COUNTRY> {
    return getLocale().country;
}

// Remove
export function getLang() : $Values<typeof LANG> {
    return getLocale().lang;
}
