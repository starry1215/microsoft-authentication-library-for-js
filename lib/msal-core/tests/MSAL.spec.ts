import {UserAgentApplication, AuthError, ClientConfigurationError, ClientAuthError, AuthResponse} from "../src/index";
import { Constants, ErrorCodes, ErrorDescription, PromptState } from "../src/Constants";
import { Authority } from "../src/Authority";
import { ServerRequestParameters } from "../src/ServerRequestParameters";
import { AuthorityFactory } from "../src/AuthorityFactory";
import { AuthenticationParameters } from "../src/AuthenticationParameters";
import { Account } from "../src/Account";
import { IdToken } from "../src/IdToken";
import { ClientAuthErrorMessage } from "../src/error/ClientAuthError";
import { Configuration } from "../src/Configuration";

const DEFAULT_UAA_CONFIG: Configuration = {
    auth: {
        clientId: MSAL_CLIENT_ID
    }
};

describe('Msal', function (): any {
    let window: any;
    let msal: any;
    var mathMock = {
        random: function (): any {
            return 0.2;
        },
        round: function (val: any): any {
            return 1000;
        }
    };

    var mockFrames = {};

    var documentMock = {
        getElementById: function (frameId: any) {
            if (!mockFrames[frameId]) {
                mockFrames[frameId] = { src: 'start' };
            }
            return mockFrames[frameId];
        }
    };

    var RESOURCE_DELIMETER = '|';
    var DEFAULT_INSTANCE = "https://login.microsoftonline.com/";
    var TEST_REDIR_URI = "https://localhost:8081/redirect.html"
    var TENANT = 'common';
    var validAuthority = DEFAULT_INSTANCE + TENANT;

    var storageFake = function () {
        var store = {};

        var accessTokenCacheItem = {
            key: {
                authority: "",
                clientId: "",
                scopes: "",
                homeAccountIdentifier: ""
            },
            value: {
                accessToken: "",
                idToken: "",
                expiresIn: "",
                clientInfo: ""
            }
        };

        return {
            getItem: function (key: any, storeAuthStateInCookie?: boolean) {
                if (storeAuthStateInCookie) {
                    return this.getItemCookie(key);
                }
                return store[key];
            },
            setItem: function (key: any, value: any, storeAuthStateInCookie?: boolean) {
                if (typeof value !== 'undefined') {
                    store[key] = value;
                }
                if (storeAuthStateInCookie) {
                    this.setItemCookie(key, value);
                }

            },
            removeItem: function (key: any) {
                if (typeof store[key] !== 'undefined') {
                    delete store[key];
                }
            },
            clear: function () {
                store = {};
            },
            storeVerify: function () {
                return store;
            },
            getAllAccessTokens: function (clientId: any, homeAccountIdentifier: any) {
                var results = [];
                for (var key in store) {
                    if (store.hasOwnProperty(key)) {
                        if (key.match(clientId) && key.match(homeAccountIdentifier)) {
                            let value = this.getItem(key);
                            if (value) {
                                let accessTokenCacheItem = <any>{};
                                accessTokenCacheItem.key = JSON.parse(key);
                                accessTokenCacheItem.value = JSON.parse(value);
                                results.push(accessTokenCacheItem);
                            }
                        }
                    }
                }
                return results;
            },

            setItemCookie(cName: string, cValue: string, expires?: number): void {
                var cookieStr = cName + "=" + cValue + ";";
                if (expires) {
                    var expireTime = this.setExpirationCookie(expires);
                    cookieStr += "expires=" + expireTime + ";";
                }

                document.cookie = cookieStr;
            },

            getItemCookie(cName: string): string {
                var name = cName + "=";
                var ca = document.cookie.split(';');
                for (var i = 0; i < ca.length; i++) {
                    var c = ca[i];
                    while (c.charAt(0) == ' ') {
                        c = c.substring(1);
                    }
                    if (c.indexOf(name) == 0) {
                        return c.substring(name.length, c.length);
                    }
                }
                return "";
            },

            removeAcquireTokenEntries: function () {
                return;
            },

            setExpirationCookie(cookieLife: number): string {
                var today = new Date();
                var expr = new Date(today.getTime() + cookieLife * 24 * 60 * 60 * 1000);
                return expr.toUTCString();
            },

            clearCookie(): void {
                this.setItemCookie(Constants.nonceIdToken, '', -1);
                this.setItemCookie(Constants.stateLogin, '', -1);
                this.setItemCookie(Constants.loginRequest, '', -1);
            }
        };
    }();

    let successCallback = function(token, tokenType, state) {
        console.log("Token: " + token);
        console.log("Token Type: " + tokenType);
        console.log("State: " + state);
    };

    let errCallback = function (error, state) {
        console.log("Error: " + error);
        console.log("State: " + state);
    };

    beforeEach(function () {
        // one item in cache
        storageFake.clear();
        var secondsNow = mathMock.round(0);
        let $window: any = {
            location: {
                hash: '#hash',
                href: 'href',
                replace: function (val: any) {
                return; }
            },
            localStorage: {},
            sessionStorage: {},
            atob: atob,
            innerWidth: 100,
            innerHeight: 100,
        };

        $window.localStorage = storageFake;
        $window.sessionStorage = storageFake;

        // Init
        let global = <any>{};
        global.window = $window;
        global.localStorage = storageFake;
        global.sessionStorage = storageFake;
        global.document = documentMock;
        global.Math = mathMock;
        msal = new UserAgentApplication(DEFAULT_UAA_CONFIG);
        msal.user = null;
        msal.renewStates = [];
        msal.activeRenewals = {};
        msal.cacheStorage = storageFake;

        jasmine.Ajax.install();

        const validOpenIdConfigurationResponse = `{"authorization_endpoint":"${validAuthority}/oauth2/v2.0/authorize","token_endpoint":"https://token_endpoint","issuer":"https://fakeIssuer", "end_session_endpoint":"https://end_session_endpoint"}`;

        jasmine.Ajax.stubRequest(/.*openid-configuration/i).andReturn({
            responseText: validOpenIdConfigurationResponse
        });
        jasmine.Ajax.stubRequest(/.*discovery\/instance/i).andReturn({
            responseText: '{"tenant_discovery_endpoint":"https://tenant_discovery_endpoint/openid-configuration"}'
        });
    });

    afterEach(function () {
        jasmine.Ajax.uninstall();
    });

    it('throws error if loginRedirect is called without calling handleRedirectCallbacks()', (done) => {
        expect(msal.getRedirectUri()).toBe(global.window.location.href);
        try {
            msal.loginRedirect();
        } catch (e) {
            expect(e).toEqual(jasmine.any(ClientConfigurationError));
        }
        done();
    });

    it('throws error if null or non-function argument is passed to either argument of handleRedirectCallbacks', (done) => {
        try {
            msal.handleRedirectCallbacks(successCallback, null);
        } catch (e) {
            expect(e).toEqual(jasmine.any(ClientConfigurationError));
        }

        try {
            msal.handleRedirectCallbacks(null, errCallback);
        } catch (e) {
            expect(e).toEqual(jasmine.any(ClientConfigurationError));
        }
        done();
    });

    it('navigates user to login and prompt parameter is not passed by default', (done) => {
        msal.handleRedirectCallbacks(successCallback, errCallback);
        expect(msal.getRedirectUri()).toBe(global.window.location.href);
        msal.promptUser = function (args: string) {
            expect(args).toContain(DEFAULT_INSTANCE + TENANT + '/oauth2/v2.0/authorize?response_type=id_token&scope=openid%20profile');
            expect(args).toContain('&client_id=' + msal.clientId);
            expect(args).toContain('&redirect_uri=' + encodeURIComponent(msal.getRedirectUri()));
            expect(args).toContain('&state');
            expect(args).toContain('&client_info=1');
            expect(args).not.toContain(PromptState.prompt_select_account);
            expect(args).not.toContain(Constants.prompt_none);
            done();
        };

        msal.loginRedirect();
    });

    it('navigates user to login and prompt=select_account parameter is passed in request', (done) => {
        msal.handleRedirectCallbacks(successCallback, errCallback);
        expect(msal.getRedirectUri()).toBe(global.window.location.href);
        msal.promptUser = function (args: string) {
            expect(args).toContain(DEFAULT_INSTANCE + TENANT + '/oauth2/v2.0/authorize?response_type=id_token&scope=openid%20profile');
            expect(args).toContain('&client_id=' + msal.clientId);
            expect(args).toContain('&redirect_uri=' + encodeURIComponent(msal.getRedirectUri()));
            expect(args).toContain('&state');
            expect(args).toContain('&client_info=1');
            expect(args).toContain(Constants.prompt_select_account);
            expect(args).not.toContain(Constants.prompt_none);
            done();
        };

        let request: AuthenticationParameters = {prompt: "select_account"};
        msal.loginRedirect(request);
    });

    it('navigates user to login and prompt=none parameter is passed in request', (done) => {
        msal.handleRedirectCallbacks(successCallback, errCallback);
        expect(msal.getRedirectUri()).toBe(global.window.location.href);
        msal.promptUser = function (args: string) {
            expect(args).toContain(DEFAULT_INSTANCE + TENANT + '/oauth2/v2.0/authorize?response_type=id_token&scope=openid%20profile');
            expect(args).toContain('&client_id=' + msal.clientId);
            expect(args).toContain('&redirect_uri=' + encodeURIComponent(msal.getRedirectUri()));
            expect(args).toContain('&state');
            expect(args).toContain('&client_info=1');
            expect(args).not.toContain(Constants.prompt_select_account);
            expect(args).toContain(Constants.prompt_none);
            done();
        };

        let request: AuthenticationParameters = {prompt: "none"};
        msal.loginRedirect(request);
    });

    it('navigates user to redirectURI passed in request', (done) => {
        const config = {
            auth: {
                clientId: "0813e1d1-ad72-46a9-8665-399bba48c201", 
                redirectUri: TEST_REDIR_URI
            }
        };
        msal = new UserAgentApplication(config);
        msal.handleRedirectCallbacks(successCallback, errCallback);
        msal.user = null;
        msal.renewStates = [];
        msal.activeRenewals = {};
        msal.cacheStorage = storageFake;
        expect(msal.getRedirectUri()).toBe(TEST_REDIR_URI);
        msal.promptUser = function (args: string) {
            expect(args).toContain(DEFAULT_INSTANCE + TENANT + '/oauth2/v2.0/authorize?response_type=id_token&scope=openid%20profile');
            expect(args).toContain('&client_id=' + msal.clientId);
            expect(args).toContain('&redirect_uri=' + encodeURIComponent(msal.getRedirectUri()));
            expect(args).toContain('&state');
            expect(args).toContain('&client_info=1');
            done();
        };

        msal.loginRedirect();
    });

    it('uses current location.href as returnUri by default, even if location changed after UserAgentApplication was instantiated', (done) => {
        history.pushState(null, null, '/new_pushstate_uri');
        msal.handleRedirectCallbacks(successCallback, errCallback);
        msal.promptUser = function (args: string) {
            expect(args).toContain('&redirect_uri=' + encodeURIComponent('http://localhost:8080/new_pushstate_uri'));
            done();
        };

        msal.loginRedirect();
    });

    it('tests getCachedToken when authority is not passed and single accessToken is present in the cache for a set of scopes', function () {
        var accessTokenKey = {
            authority: validAuthority,
            clientId: "0813e1d1-ad72-46a9-8665-399bba48c201",
            scopes: "S1",
            homeAccountIdentifier: "1234"
        }
        var accessTokenValue = {
            accessToken: "accessToken",
            idToken: "idToken",
            expiresIn: "150000000000000",
            clientInfo: ""
        }
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        var account = { homeAccountIdentifier: "1234" };
        var scopes = ['S1'];
        let cacheResult: AuthResponse = msal.getCachedToken({ scopes: scopes }, account);
        expect(cacheResult.tokenType).toContain(Constants.accessToken);
        expect(cacheResult.accessToken).toContain('accessToken');
        expect(cacheResult.idToken.rawIdToken).toContain('idToken');
        expect(cacheResult.scopes).toBe(scopes);
        expect(cacheResult.account).toBe(account);
        storageFake.clear();
    });

    it('tests getCachedToken when authority is not passed and multiple accessTokens are present in the cache for the same set of scopes', function () {
        var accessTokenKey = {
            authority: validAuthority,
            clientId: "0813e1d1-ad72-46a9-8665-399bba48c201",
            scopes: "S1",
            homeAccountIdentifier: "1234"
        }
        var accessTokenValue = {
            accessToken: "accessToken",
            idToken: "idToken",
            expiresIn: "150000000000000",
            clientInfo: ""
        }
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        accessTokenKey.scopes = "S1 S2";
        accessTokenKey.authority = "authority2";
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        var account = { homeAccountIdentifier: "1234" };
        let authErr : AuthError = null;
        try {
            let cacheResult = msal.getCachedToken({ scopes: ["S1"] }, account);
        } catch (e) {
            authErr = e;
        }
        
        expect(authErr).toEqual(jasmine.any(ClientAuthError));
        expect(authErr.errorCode).toContain(ClientAuthErrorMessage.multipleMatchingTokens.code);
        expect(authErr.errorMessage).toContain(ClientAuthErrorMessage.multipleMatchingTokens.desc);
        storageFake.clear();
    });

    it('tests getCachedToken without sending authority when no matching accesstoken is found and multiple authorities exist', function () {
        var accessTokenKey = {
            authority: validAuthority,
            clientId: "0813e1d1-ad72-46a9-8665-399bba48c201",
            scopes: "S1",
            homeAccountIdentifier: "1234"
        }
        var accessTokenValue = {
            accessToken: "accessToken",
            idToken: "idToken",
            expiresIn: "150000000000000",
            clientInfo: ""
        }
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        accessTokenKey.scopes = 'S2';
        accessTokenKey.authority = 'authority2';
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));

        var account = { homeAccountIdentifier: "1234" };
        let authErr : AuthError = null;
        try {
            let cacheResult = msal.getCachedToken({ scopes: ["S3"] }, account);
        } catch (e) {
            authErr = e;
        }

        expect(authErr).toEqual(jasmine.any(ClientAuthError));
        expect(authErr.errorCode).toContain(ClientAuthErrorMessage.multipleCacheAuthorities.code);
        expect(authErr.errorMessage).toContain(ClientAuthErrorMessage.multipleCacheAuthorities.desc);

        storageFake.clear();
    });

    it('tests getCachedToken when authority is passed and no matching accessToken is found', function () {
        var accessTokenKey = {
            authority: validAuthority,
            clientId: "0813e1d1-ad72-46a9-8665-399bba48c201",
            scopes: "S1",
            homeAccountIdentifier: "1234"
        }
        var accessTokenValue = {
            accessToken: "accessToken",
            idToken: "idToken",
            expiresIn: "150000000000000",
            clientInfo: ""
        }
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        var account = { homeAccountIdentifier: "1234" };
        let cacheResult = msal.getCachedToken({ authority: "authority2", scopes: ['S1'] }, account);
        expect(cacheResult).toBe(null);
        storageFake.clear();
    });

    it('tests getCachedToken when authority is passed and single matching accessToken is found', function () {
        var accessTokenKey = {
            authority: validAuthority,
            clientId: "0813e1d1-ad72-46a9-8665-399bba48c201",
            scopes: "S1",
            homeAccountIdentifier: "1234"
        }
        var accessTokenValue = {
            accessToken: "accessToken1",
            idToken: "idToken",
            expiresIn: "150000000000000",
            clientInfo: ""
        }
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        accessTokenKey.authority = "authority2";
        accessTokenValue.accessToken = "accessToken2";
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        var account = { homeAccountIdentifier: "1234" };
        let scopes = ['S1'];
        let cacheResult1 : AuthResponse = msal.getCachedToken({ authority: validAuthority, scopes: scopes }, account);
        expect(cacheResult1.tokenType).toContain(Constants.accessToken);
        expect(cacheResult1.accessToken).toContain('accessToken1');
        expect(cacheResult1.idToken.rawIdToken).toContain('idToken');
        expect(cacheResult1.scopes).toBe(scopes);
        expect(cacheResult1.account).toBe(account);
        let cacheResult2 = msal.getCachedToken({ authority: "authority2", scopes: scopes }, account);
        expect(cacheResult2.tokenType).toContain(Constants.accessToken);
        expect(cacheResult2.accessToken).toContain('accessToken2');
        expect(cacheResult2.idToken.rawIdToken).toContain('idToken');
        expect(cacheResult2.scopes).toBe(scopes);
        expect(cacheResult2.account).toBe(account);
        storageFake.clear();
    });

    it('tests getCachedToken when authority is passed and multiple matching accessTokens are found', function () {
        var accessTokenKey = {
            authority: validAuthority,
            clientId: "0813e1d1-ad72-46a9-8665-399bba48c201",
            scopes: "S1",
            homeAccountIdentifier: "1234"
        }
        var accessTokenValue = {
            accessToken: "accessToken1",
            idToken: "idToken",
            expiresIn: "150000000000000",
            clientInfo: ""
        }
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        accessTokenKey.authority = validAuthority;
        accessTokenKey.scopes = "S1 S2";
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        var account = { homeAccountIdentifier: "1234" };
        let authErr : AuthError = null;
        try {
            let cacheResult = msal.getCachedToken({ authority: validAuthority, scopes: ['S1'] }, account);
        } catch (e) {
            authErr = e;
        }

        expect(authErr).toEqual(jasmine.any(ClientAuthError));
        expect(authErr.errorCode).toContain(ClientAuthErrorMessage.multipleMatchingTokens.code);
        expect(authErr.errorMessage).toContain(ClientAuthErrorMessage.multipleMatchingTokens.desc);
        storageFake.clear();
    });

    it('tests getCachedToken when authority is passed and single matching accessToken is found which is expired', function () {
        var accessTokenKey = {
            authority: validAuthority,
            clientId: "0813e1d1-ad72-46a9-8665-399bba48c201",
            scopes: "S1",
            homeAccountIdentifier: "1234"
        }
        var accessTokenValue = {
            accessToken: "accessToken1",
            idToken: "idToken",
            expiresIn: "1300",
            clientInfo: ""
        }
        storageFake.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        var account = { homeAccountIdentifier: "1234" };
        let cacheResult = msal.getCachedToken({ authority: validAuthority, scopes: ['S1'] }, account);
        expect(cacheResult).toBe(null);
        expect(storageFake.getItem(JSON.stringify(accessTokenKey))).toBe(undefined);
        storageFake.clear();
    });

    it('tests saveTokenForHash in case of error', function () {
        // TODO: This functionality has changed
        // var requestInfo = {
        //     valid: false,
        //     parameters: { 'error_description': 'error description', 'error': 'invalid' },
        //     stateMatch: false,
        //     stateResponse: '',
        //     requestType: 'unknown'
        // };

        // var cacheStorage = msal.cacheStorage.removeAcquireTokenEntries;
        // msal.cacheStorage.removeAcquireTokenEntries = function () {
        //     return;
        // }
        // msal.saveTokenFromHash(requestInfo);
        // msal.cacheStorage.removeAcquireTokenEntries = cacheStorage;
        // expect(storageFake.getItem(Constants.msalError)).toBe('invalid');
        // expect(storageFake.getItem(Constants.msalErrorDescription)).toBe('error description');
    });

    it('tests if login function exits with error if loginInProgress is true and callback is called with loginProgress error', function () {
        msal.loginInProgress = true;
        var authErr: AuthError;
        try {
            msal.loginRedirect();
        } catch (e) {
            authErr = e;
        }
        expect(authErr).toEqual(jasmine.any(ClientAuthError));
        msal.loginInProgress = false;
    });


    it('tests if request fails if passed invalid prompt', function () {
        var authErr: AuthError;
        try {
            msal.validatePromptParameter("random");
        } catch (e) {
            authErr = e;
        }

        expect(authErr).toEqual(jasmine.any(ClientConfigurationError));
    });


    it('tests if loginRedirect fails with error if scopes is passed as an empty array', function () {
        var authErr: AuthError;
        const request: AuthenticationParameters = {scopes: []};
        try {
            msal.loginRedirect(request);
        } catch (e) {
            authErr = e;
        }
        expect(authErr).toEqual(jasmine.any(ClientConfigurationError));
    });

    it('tests if loginRedirect fails with error if clientID is not passed as a single scope in the scopes array', function () {
        var errDesc = '', token = '', err = '', tokenType = '';
        var callback = function (valErrDesc: string, valToken: string, valErr: string, valTokenType: string) {
            errDesc = valErrDesc;
            token = valToken;
            err = valErr;
            tokenType = valTokenType;
        };
        var authErr = AuthError;
        msal.tokenReceivedCallback = callback;
        let request: AuthenticationParameters = {scopes: [msal.clientId,'123']};
        try {
            msal.loginRedirect(request);
        } catch (e) {
            authErr = e;
        }
        expect(authErr).toEqual(jasmine.any(ClientConfigurationError));
        // expect(errDesc).toBe(ErrorDescription.inputScopesError);
        // expect(err).toBe(ErrorCodes.inputScopesError);
        // expect(token).toBe(null);
        // expect(tokenType).toBe(Constants.idToken);
    });

    it('tests if error is not thrown if null scope is passed when scopesRequired is false', function () {
        var scopes;
        var err: AuthError;
        try {
            msal.validateInputScope(scopes, false);
        } catch (e) {
            err = e;
        }
        expect(err).toEqual(undefined);
    });

    it('tests if error is thrown when null scopes are passed', function () {
        var scopes;
        var err: AuthError;
        try {
            msal.validateInputScope(scopes, true);
        } catch (e) {
            err = e;
        }
        expect(err).toEqual(jasmine.any(ClientConfigurationError));
    });

    it('tests if error is thrown when non-array scopes are passed', function () {
        var scopes = "S1, S2";
        var err: AuthError;
        try {
            msal.validateInputScope(scopes, true);
        } catch (e) {
            err = e;
        }
        expect(err).toEqual(jasmine.any(ClientConfigurationError));
    });

    it('tests if error is thrown when empty array is passed', function () {
        var scopes = [];
        var err: AuthError;
        try {
            msal.validateInputScope(scopes, true);
        } catch (e) {
            err = e;
        }
        expect(err).toEqual(jasmine.any(ClientConfigurationError));
    });

    it('tests if error is thrown when client id is not passed as single scope', function () {
        var scopes = [msal.clientId, "S1"];
        var err: AuthError;
        try {
            msal.validateInputScope(scopes, true);
        } catch (e) {
            err = e;
        }
        expect(err).toEqual(jasmine.any(ClientConfigurationError));
    });

    it('tests if error is thrown when client id is not passed as single scope', function () {
        var scopes = [msal.clientId, "S1"];
        var err: AuthError;
        try {
            msal.validateInputScope(scopes, true);
        } catch (e) {
            err = e;
        }
        expect(err).toEqual(jasmine.any(ClientConfigurationError));
    });

    it('tests if hint parameters get added when user object is passed to the function', function () {
        msal.handleRedirectCallbacks(successCallback, errCallback);
        expect(msal.getRedirectUri()).toBe(global.window.location.href);
        msal.promptUser = function (args: string) {
            expect(args).toContain(DEFAULT_INSTANCE + TENANT + '/oauth2/v2.0/authorize?response_type=id_token&scope=openid%20profile');
            expect(args).toContain('&client_id=' + msal.clientId);
            expect(args).toContain('&redirect_uri=' + encodeURIComponent(msal.getRedirectUri()));
            expect(args).toContain('&state');
            expect(args).toContain('&client_info=1');
            expect(args).toContain("&login_hint=" + 'some_id');
            expect(args).toContain("&login_req=5678");
            expect(args).toContain("&domain_req=1234");
            expect(args).toContain("&domain_hint");
            expect(args).toContain(Constants.prompt_select_account);
            expect(args).not.toContain(Constants.prompt_none);
            done();
        };

        let accountObj: Account = {
            homeAccountIdentifier: '1234.5678',
            userName: 'some_id',
            name: null,
            idToken: null,
            sid: null,
            environment: null
        };

        let request: AuthenticationParameters = {prompt: "select_account", account: accountObj};
        msal.loginRedirect(request);
    });

    it('tests urlContainsQueryStringParameter functionality', function () {
        var url1 = 'https://login.onmicrosoft.com?prompt=none&client_id=12345';
        expect(msal.urlContainsQueryStringParameter('prompt', url1)).toBe(true);
        expect(msal.urlContainsQueryStringParameter('client_id', url1)).toBe(true);
        expect(msal.urlContainsQueryStringParameter('login_hint', url1)).toBe(false);
    });

    it('clears cache before logout', function () {
        spyOn(msal, 'clearCache');
        spyOn(msal, 'promptUser');
        msal.logout();
        expect(msal.clearCache).toHaveBeenCalled();
        expect(msal.promptUser).toHaveBeenCalled();
    });

    it('checks if postLogoutRedirectUri is added to logout url if provided in the config', function () {
        var clearCache = msal.clearCache;
        msal.clearCache = function () {
            return;
        }
        msal.config.auth.postLogoutRedirectUri = () => 'https://contoso.com/logout';
        spyOn(msal, 'promptUser');
        msal.logout();
        expect(msal.promptUser).toHaveBeenCalledWith(msal.authority + '/oauth2/v2.0/logout?post_logout_redirect_uri=https%3A%2F%2Fcontoso.com%2Flogout');
        msal.clearCache = clearCache;
    });

    it('checks if postLogoutRedirectUri is added to logout url if provided in the config as a function', function () {
        var clearCache = msal.clearCache;
        msal.clearCache = function () {
            return;
        }
        msal.config.auth.postLogoutRedirectUri = () => 'https://contoso.com/logoutfn';
        spyOn(msal, 'promptUser');
        msal.logout();
        expect(msal.promptUser).toHaveBeenCalledWith(msal.authority + '/oauth2/v2.0/logout?post_logout_redirect_uri=https%3A%2F%2Fcontoso.com%2Flogoutfn');
        msal.clearCache = clearCache;
    });

    it('is callback if has error or access_token or id_token', function () {
        expect(msal.isCallback('not a callback')).toBe(false);
        expect(msal.isCallback('#error_description=someting_wrong')).toBe(true);
        expect(msal.isCallback('#/error_description=someting_wrong')).toBe(true);
        expect(msal.isCallback('#access_token=token123')).toBe(true);
        expect(msal.isCallback('#id_token=idtoken234')).toBe(true);
    });

    it('gets request info from hash', function () {
        // TODO: functionality has changed
        // var requestInfo = msal.getRequestInfo('invalid');
        // expect(requestInfo.valid).toBe(false);
        // requestInfo = msal.getRequestInfo('#error_description=someting_wrong');
        // expect(requestInfo.valid).toBe(true);
        // expect(requestInfo.stateResponse).toBe('');

        // requestInfo = msal.getRequestInfo('#error_description=someting_wrong&state=1232');
        // expect(requestInfo.valid).toBe(true);
        // expect(requestInfo.stateResponse).toBe('1232');
        // expect(requestInfo.stateMatch).toBe(false);
    });

    it('test getAccountState with a user passed state', function () {
        var result = msal.getAccountState("123465464565|91111");
        expect(result).toEqual("91111")
    });

    it('test getAccountState when there is no user state', function () {
        var result = msal.getAccountState("123465464565");
        expect(result).toEqual("")
    });

    it('test getAccountState when there is no state', function () {
        var result =msal.getAccountState("");
        expect(result).toEqual("")
    });

    it('test if authenticateRequestParameter generates state correctly, if state is a number', function () {
        let authenticationRequestParameters: ServerRequestParameters;
        let authority: Authority;
        authority = AuthorityFactory.CreateInstance("https://login.microsoftonline.com/common/", this.validateAuthority);
        authenticationRequestParameters = new ServerRequestParameters(authority, "0813e1d1-ad72-46a9-8665-399bba48c201", ["user.read"], "id_token", "", "12345");
        var result;
        result = authenticationRequestParameters.createNavigationUrlString(["user.read"]);
        expect(decodeURIComponent(result[4])).toContain("12345");
    });

    it('test if authenticateRequestParameter generates state correctly, if state is a url', function () {
        let authenticationRequestParameters: ServerRequestParameters;
        let authority: Authority;
        authority = AuthorityFactory.CreateInstance("https://login.microsoftonline.com/common/", this.validateAuthority);
        authenticationRequestParameters = new ServerRequestParameters(authority, "0813e1d1-ad72-46a9-8665-399bba48c201", ["user.read"], "id_token", "", "https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow?name=value&name2=value2");
        var result;
        result = authenticationRequestParameters.createNavigationUrlString(["user.read"]);
        expect(decodeURIComponent(result[4])).toContain("https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow?name=value&name2=value2");
    });

    it('tests if you get the state back in errorReceived callback, if state is a number', function () {
        spyOn(msal, 'getAccountState').and.returnValue("1234");
        var err: AuthError;
        var token = "";
        var tokenType = "";
        var state = "";
        var tokenCallback = function (valToken:string, valTokenType: string, valState: string) {
            token = valToken;
            tokenType = valTokenType;
            state = valState;
        };
        var errorCallback = function (valErr:AuthError, valState: string) {
            err = valErr;
            // state= valState;
        };
        msal.handleRedirectCallbacks(tokenCallback, errorCallback);
        msal.loginInProgress = true;

        msal.loginRedirect();
        console.log(err);
        expect(err).toEqual(jasmine.any(ClientAuthError));
        console.log(err.stack);
        expect(token).toBe("");
        expect(tokenType).toBe("");
        // expect(state).toBe('1234');
        msal.loginInProgress = false;
    });

    it('tests if you get the state back in errorReceived callback, if state is a url', function () {
        spyOn(msal, 'getAccountState').and.returnValue("https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow?name=value&name2=value2");
        console.log("MSAL: " + msal);
        var err: AuthError;
        var token = "";
        var tokenType = "";
        var state = "";
        var tokenCallback = function (valToken:string, valTokenType: string, valState: string) {
            token = valToken;
            tokenType = valTokenType;
            state = valState;
        };
        var errorCallback = function (valErr:AuthError, valState: string) {
            err = valErr;
            state= valState;
        };
        msal.handleRedirectCallbacks(tokenCallback, errorCallback);
        console.log(msal.loginInProgress);
        msal.loginInProgress = true;

        msal.loginRedirect();
        expect(err).toEqual(jasmine.any(ClientAuthError));
        expect(token).toBe("");
        expect(tokenType).toBe("");
        expect(state).toBe('https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow?name=value&name2=value2');
        msal.loginInProgress = false;
    });

    it('tests cacheLocation functionality sets to localStorage when passed as a parameter', function () {
        var msalInstance = msal;
        var mockIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJjbGllbnRpZDEyMyIsIm5hbWUiOiJKb2huIERvZSIsInVwbiI6ImpvaG5AZW1haWwuY29tIiwibm9uY2UiOiIxMjM0In0.bpIBG3n1w7Cv3i_JHRGji6Zuc9F5H8jbDV5q3oj0gcw';
        const config: Configuration = {
            ...DEFAULT_UAA_CONFIG,
            cache: {
                cacheLocation: "localStorage"
            }
        };
        msal = new UserAgentApplication(config);
        msal.handleRedirectCallbacks(function(token, tokenType, state) {
            expect(document.cookie).toBe('');
            expect(token).toBe(mockIdToken);
            expect(tokenType).toBe(Constants.idToken);
        }, errCallback);

         expect(msal.config.cache.cacheLocation).toBe('localStorage');
    });

    it('tests cacheLocation functionality defaults to sessionStorage', function () {
        var msalInstance = msal;
        var mockIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJjbGllbnRpZDEyMyIsIm5hbWUiOiJKb2huIERvZSIsInVwbiI6ImpvaG5AZW1haWwuY29tIiwibm9uY2UiOiIxMjM0In0.bpIBG3n1w7Cv3i_JHRGji6Zuc9F5H8jbDV5q3oj0gcw';
        const config = {
            auth: {
                clientId: "0813e1d1-ad72-46a9-8665-399bba48c201"
            },
            cache: {
                storeAuthStateInCookie: true
            }
        };
        msal = new UserAgentApplication(config);
        msal.handleRedirectCallbacks(function(token, tokenType, state) {
            expect(document.cookie).toBe('');
            expect(token).toBe(mockIdToken);
            expect(tokenType).toBe(Constants.idToken);
        }, errCallback);

         expect(msal.config.cache.cacheLocation).toBe('sessionStorage');
    });
});

describe('loginPopup functionality', function () {
    var loginPopupPromise:Promise<string>;
    var msal;
    beforeEach(function () {
        msal = new UserAgentApplication(DEFAULT_UAA_CONFIG);

        spyOn(msal, 'loginPopup').and.callThrough();
        loginPopupPromise = msal.loginPopup([msal.clientId]);
    });

    it('returns a promise', function () {
        expect(loginPopupPromise).toEqual(jasmine.any(Promise));
    });
});

describe('acquireTokenPopup functionality', function () {
    var acquireTokenPopupPromise: Promise<string>;
    var msal;
    beforeEach(function () {
        msal = new UserAgentApplication(DEFAULT_UAA_CONFIG);

        spyOn(msal, 'acquireTokenPopup').and.callThrough();
        let request: AuthenticationParameters = {scopes: [msal.clientId]};
        acquireTokenPopupPromise = msal.acquireTokenPopup(request);
        acquireTokenPopupPromise.then(function(accessToken) { return;
        }, function(error) { return;
        });
    });

    it('returns a promise', function () {
        expect(acquireTokenPopupPromise).toEqual(jasmine.any(Promise));
    });

});

describe('acquireTokenSilent functionality', function () {
    var acquireTokenSilentPromise: Promise<string>;
    var msal;
    beforeEach(function () {
        msal = new UserAgentApplication(DEFAULT_UAA_CONFIG);
        spyOn(msal, 'acquireTokenSilent').and.callThrough();
        spyOn(msal, 'loadIframeTimeout').and.callThrough();
        let request: AuthenticationParameters = {scopes: [msal.clientId]};
        acquireTokenSilentPromise = msal.acquireTokenSilent(request);
        acquireTokenSilentPromise.then(function(accessToken) { return;
        }, function(error) { return;
        });
    });


    it('returns a promise', function () {
        expect(acquireTokenSilentPromise).toEqual(jasmine.any(Promise));
    });

});
